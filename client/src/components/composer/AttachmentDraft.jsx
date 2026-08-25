import { useEffect, useState } from 'react';
import { FileText, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatBytes, isImage } from '@/lib/upload';
import { cn } from '@/lib/utils';

/**
 * The staged file above the composer, before it's sent. Shows a local preview
 * (object URL, so nothing waits on the network) with an upload progress ring.
 */
export function AttachmentDraft({ file, progress, error, onCancel }) {
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!file || !isImage(file.type)) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!file) return null;
  const uploading = progress != null && progress < 100 && !error;

  return (
    <div className="mx-2 mb-2 flex items-center gap-3 rounded-2xl border bg-muted/50 p-2 sm:mx-4">
      <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-background">
        {previewUrl ? (
          <img src={previewUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <FileText className="size-6" />
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 grid place-items-center bg-black/50 text-white">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{file.name}</p>
        <p className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>
          {error ?? (uploading ? `Uploading… ${progress}%` : formatBytes(file.size))}
        </p>

        {uploading && (
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-border">
            <div
              className="brand-gradient h-full rounded-full transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={onCancel}
        aria-label="Remove attachment"
        className="size-9 shrink-0 rounded-full text-muted-foreground"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
