import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/api';
import { ThreadHeader } from './ThreadHeader';
import { MessageBubble } from './MessageBubble';
import { SystemMessage } from './SystemMessage';
import { TypingIndicator } from './TypingIndicator';
import { ForwardDialog } from './ForwardDialog';
import { ReplyBar } from './ReplyQuote';
import { Composer } from '@/components/composer/Composer';
import { groupByDay } from '@/lib/format';
import { conversationMemberIds, messageStatus } from '@/lib/receipts';
import { useChatStore } from '@/store/chat';
import { useAuthStore } from '@/store/auth';
import { useDocumentVisible } from '@/hooks/useDocumentVisible';
import { spring } from '@/lib/motion';

export function ChatThread({ conversation, onBack, onOpenDetails, showBack }) {
  const conversationId = conversation._id;
  const myId = useAuthStore((s) => s.user?._id);
  const me = useAuthStore((s) => s.user);
  const visible = useDocumentVisible();

  const messages = useChatStore((s) => s.messagesByConversation[conversationId]);
  const page = useChatStore((s) => s.pagination[conversationId]);
  const typing = useChatStore((s) => s.typingByConversation[conversationId]);
  const fetchMessages = useChatStore((s) => s.fetchMessages);
  const loadOlder = useChatStore((s) => s.loadOlderMessages);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const markRead = useChatStore((s) => s.markConversationRead);
  const toggleReaction = useChatStore((s) => s.toggleReaction);
  const editMessage = useChatStore((s) => s.editMessage);
  const deleteMessage = useChatStore((s) => s.deleteMessage);

  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [replyTo, setReplyTo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [forwarding, setForwarding] = useState(null);
  const [highlightId, setHighlightId] = useState(null);

  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const topSentinelRef = useRef(null);
  const atBottomRef = useRef(true);

  const memberIds = conversationMemberIds(conversation);
  const typingNames = Object.values(typing ?? {});
  const isGroup = conversation.type === 'group';

  /**
   * Resolves a sender id to a display name. Groups carry a member list; direct
   * chats only carry `peer`, so both shapes have to be handled or reply quotes
   * in a 1:1 would read "Someone".
   */
  const senderName = (senderId) => {
    if (String(senderId) === String(myId)) return me?.name ?? 'You';
    if (isGroup) {
      return conversation.members?.find((m) => String(m._id) === String(senderId))?.name ?? 'Someone';
    }
    return conversation.peer?.name ?? 'Someone';
  };

  useEffect(() => {
    fetchMessages(conversationId).catch(() => toast.error('Could not load messages'));
  }, [conversationId, fetchMessages]);

  // track whether the user is reading history, so incoming messages don't yank them away
  const handleScroll = useCallback((e) => {
    const el = e.currentTarget;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  useLayoutEffect(() => {
    if (atBottomRef.current) bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  /**
   * Infinite scroll upward. Prepending content grows the element above the
   * viewport, so we capture scrollHeight first and re-apply the delta after
   * paint — without this the view lurches to the top on every page.
   */
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const container = scrollRef.current;
    if (!sentinel || !container || !page?.hasMore) return;

    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting || page.loading) return;

        const before = container.scrollHeight;
        const added = await loadOlder(conversationId).catch(() => 0);
        if (!added) return;

        requestAnimationFrame(() => {
          container.scrollTop += container.scrollHeight - before;
        });
      },
      { root: container, rootMargin: '150px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [conversationId, page?.hasMore, page?.loading, loadOlder]);

  /**
   * Read receipts fire only when the thread is genuinely being looked at:
   * open, scrolled to the bottom, and the tab in the foreground. A background
   * tab holding a conversation open shouldn't silently mark things read.
   */
  useEffect(() => {
    if (!visible || !messages?.length) return;
    if (!atBottomRef.current) return;
    markRead(conversationId);
  }, [visible, messages, conversationId, markRead]);

  /** Scrolls to a quoted message and flashes it, so a reply is traceable. */
  function jumpTo(messageId) {
    const el = document.getElementById(`message-${messageId}`);
    if (!el) {
      toast.info('That message is further back — scroll up to load it');
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(messageId);
    setTimeout(() => setHighlightId(null), 1600);
  }

  function startReply(message) {
    setReplyTo({
      _id: message._id,
      senderId: message.senderId,
      senderName: String(message.senderId) === String(myId) ? 'yourself' : senderName(message.senderId),
      type: message.type,
      text: message.text,
      attachment: message.attachment,
    });
  }

  async function saveEdit(messageId, text) {
    try {
      await editMessage(conversationId, messageId, text);
      setEditingId(null);
    } catch (err) {
      toast.error(errorMessage(err, err.message ?? 'Could not edit that message'));
    }
  }

  async function handleDelete(message, scope) {
    try {
      await deleteMessage(conversationId, message._id, scope);
      toast.success(scope === 'everyone' ? 'Deleted for everyone' : 'Deleted for you');
    } catch (err) {
      toast.error(err.message ?? 'Could not delete that message');
    }
  }

  async function handleSend(payload) {
    atBottomRef.current = true;
    try {
      await sendMessage(conversationId, { ...payload, replyTo }, myId);
      setReplyTo(null);
    } catch (err) {
      toast.error(err.message === 'Not connected' ? 'You appear to be offline' : 'Message failed to send');
    }
  }

  /** Every image in the thread, so the lightbox can page between them. */
  const imageMessages = useMemo(
    () => (messages ?? []).filter((m) => m.type === 'image' && m.attachment?.url),
    [messages]
  );
  const slides = imageMessages.map((m) => ({
    src: m.attachment.url,
    title: m.attachment.name,
    width: m.attachment.width,
    height: m.attachment.height,
  }));

  const openImage = (message) =>
    setLightboxIndex(imageMessages.findIndex((m) => m._id === message._id));

  const loading = !messages && page?.loading !== false;
  const days = groupByDay(messages ?? []);

  return (
    <section className="flex h-full min-h-0 flex-col bg-background">
      <ThreadHeader
        conversation={conversation}
        onBack={onBack}
        onOpenDetails={onOpenDetails}
        showBack={showBack}
        typingNames={typingNames}
      />

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto px-2 py-4 scrollbar-thin sm:px-6"
      >
        {/* tripping this sentinel pulls the previous page */}
        <div ref={topSentinelRef} className="h-px" />

        {(loading || page?.loading) && (
          <div className="flex justify-center py-4">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!page?.hasMore && !loading && messages?.length > 0 && (
          <p className="pb-4 text-center text-[11px] text-muted-foreground">
            This is the beginning of your conversation
          </p>
        )}

        {days.map(({ day, messages: dayMessages }) => (
          <div key={day} className="space-y-2">
            <div className="sticky top-2 z-[1] flex justify-center py-2">
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={spring.soft}
                className="glass-panel rounded-full border px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm"
              >
                {day}
              </motion.span>
            </div>

            <AnimatePresence initial={false}>
            {dayMessages.map((message, i) => {
              if (message.type === 'system') {
                return <SystemMessage key={message._id} message={message} />;
              }

              const own = String(message.senderId) === String(myId);
              const next = dayMessages[i + 1];
              return (
                <MessageBubble
                  /* _localKey survives the optimistic→real swap, so the bubble
                     settles in place instead of re-mounting and re-animating */
                  key={message._localKey ?? message._id}
                  message={message}
                  own={own}
                  // groups need a name above each incoming bubble to be readable
                  showSender={isGroup && !own && (i === 0 || dayMessages[i - 1]?.senderId !== message.senderId)}
                  senderName={senderName(message.senderId)}
                  status={messageStatus(message, myId, memberIds)}
                  showTail={!next || String(next.senderId) !== String(message.senderId)}
                  myId={myId}
                  onOpenImage={openImage}
                  editing={editingId === message._id}
                  highlighted={highlightId === message._id}
                  onReply={startReply}
                  onEdit={(m) => setEditingId(m._id)}
                  onSaveEdit={(text) => saveEdit(message._id, text)}
                  onCancelEdit={() => setEditingId(null)}
                  onDelete={handleDelete}
                  onForward={setForwarding}
                  onJumpTo={jumpTo}
                  onReact={
                    String(message._id).startsWith('temp-')
                      ? undefined // can't react to something the server hasn't saved yet
                      : (emoji) => toggleReaction(conversationId, message._id, emoji, myId)
                  }
                />
              );
            })}
            </AnimatePresence>
          </div>
        ))}

        {!loading && messages?.length === 0 && (
          <p className="py-16 text-center text-sm text-muted-foreground">No messages yet — say hello 👋</p>
        )}

        <div ref={bottomRef} className="h-2" />
      </div>

      <TypingIndicator names={typingNames} />

      <ReplyBar reply={replyTo} onCancel={() => setReplyTo(null)} />

      <Composer conversationId={conversationId} onSend={handleSend} />

      <ForwardDialog
        message={forwarding}
        open={Boolean(forwarding)}
        onOpenChange={(open) => !open && setForwarding(null)}
      />

      <Lightbox
        open={lightboxIndex >= 0}
        index={Math.max(lightboxIndex, 0)}
        close={() => setLightboxIndex(-1)}
        slides={slides}
        controller={{ closeOnBackdropClick: true }}
      />
    </section>
  );
}
