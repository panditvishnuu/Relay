import { useState } from 'react';
import { Bell, Check, ChevronRight, LogOut, Pencil, Star, UserMinus, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { PresenceAvatar } from '@/components/common/PresenceAvatar';
import { AddMembersDialog } from '@/components/groups/AddMembersDialog';
import { SharedMedia } from './SharedMedia';
import { conversationIdentity } from '@/lib/conversation';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/store/chat';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';

function Row({ icon: Icon, title, subtitle, action, disabled, destructive, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-accent/60',
        'disabled:opacity-60 disabled:hover:bg-transparent',
        destructive && 'text-destructive hover:bg-destructive/10'
      )}
    >
      <Icon className={cn('size-[18px] shrink-0', destructive ? 'text-destructive' : 'text-muted-foreground')} />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold">{title}</span>
        {subtitle && <span className="block text-xs text-muted-foreground">{subtitle}</span>}
      </span>
      {action ?? (!destructive && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />)}
    </button>
  );
}

/** Inline rename — no modal for a single text field. */
function GroupTitle({ conversation, canEdit }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(conversation.name ?? '');
  const [saving, setSaving] = useState(false);
  const renameGroup = useChatStore((s) => s.renameGroup);

  async function save() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === conversation.name) return setEditing(false);

    setSaving(true);
    try {
      await renameGroup(conversation._id, trimmed);
      setEditing(false);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not rename the group'));
      setValue(conversation.name ?? '');
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5">
        <h3 className="text-lg font-bold">{conversation.name}</h3>
        {canEdit && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Rename group"
            onClick={() => { setValue(conversation.name ?? ''); setEditing(true); }}
            className="size-7 rounded-full text-muted-foreground"
          >
            <Pencil className="size-3.5" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex w-full items-center gap-1.5">
      <Input
        autoFocus
        value={value}
        disabled={saving}
        maxLength={60}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="h-9 text-center font-semibold"
      />
      <Button size="icon" onClick={save} disabled={saving} aria-label="Save name" className="size-9 shrink-0">
        <Check className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => setEditing(false)} aria-label="Cancel" className="size-9 shrink-0">
        <X className="size-4" />
      </Button>
    </div>
  );
}

export function DetailsPanel({ conversation, onClose, showClose = true }) {
  const [addOpen, setAddOpen] = useState(false);
  const { name, avatarUrl, peerId, statusText, isGroup } = conversationIdentity(conversation);

  const myId = useAuthStore((s) => s.user?._id);
  const online = useChatStore((s) => (peerId ? s.onlineUserIds.has(String(peerId)) : false));
  const onlineUserIds = useChatStore((s) => s.onlineUserIds);
  const removeGroupMember = useChatStore((s) => s.removeGroupMember);
  const closeConversation = useUIStore((s) => s.closeConversation);

  const members = conversation.members ?? [];
  const isAdmin = isGroup && members.find((m) => String(m._id) === String(myId))?.role === 'admin';

  async function remove(member) {
    try {
      await removeGroupMember(conversation._id, member._id);
      toast.success(`${member.name.split(' ')[0]} removed`);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not remove them'));
    }
  }

  async function leave() {
    try {
      await removeGroupMember(conversation._id, myId);
      toast.success(`You left “${conversation.name}”`);
      closeConversation();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not leave the group'));
    }
  }

  return (
    <aside className="flex h-full min-h-0 flex-col bg-card">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        {showClose && (
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close details" className="size-9 rounded-full text-primary">
            <X className="size-[18px]" />
          </Button>
        )}
        <div className="min-w-0">
          <p className="text-[15px] leading-tight font-bold">{isGroup ? 'Group details' : 'Contact details'}</p>
          <p className="truncate text-xs text-muted-foreground">
            {isGroup ? `${members.length} members` : `${name.split(' ')[0]}’s details`}
          </p>
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1 scrollbar-thin">
        <div className="px-4 pb-8">
          <div className="flex flex-col items-center gap-3 py-7">
            {isGroup ? (
              <div className="brand-gradient grid size-24 place-items-center rounded-3xl text-3xl font-extrabold text-white shadow-lg">
                {name.slice(0, 2).toUpperCase()}
              </div>
            ) : (
              <PresenceAvatar name={name} src={avatarUrl} online={online} size="xl" />
            )}

            <div className="flex w-full flex-col items-center text-center">
              {isGroup ? (
                <GroupTitle conversation={conversation} canEdit={isAdmin} />
              ) : (
                <h3 className="text-lg font-bold">{name}</h3>
              )}
              <p className="mt-0.5 text-sm text-muted-foreground">
                {isGroup ? `${members.length} members` : statusText}
              </p>
              {!isGroup && (
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  {online ? <span className="text-online">● Online now</span> : 'Offline'}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {isGroup && (
            <>
              <div className="py-3">
                <div className="flex items-center justify-between px-3 pb-1">
                  <p className="text-xs font-semibold text-primary">Members</p>
                  {isAdmin && (
                    <Button variant="ghost" size="sm" onClick={() => setAddOpen(true)} className="h-7 text-xs text-primary">
                      <UserPlus className="size-3.5" /> Add
                    </Button>
                  )}
                </div>

                {members.map((member) => {
                  const isMe = String(member._id) === String(myId);
                  return (
                    <div key={member._id} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-accent/60">
                      <PresenceAvatar
                        name={member.name}
                        src={member.avatarUrl}
                        online={onlineUserIds.has(String(member._id))}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold">
                          {member.name}
                          {isMe && <span className="ml-1 text-xs font-normal text-muted-foreground">(you)</span>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{member.statusText}</p>
                      </div>

                      {member.role === 'admin' && (
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                          ADMIN
                        </span>
                      )}

                      {/* admins can remove anyone but themselves — leaving is a separate action */}
                      {isAdmin && !isMe && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(member)}
                          aria-label={`Remove ${member.name}`}
                          className="size-8 shrink-0 rounded-full text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-destructive"
                        >
                          <UserMinus className="size-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
              <Separator />
            </>
          )}

          <div className="py-2">
            {/* these light up in chunk 6 */}
            <Row icon={Bell} title="Notifications" subtitle="Coming soon" disabled />
            <Row icon={Star} title="Starred messages" subtitle="Coming soon" disabled />
            <div className="px-1 pt-2">
              <p className="px-2 pb-2 text-xs font-semibold text-primary">Shared media</p>
              <SharedMedia conversationId={conversation._id} />
            </div>

            {isGroup && (
              <>
                <Separator className="my-2" />
                <Row icon={LogOut} title="Leave group" destructive onClick={leave} />
              </>
            )}
          </div>
        </div>
      </ScrollArea>

      {isGroup && <AddMembersDialog open={addOpen} onOpenChange={setAddOpen} conversation={conversation} />}
    </aside>
  );
}
