import { useState } from 'react';
import { Ban, Eraser, MoreVertical, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { conversationIdentity } from '@/lib/conversation';
import { errorMessage } from '@/lib/api';
import { useChatStore } from '@/store/chat';
import { useUIStore } from '@/store/ui';

/**
 * Destructive conversation actions. Each one confirms first — every option in
 * here loses data or cuts someone off, and none of them is undoable.
 */
export function ConversationActions({ conversation, onOpenDetails }) {
  const [confirm, setConfirm] = useState(null); // 'clear' | 'delete' | 'block'
  const [busy, setBusy] = useState(false);

  const { name, peerId, isGroup } = conversationIdentity(conversation);
  const clearConversation = useChatStore((s) => s.clearConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const setBlocked = useChatStore((s) => s.setBlocked);
  const closeConversation = useUIStore((s) => s.closeConversation);

  const copy = {
    clear: {
      title: `Clear this chat?`,
      body: `Every message in “${name}” will be hidden from your view. The other side keeps their copy, and new messages still arrive.`,
      action: 'Clear chat',
    },
    delete: {
      title: `Delete this chat?`,
      body: `“${name}” disappears from your list and its history is hidden for you. The other person keeps theirs, and the chat reappears if they message you again.`,
      action: 'Delete chat',
    },
    block: {
      title: `Block ${name}?`,
      body: `Neither of you will be able to message the other until you unblock them. They aren’t told.`,
      action: 'Block',
    },
  }[confirm] ?? {};

  async function run() {
    setBusy(true);
    try {
      if (confirm === 'clear') {
        await clearConversation(conversation._id);
        toast.success('Chat cleared');
      } else if (confirm === 'delete') {
        await deleteConversation(conversation._id);
        closeConversation();
        toast.success('Chat deleted');
      } else if (confirm === 'block') {
        await setBlocked(peerId, true);
        toast.success(`${name.split(' ')[0]} blocked`);
      }
      setConfirm(null);
    } catch (err) {
      toast.error(errorMessage(err, 'That didn’t work'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Chat menu" className="size-10 rounded-full text-muted-foreground">
            <MoreVertical className="size-[18px]" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={onOpenDetails}>
            <UserRound /> {isGroup ? 'Group details' : 'Contact details'}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={() => setConfirm('clear')}>
            <Eraser /> Clear messages
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirm('delete')}>
            <Trash2 /> Delete chat
          </DropdownMenuItem>

          {!isGroup && (
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirm('block')}>
              <Ban /> Block {name.split(' ')[0]}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={Boolean(confirm)} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault(); // keep it open until the request settles
                run();
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {busy ? 'Working…' : copy.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
