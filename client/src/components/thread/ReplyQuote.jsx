import { FileText, ImageIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** One-line description of whatever is being quoted. */
export function quotePreview(reply) {
  if (!reply) return '';
  if (reply.type === 'deleted') return 'This message was deleted';
  if (reply.text) return reply.text;
  if (reply.type === 'image') return 'Photo';
  return reply.attachmentName ?? 'Attachment';
}

/**
 * The quote block above a bubble. Clicking it scrolls to the original — the
 * whole point of a reply is being able to find what it answers.
 */
export function ReplyQuote({ reply, own, onJump }) {
  if (!reply) return null;

  const Icon = reply.type === 'image' ? ImageIcon : reply.type === 'file' ? FileText : null;

  return (
    <button
      type="button"
      onClick={() => onJump?.(reply._id)}
      className={cn(
        'mb-1.5 flex w-full items-stretch gap-2 overflow-hidden rounded-lg text-left transition-colors',
        own ? 'bg-white/15 hover:bg-white/25' : 'bg-accent/70 hover:bg-accent'
      )}
    >
      <span className={cn('w-1 shrink-0 rounded-full', own ? 'bg-white/70' : 'bg-primary')} />
      <span className="min-w-0 flex-1 py-1 pr-2">
        <span className={cn('block text-[12px] font-bold', own ? 'text-white/90' : 'text-primary')}>
          {reply.senderName ?? 'Unknown'}
        </span>
        <span
          className={cn(
            'flex items-center gap-1 truncate text-[12.5px]',
            own ? 'text-white/75' : 'text-muted-foreground',
            reply.type === 'deleted' && 'italic'
          )}
        >
          {Icon && <Icon className="size-3 shrink-0" />}
          {quotePreview(reply)}
        </span>
      </span>
    </button>
  );
}

/** The strip above the composer while you're composing a reply. */
export function ReplyBar({ reply, onCancel }) {
  if (!reply) return null;

  return (
    <div className="mx-2 mb-2 flex items-stretch gap-2 overflow-hidden rounded-2xl border bg-muted/50 sm:mx-4">
      <span className="w-1 shrink-0 bg-primary" />
      <div className="min-w-0 flex-1 py-2">
        <p className="text-[12px] font-bold text-primary">
          Replying to {reply.senderName ?? 'message'}
        </p>
        <p className="truncate text-[13px] text-muted-foreground">{quotePreview(reply)}</p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel reply"
        className="grid w-10 shrink-0 place-items-center text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
