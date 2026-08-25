import { useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PresenceAvatar } from '@/components/common/PresenceAvatar';
import { useChatStore } from '@/store/chat';
import { api, errorMessage } from '@/lib/api';

/** Search every registered user and open a direct chat with one of them. */
export function NewChatDialog({ open, onOpenChange, onOpened }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const openDirect = useChatStore((s) => s.openDirect);
  const onlineUserIds = useChatStore((s) => s.onlineUserIds);

  // debounced search; an aborted request can't overwrite a newer one
  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/users', {
          params: { search: query.trim() },
          signal: controller.signal,
        });
        setUsers(data.users);
      } catch {
        /* aborted or offline — leave the previous list in place */
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  async function start(user) {
    setBusyId(user._id);
    try {
      const conversation = await openDirect(user._id);
      onOpenChange(false);
      setQuery('');
      onOpened?.(conversation._id);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not start that chat'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>New chat</DialogTitle>
          <DialogDescription>Search for someone on Relay to start a conversation.</DialogDescription>
        </DialogHeader>

        <div className="border-b p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email"
              className="h-11 rounded-full border-transparent bg-muted pr-10 pl-10 shadow-none focus-visible:bg-background"
            />
            {loading && (
              <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        <ScrollArea className="max-h-80 scrollbar-thin">
          <div className="space-y-0.5 p-2">
            {users.map((user) => (
              <button
                key={user._id}
                type="button"
                disabled={busyId === user._id}
                onClick={() => start(user)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-accent/60 disabled:opacity-60"
              >
                <PresenceAvatar name={user.name} src={user.avatarUrl} online={onlineUserIds.has(String(user._id))} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.statusText}</p>
                </div>
                {busyId === user._id && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              </button>
            ))}

            {!loading && users.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                {query ? `Nobody matches “${query}”.` : 'No other users have signed up yet.'}
              </p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
