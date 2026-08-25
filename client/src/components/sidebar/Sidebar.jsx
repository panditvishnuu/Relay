import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, MoreVertical, Search, SquarePen, User, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PresenceAvatar } from '@/components/common/PresenceAvatar';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { ConversationItem } from './ConversationItem';
import { NewChatDialog } from './NewChatDialog';
import { CreateGroupDialog } from '@/components/groups/CreateGroupDialog';
import { ProfileDialog } from '@/components/profile/ProfileDialog';
import { conversationIdentity } from '@/lib/conversation';
import { listContainer } from '@/lib/motion';
import { useAuthStore } from '@/store/auth';
import { useChatStore } from '@/store/chat';

function ListSkeleton() {
  return (
    <div className="space-y-1 px-3 py-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-1 py-3" style={{ opacity: 1 - i * 0.13 }}>
          <Skeleton className="size-11 shrink-0 rounded-full shimmer" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2 shimmer" />
            <Skeleton className="h-3 w-3/4 shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Sidebar({ activeId, onSelect }) {
  const [query, setQuery] = useState('');
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const me = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const conversations = useChatStore((s) => s.conversations);
  const loaded = useChatStore((s) => s.conversationsLoaded);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const { name } = conversationIdentity(c);
      return name.toLowerCase().includes(q) || (c.lastMessage?.text ?? '').toLowerCase().includes(q);
    });
  }, [query, conversations]);

  async function handleLogout() {
    await logout();
    toast.success('Signed out');
  }

  return (
    <aside className="flex h-full min-h-0 flex-col bg-card">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 text-left transition-colors hover:bg-accent/50"
          aria-label="Edit your profile"
        >
          <PresenceAvatar name={me?.name ?? ''} src={me?.avatarUrl} online />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] leading-tight font-bold">{me?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{me?.statusText ?? 'Online'}</p>
          </div>
        </button>

        <ThemeToggle />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setNewChatOpen(true)}
              className="size-10 rounded-full text-primary"
              aria-label="New chat"
            >
              <SquarePen className="size-[18px]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New chat</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-10 rounded-full text-muted-foreground" aria-label="Menu">
              <MoreVertical className="size-[18px]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
              <User /> Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setNewChatOpen(true)}>New chat</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setNewGroupOpen(true)}>New group</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="border-b px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats and messages"
            aria-label="Search conversations"
            className="h-11 rounded-full border-transparent bg-muted pr-10 pl-10 text-[14px] shadow-none focus-visible:border-ring focus-visible:bg-background"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-accent"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 scrollbar-thin">
        {!loaded ? (
          <ListSkeleton />
        ) : (
          <motion.div
            variants={listContainer}
            initial="initial"
            animate="animate"
            className="space-y-0.5 px-2 py-2"
          >
            <AnimatePresence initial={false}>
              {filtered.map((c) => (
                <ConversationItem key={c._id} conversation={c} active={c._id === activeId} onSelect={onSelect} />
              ))}
            </AnimatePresence>

            {filtered.length === 0 && (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  {query ? `No chats match “${query}”.` : 'No conversations yet.'}
                </p>
                {!query && (
                  <div className="mt-4 flex justify-center gap-2">
                    <Button onClick={() => setNewChatOpen(true)} size="sm">
                      <SquarePen /> Start a chat
                    </Button>
                    <Button onClick={() => setNewGroupOpen(true)} size="sm" variant="outline">
                      <Users /> New group
                    </Button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </ScrollArea>

      <NewChatDialog open={newChatOpen} onOpenChange={setNewChatOpen} onOpened={onSelect} />
      <CreateGroupDialog open={newGroupOpen} onOpenChange={setNewGroupOpen} onCreated={onSelect} />
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </aside>
  );
}
