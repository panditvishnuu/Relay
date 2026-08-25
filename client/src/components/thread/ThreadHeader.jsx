import { ArrowLeft, Phone, Search, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConversationActions } from './ConversationActions';
import { PresenceAvatar } from '@/components/common/PresenceAvatar';
import { conversationIdentity } from '@/lib/conversation';
import { useChatStore } from '@/store/chat';
import { cn } from '@/lib/utils';

export function ThreadHeader({ conversation, onBack, onOpenDetails, showBack, typingNames = [] }) {
  const { name, avatarUrl, peerId, isGroup } = conversationIdentity(conversation);
  const online = useChatStore((s) => (peerId ? s.onlineUserIds.has(String(peerId)) : false));

  // typing outranks presence in the subtitle — it's the more useful signal
  const subtitle = typingNames.length
    ? isGroup
      ? `${typingNames[0].split(' ')[0]} is typing…`
      : 'typing…'
    : isGroup
      ? `${conversation.members?.length ?? 0} members`
      : online
        ? 'Online'
        : 'Offline';

  return (
    <header className="glass-panel sticky top-0 z-10 flex items-center gap-2 border-b px-2 py-2.5 sm:px-4">
      {showBack && (
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to chats" className="size-10 rounded-full">
          <ArrowLeft className="size-5" />
        </Button>
      )}

      <button
        type="button"
        onClick={onOpenDetails}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left transition-colors hover:bg-accent/50"
      >
        <PresenceAvatar name={name} src={avatarUrl} online={online} showPresence={!isGroup} />
        <div className="min-w-0">
          <p className="truncate text-[15px] leading-tight font-bold">{name}</p>
          <p
            className={cn(
              'truncate text-xs transition-colors',
              typingNames.length ? 'font-medium text-primary' : 'text-muted-foreground'
            )}
          >
            {subtitle}
          </p>
        </div>
      </button>

      <div className="flex items-center">
        <Button variant="ghost" size="icon" aria-label="Search in chat" className="hidden size-10 rounded-full text-muted-foreground sm:inline-flex">
          <Search className="size-[18px]" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Voice call" className="hidden size-10 rounded-full text-muted-foreground sm:inline-flex">
          <Phone className="size-[18px]" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Video call" className="hidden size-10 rounded-full text-muted-foreground sm:inline-flex">
          <Video className="size-[18px]" />
        </Button>

        <ConversationActions conversation={conversation} onOpenDetails={onOpenDetails} />
      </div>
    </header>
  );
}
