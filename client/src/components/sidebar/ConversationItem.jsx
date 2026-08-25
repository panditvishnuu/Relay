import { AnimatePresence, motion } from 'framer-motion';
import { PresenceAvatar } from '@/components/common/PresenceAvatar';
import { cn } from '@/lib/utils';
import { listTimestamp } from '@/lib/format';
import { conversationIdentity } from '@/lib/conversation';
import { layoutIds, listItem, spring } from '@/lib/motion';
import { useChatStore } from '@/store/chat';
import { useAuthStore } from '@/store/auth';

export function ConversationItem({ conversation, active, onSelect }) {
  const { name, avatarUrl, peerId, isGroup } = conversationIdentity(conversation);
  const myId = useAuthStore((s) => s.user?._id);
  // live from the presence registry, not the stale flag baked into the document
  const online = useChatStore((s) => (peerId ? s.onlineUserIds.has(String(peerId)) : false));
  const typing = useChatStore((s) => s.typingByConversation[conversation._id]);
  const typingNames = Object.values(typing ?? {});

  const { lastMessage, unreadCount = 0 } = conversation;
  const isSystem = lastMessage?.type === 'system';
  const isOwn = lastMessage && !isSystem && String(lastMessage.senderId) === String(myId);

  // groups prefix the preview with who said it, the way every messenger does
  const prefix = isOwn
    ? 'You:'
    : isGroup && !isSystem
      ? `${(conversation.members?.find((m) => String(m._id) === String(lastMessage?.senderId))?.name ?? '').split(' ')[0]}:`
      : null;

  return (
    <motion.button
      type="button"
      variants={listItem}
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.985 }}
      transition={spring.snappy}
      onClick={() => onSelect(conversation._id)}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left',
        'min-h-[64px] hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
        active && 'bg-accent'
      )}
    >
      {/*
        One rail element shared across every row via layoutId — Framer animates
        it sliding to the newly selected conversation rather than cross-fading
        two separate bars.
      */}
      {active && (
        <motion.span
          layoutId={layoutIds.activeRail}
          transition={spring.smooth}
          className="absolute top-1/2 left-0 h-8 w-1 -translate-y-1/2 rounded-r-full bg-primary"
        />
      )}

      <PresenceAvatar name={name} src={avatarUrl} online={online} showPresence={!isGroup} />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-semibold">{name}</span>
          {lastMessage && (
            <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
              {listTimestamp(lastMessage.at)}
            </span>
          )}
        </div>

        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span
            className={cn(
              'truncate text-[13px] text-muted-foreground transition-colors',
              unreadCount > 0 && 'font-medium text-foreground/80',
              typingNames.length > 0 && 'font-medium text-primary'
            )}
          >
            {/* live typing replaces the preview, the way every messenger does it */}
            {typingNames.length > 0 ? (
              isGroup ? `${typingNames[0].split(' ')[0]} is typing…` : 'typing…'
            ) : lastMessage ? (
              <>
                {prefix && prefix !== ':' && <span className="mr-1 text-primary">{prefix}</span>}
                <span className={cn(isSystem && 'italic')}>{lastMessage.text}</span>
              </>
            ) : (
              <span className="italic">No messages yet</span>
            )}
          </span>

          {/* the badge springs in and out rather than blinking */}
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                key="badge"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={spring.snappy}
                className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground shadow-sm"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.button>
  );
}
