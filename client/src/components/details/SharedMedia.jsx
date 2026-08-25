import { useEffect, useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import { FileText, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatBytes } from '@/lib/upload';

/**
 * Everything shared in a conversation. Fetched from its own endpoint rather
 * than filtered from loaded messages, so it covers the whole history and not
 * just the pages that happen to be in memory.
 */
export function SharedMedia({ conversationId }) {
  const [media, setMedia] = useState(null);
  const [index, setIndex] = useState(-1);

  useEffect(() => {
    let cancelled = false;
    setMedia(null);

    api
      .get(`/conversations/${conversationId}/media`)
      .then(({ data }) => !cancelled && setMedia(data.media))
      .catch(() => !cancelled && setMedia([]));

    return () => { cancelled = true; };
  }, [conversationId]);

  if (media === null) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!media.length) {
    return (
      <p className="px-3 py-8 text-center text-sm text-muted-foreground">
        Nothing shared in this conversation yet.
      </p>
    );
  }

  const images = media.filter((m) => m.type === 'image');
  const files = media.filter((m) => m.type !== 'image');

  return (
    <div className="space-y-4">
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {images.map((item, i) => (
            <button
              key={item._id}
              type="button"
              onClick={() => setIndex(i)}
              className="group aspect-square overflow-hidden rounded-lg bg-muted"
              aria-label={`Open ${item.attachment.name}`}
            >
              <img
                src={item.attachment.url}
                alt={item.attachment.name}
                loading="lazy"
                className="size-full object-cover transition-transform duration-300 group-hover:scale-110"
              />
            </button>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((item) => (
            <a
              key={item._id}
              href={item.attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              download={item.attachment.name}
              className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-accent/60"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <FileText className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium">{item.attachment.name}</span>
                <span className="block text-xs text-muted-foreground">{formatBytes(item.attachment.size)}</span>
              </span>
            </a>
          ))}
        </div>
      )}

      <Lightbox
        open={index >= 0}
        index={Math.max(index, 0)}
        close={() => setIndex(-1)}
        slides={images.map((m) => ({ src: m.attachment.url, title: m.attachment.name }))}
        controller={{ closeOnBackdropClick: true }}
      />
    </div>
  );
}
