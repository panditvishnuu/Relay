import { memo, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Ban, Check, CheckCheck, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { messageTime } from '@/lib/format';
import { messageVariants, spring } from '@/lib/motion';
import { MessageAttachment } from './MessageAttachment';
import { ReactionBar, ReactionPills } from './Reactions';
import { MessageMenu } from './MessageMenu';
import { ReplyQuote } from './ReplyQuote';

/**
 * pending → clock, sent → one tick, delivered → two grey, read → two blue.
 * The icon swap is cross-faded so the tick doesn't visibly pop when a receipt
 * lands — it reads as the same mark changing state.
 */
function Receipt({ status }) {
  const icon = {
    pending: <Clock className="size-3.5 opacity-70" />,
    failed: <AlertCircle className="size-3.5 text-destructive" />,
    sent: <Check className="size-3.5 opacity-70" />,
    delivered: <CheckCheck className="size-3.5 opacity-70" />,
    read: <CheckCheck className="size-3.5 text-sky-300" />,
  }[status];

  if (!icon) return null;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={status}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.6 }}
        transition={spring.snappy}
        className="inline-flex"
      >
        {icon}
      </motion.span>
    </AnimatePresence>
  );
}

/** Stable per-name colour so each group member reads as the same person. */
const NAME_COLORS = ['text-indigo-500', 'text-sky-500', 'text-emerald-500', 'text-amber-500', 'text-rose-500', 'text-violet-500'];
const nameColor = (name = '') =>
  NAME_COLORS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % NAME_COLORS.length];

/** Inline editor — Enter saves, Escape cancels. */
function EditBox({ message, onSave, onCancel }) {
  const [value, setValue] = useState(message.text ?? '');
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
  }, []);

  async function save() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === message.text) return onCancel();

    setSaving(true);
    try {
      await onSave(trimmed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex w-full items-end gap-1.5">
      <textarea
        ref={ref}
        rows={1}
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
          if (e.key === 'Escape') onCancel();
        }}
        className="max-h-32 min-w-[180px] flex-1 resize-none rounded-lg bg-black/10 px-2 py-1 text-[14.5px] focus:outline-none dark:bg-white/10"
      />
      <button type="button" onClick={save} disabled={saving} aria-label="Save edit" className="grid size-7 shrink-0 place-items-center rounded-full hover:bg-black/10 dark:hover:bg-white/10">
        <Check className="size-4" />
      </button>
      <button type="button" onClick={onCancel} aria-label="Cancel edit" className="grid size-7 shrink-0 place-items-center rounded-full hover:bg-black/10 dark:hover:bg-white/10">
        <X className="size-4" />
      </button>
    </div>
  );
}

function MessageBubbleImpl({
  message,
  own,
  status,
  showTail,
  showSender,
  senderName,
  myId,
  editing,
  onReact,
  onOpenImage,
  onReply,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onForward,
  onJumpTo,
  highlighted,
}) {
  const deleted = message.type === 'deleted';
  const failed = status === 'failed';
  const hasAttachment = Boolean(message.attachment?.url);
  // an image with no caption needs no bubble chrome around it
  const bare = hasAttachment && message.type === 'image' && !message.text && !message.replyTo;

  return (
    <motion.div
      id={`message-${message._id}`}
      custom={own}
      variants={messageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={cn(
        'group flex w-full items-center gap-1 px-1 transition-colors duration-500',
        own ? 'justify-end' : 'justify-start',
        // brief flash when a reply jumps you here, so you can find it
        highlighted && 'rounded-2xl bg-primary/10'
      )}
    >
      {own && !deleted && (
        <div className="order-first flex items-center gap-0.5">
          <MessageMenu
            message={message}
            own
            onReply={onReply}
            onEdit={onEdit}
            onDelete={onDelete}
            onForward={onForward}
          />
          {onReact && <div className="hidden sm:block"><ReactionBar onReact={onReact} own /></div>}
        </div>
      )}

      <div className={cn('flex max-w-[85%] flex-col sm:max-w-[70%]', own ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'relative text-[14.5px] leading-relaxed break-words shadow-sm transition-shadow hover:shadow-md',
            bare ? 'overflow-hidden rounded-2xl' : 'rounded-2xl px-3.5 py-2.5',
            deleted
              ? 'border border-dashed border-border bg-transparent text-muted-foreground italic'
              : own
                ? 'bg-bubble-out text-bubble-out-foreground'
                : 'border border-border/70 bg-bubble-in text-bubble-in-foreground',
            showTail && !deleted && (own ? 'rounded-br-md' : 'rounded-bl-md'),
            status === 'pending' && 'opacity-70',
            failed && 'ring-1 ring-destructive'
          )}
        >
          {showSender && !deleted && (
            <span className={cn('mb-0.5 block text-[12.5px] font-bold', bare && 'px-3 pt-2', nameColor(senderName))}>
              {senderName}
            </span>
          )}

          {deleted ? (
            <span className="flex items-center gap-1.5">
              <Ban className="size-3.5" /> This message was deleted
            </span>
          ) : editing ? (
            <EditBox message={message} onSave={onSaveEdit} onCancel={onCancelEdit} />
          ) : (
            <>
              <ReplyQuote reply={message.replyTo} own={own} onJump={onJumpTo} />

              {hasAttachment && (
                <div className={cn(!bare && 'mb-1.5', message.text && !bare && 'mb-2')}>
                  <MessageAttachment message={message} own={own} onOpenImage={onOpenImage} />
                </div>
              )}

              {message.text}
            </>
          )}
        </div>

        {!deleted && <ReactionPills reactions={message.reactions} myId={myId} onToggle={onReact} own={own} />}

        <div className="mt-1 flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
          <span>{failed ? 'Not sent' : messageTime(message.createdAt)}</span>
          {message.editedAt && !deleted && <span className="italic">· edited</span>}
          {own && !deleted && <Receipt status={status} />}
        </div>
      </div>

      {!own && !deleted && (
        <div className="flex items-center gap-0.5">
          {onReact && <div className="hidden sm:block"><ReactionBar onReact={onReact} /></div>}
          <MessageMenu
            message={message}
            onReply={onReply}
            onEdit={onEdit}
            onDelete={onDelete}
            onForward={onForward}
          />
        </div>
      )}
    </motion.div>
  );
}

/**
 * Long threads re-render on every keystroke of a typing indicator and on every
 * receipt. Memoising means only the bubbles that actually changed do any work.
 */
export const MessageBubble = memo(MessageBubbleImpl, (prev, next) =>
  prev.message === next.message &&
  prev.status === next.status &&
  prev.showTail === next.showTail &&
  prev.showSender === next.showSender &&
  prev.own === next.own &&
  prev.editing === next.editing &&
  prev.highlighted === next.highlighted
);
