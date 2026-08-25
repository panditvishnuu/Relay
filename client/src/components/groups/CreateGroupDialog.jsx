import { useState } from 'react';
import { ArrowLeft, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PeoplePicker } from './PeoplePicker';
import { useChatStore } from '@/store/chat';
import { useAuthStore } from '@/store/auth';
import { errorMessage } from '@/lib/api';

/** Two steps: pick people, then name it. Keeps each screen to one decision. */
export function CreateGroupDialog({ open, onOpenChange, onCreated }) {
  const [step, setStep] = useState('members');
  const [selected, setSelected] = useState([]);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const myId = useAuthStore((s) => s.user?._id);
  const createGroup = useChatStore((s) => s.createGroup);

  function close(nextOpen) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      // reset so reopening doesn't resume a half-finished group
      setTimeout(() => {
        setStep('members');
        setSelected([]);
        setName('');
      }, 200);
    }
  }

  async function submit() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const conversation = await createGroup({
        name: name.trim(),
        memberIds: selected.map((u) => u._id),
      });
      toast.success(`“${conversation.name}” created`);
      close(false);
      onCreated?.(conversation._id);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not create the group'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="flex-row items-center gap-2 space-y-0 border-b px-4 py-3.5">
          {step === 'name' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setStep('members')}
              aria-label="Back to member selection"
              className="size-8 shrink-0 rounded-full"
            >
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <div className="min-w-0 text-left">
            <DialogTitle>New group</DialogTitle>
            <DialogDescription>
              {step === 'members'
                ? selected.length
                  ? `${selected.length} selected`
                  : 'Choose who to add'
                : 'Give the group a name'}
            </DialogDescription>
          </div>
        </DialogHeader>

        {step === 'members' ? (
          <>
            <PeoplePicker
              selected={selected}
              onChange={setSelected}
              excludeIds={[myId]}
              placeholder="Search people to add"
            />
            <div className="border-t p-3">
              <Button className="w-full" disabled={selected.length === 0} onClick={() => setStep('name')}>
                Next
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <div className="brand-gradient grid size-14 shrink-0 place-items-center rounded-2xl text-white shadow-md">
                <Users className="size-6" />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="group-name">Group name</Label>
                <Input
                  id="group-name"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  placeholder="Weekend plans"
                  maxLength={60}
                  className="h-11"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {selected.map((u) => u.name).join(', ')} — plus you.
            </p>

            <Button className="brand-gradient w-full text-white" disabled={!name.trim() || saving} onClick={submit}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving ? 'Creating…' : 'Create group'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
