import { Copy, CornerUpLeft, Download, Forward, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const EDIT_WINDOW_MS = 15 * 60 * 1000;
const DELETE_EVERYONE_WINDOW_MS = 60 * 60 * 1000;

/** Downloads a URL as a file rather than navigating to it. */
async function downloadFile(url, filename) {
  try {
    // fetch → blob so cross-origin (Cloudinary) URLs still download instead of
    // opening in a tab, which is what a bare `download` attribute does there
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename || 'download';
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(objectUrl);
    toast.success('Saved');
  } catch {
    // popup blockers and CORS failures both land here
    window.open(url, '_blank', 'noopener');
  }
}

export function MessageMenu({ message, own, onReply, onEdit, onDelete, onForward }) {
  const age = Date.now() - new Date(message.createdAt).getTime();
  const canEdit = own && message.type === 'text' && age < EDIT_WINDOW_MS;
  const canDeleteForEveryone = own && age < DELETE_EVERYONE_WINDOW_MS;
  const attachment = message.attachment;

  async function copyText() {
    try {
      await navigator.clipboard.writeText(message.text ?? '');
      toast.success('Copied');
    } catch {
      toast.error('Could not copy — your browser blocked clipboard access');
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Message options"
          className="size-7 rounded-full text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align={own ? 'end' : 'start'} className="w-52">
        <DropdownMenuItem onSelect={() => onReply(message)}>
          <CornerUpLeft /> Reply
        </DropdownMenuItem>

        {message.text && (
          <DropdownMenuItem onSelect={copyText}>
            <Copy /> Copy text
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onSelect={() => onForward(message)}>
          <Forward /> Forward
        </DropdownMenuItem>

        {attachment?.url && (
          <DropdownMenuItem onSelect={() => downloadFile(attachment.url, attachment.name)}>
            <Download /> Download
          </DropdownMenuItem>
        )}

        {canEdit && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onEdit(message)}>
              <Pencil /> Edit
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />

        {/* two very different outcomes, so they're never one click apart */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="text-destructive focus:text-destructive">
            <Trash2 className="text-destructive" /> Delete
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onSelect={() => onDelete(message, 'me')}>Delete for me</DropdownMenuItem>
            {canDeleteForEveryone && (
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(message, 'everyone')}>
                Delete for everyone
              </DropdownMenuItem>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { downloadFile };
