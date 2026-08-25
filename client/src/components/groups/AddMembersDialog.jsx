import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PeoplePicker } from './PeoplePicker';
import { useChatStore } from '@/store/chat';
import { errorMessage } from '@/lib/api';

export function AddMembersDialog({ open, onOpenChange, conversation }) {
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const addGroupMembers = useChatStore((s) => s.addGroupMembers);

  const existingIds = (conversation?.members ?? []).map((m) => m._id);

  function close(nextOpen) {
    onOpenChange(nextOpen);
    if (!nextOpen) setTimeout(() => setSelected([]), 200);
  }

  async function submit() {
    if (!selected.length || saving) return;
    setSaving(true);
    try {
      await addGroupMembers(conversation._id, selected.map((u) => u._id));
      toast.success(selected.length === 1 ? `${selected[0].name} added` : `${selected.length} people added`);
      close(false);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not add those people'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Add members</DialogTitle>
          <DialogDescription>People already in the group are hidden.</DialogDescription>
        </DialogHeader>

        <PeoplePicker
          selected={selected}
          onChange={setSelected}
          excludeIds={existingIds}
          placeholder="Search people to add"
        />

        <div className="border-t p-3">
          <Button className="w-full" disabled={!selected.length || saving} onClick={submit}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? 'Adding…' : `Add ${selected.length || ''}`.trim()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
