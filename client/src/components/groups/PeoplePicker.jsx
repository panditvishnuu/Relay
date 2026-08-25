import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PresenceAvatar } from '@/components/common/PresenceAvatar';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/store/chat';

/**
 * Debounced user search with multi-select chips. Shared by "new group" and
 * "add members", which differ only in which ids they exclude.
 */
export function PeoplePicker({ selected, onChange, excludeIds = [], placeholder = 'Search people' }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const onlineUserIds = useChatStore((s) => s.onlineUserIds);

  const excluded = useMemo(() => new Set(excludeIds.map(String)), [excludeIds]);
  const selectedIds = useMemo(() => new Set(selected.map((u) => String(u._id))), [selected]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/users', {
          params: { search: query.trim(), limit: 30 },
          signal: controller.signal,
        });
        setUsers(data.users);
      } catch {
        /* aborted or offline — keep the previous list */
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function toggle(user) {
    onChange(
      selectedIds.has(String(user._id))
        ? selected.filter((u) => String(u._id) !== String(user._id))
        : [...selected, user]
    );
  }

  const visible = users.filter((u) => !excluded.has(String(u._id)));

  return (
    <div className="flex min-h-0 flex-col">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b px-3 py-2.5">
          {selected.map((user) => (
            <span
              key={user._id}
              className="flex items-center gap-1.5 rounded-full bg-accent py-1 pr-1 pl-1.5 text-xs font-medium"
            >
              <PresenceAvatar name={user.name} src={user.avatarUrl} showPresence={false} size="sm" className="[&>span]:size-6" />
              {user.name.split(' ')[0]}
              <button
                type="button"
                onClick={() => toggle(user)}
                aria-label={`Remove ${user.name}`}
                className="grid size-5 place-items-center rounded-full hover:bg-background"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="border-b p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="h-11 rounded-full border-transparent bg-muted pr-10 pl-10 shadow-none focus-visible:bg-background"
          />
          {loading && (
            <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      <ScrollArea className="max-h-64 min-h-0 flex-1 scrollbar-thin">
        <div className="space-y-0.5 p-2">
          {visible.map((user) => {
            const isSelected = selectedIds.has(String(user._id));
            return (
              <button
                key={user._id}
                type="button"
                onClick={() => toggle(user)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-accent/60',
                  isSelected && 'bg-accent/40'
                )}
              >
                <PresenceAvatar name={user.name} src={user.avatarUrl} online={onlineUserIds.has(String(user._id))} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.statusText}</p>
                </div>
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

          {!loading && visible.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {query ? `Nobody matches “${query}”.` : 'No one else to add.'}
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
