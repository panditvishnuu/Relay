import { useMemo, useState } from 'react';
import { Check, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PresenceAvatar } from '@/components/common/PresenceAvatar';
import { conversationIdentity } from '@/lib/conversation';
import { quotePreview } from './ReplyQuote';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/store/chat';

const MAX_TARGETS = 10;

/** Pick up to ten existing conversations to copy a message into. */
export function ForwardDialog({ message, open, onOpenChange }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);
  const [sending, setSending] = useState(false);

  const conversations = useChatStore((s) => s.conversations);
  const forwardMessage = useChatStore((s) => s.forwardMessage);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => conversationIdentity(c).name.toLowerCase().includes(q));
  }, [query, conversations]);

  function toggle(id) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : current.length >= MAX_TARGETS
          ? (toast.error(`You can forward to at most ${MAX_TARGETS} chats at once`), current)
          : [...current, id]
    );
  }

  function close(next) {
    onOpenChange(next);
    if (!next) setTimeout(() => { setSelected([]); setQuery(''); }, 200);
  }

  async function submit() {
    if (!selected.length || sending) return;
    setSending(true);
    try {
      const delivered = await forwardMessage(message._id, selected);
      toast.success(delivered.length === 1 ? 'Forwarded' : `Forwarded to ${delivered.length} chats`);
      close(false);
    } catch (err) {
      toast.error(err.message ?? 'Could not forward that message');
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Forward message</DialogTitle>
          <DialogDescription className="truncate">
            {message ? quotePreview({ ...message, senderName: null }) : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="border-b p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your chats"
              className="h-11 rounded-full border-transparent bg-muted pl-10 shadow-none focus-visible:bg-background"
            />
          </div>
        </div>

        <ScrollArea className="max-h-72 scrollbar-thin">
          <div className="space-y-0.5 p-2">
            {filtered.map((conversation) => {
              const { name, avatarUrl, isGroup } = conversationIdentity(conversation);
              const isSelected = selected.includes(conversation._id);

              return (
                <button
                  key={conversation._id}
                  type="button"
                  onClick={() => toggle(conversation._id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-accent/60',
                    isSelected && 'bg-accent/40'
                  )}
                >
                  <PresenceAvatar name={name} src={avatarUrl} showPresence={!isGroup} />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{name}</span>
                  <span
                    className={cn(
                      'grid size-5 shrink-0 place-items-center rounded-full border transition-colors',
                      isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                    )}
                  >
                    {isSelected && <Check className="size-3" />}
                  </span>
                </button>
              );
            })}

            {filtered.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No chats match that.</p>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-3">
          <Button className="w-full" disabled={!selected.length || sending} onClick={submit}>
            {sending && <Loader2 className="size-4 animate-spin" />}
            {sending ? 'Forwarding…' : `Forward${selected.length ? ` to ${selected.length}` : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
