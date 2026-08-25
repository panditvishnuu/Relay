import { Download, FileText } from 'lucide-react';
import { formatBytes } from '@/lib/upload';
import { cn } from '@/lib/utils';

/**
 * Images render inline with their aspect ratio reserved up front, so the thread
 * doesn't reflow as they decode. Everything else becomes a download card.
 */
export function MessageAttachment({ message, own, onOpenImage }) {
  const { attachment, type } = message;
  if (!attachment?.url) return null;

  if (type === 'image') {
    const ratio = attachment.width && attachment.height ? attachment.width / attachment.height : 4 / 3;

    return (
      <button
        type="button"
        onClick={() => onOpenImage?.(message)}
        className="group block w-full overflow-hidden rounded-xl bg-muted"
        aria-label={`Open image ${attachment.name ?? ''}`}
      >
        <img
          src={attachment.url}
          alt={attachment.name ?? 'Shared image'}
          loading="lazy"
          style={{ aspectRatio: ratio }}
          className="max-h-80 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </button>
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      download={attachment.name}
      className={cn(
        'flex items-center gap-3 rounded-xl border p-2.5 transition-colors',
        own ? 'border-white/25 bg-white/10 hover:bg-white/20' : 'bg-background hover:bg-accent/60'
      )}
    >
      <span
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-lg',
          own ? 'bg-white/20' : 'bg-muted'
        )}
      >
        <FileText className="size-5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold">{attachment.name}</span>
        <span className={cn('block text-xs', own ? 'text-white/70' : 'text-muted-foreground')}>
          {formatBytes(attachment.size)}
        </span>
      </span>

      <Download className="size-4 shrink-0 opacity-70" />
    </a>
  );
}
