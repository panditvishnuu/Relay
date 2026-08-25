import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PresenceAvatar } from '@/components/common/PresenceAvatar';
import { useAuthStore } from '@/store/auth';
import { errorMessage } from '@/lib/api';
import { MAX_UPLOAD_BYTES, formatBytes, isImage, uploadFile } from '@/lib/upload';

const MAX_STATUS = 140;

export function ProfileDialog({ open, onOpenChange }) {
  const me = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const [name, setName] = useState('');
  const [statusText, setStatusText] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  // reset from the store each time it opens, so a cancelled edit doesn't persist
  useEffect(() => {
    if (!open || !me) return;
    setName(me.name ?? '');
    setStatusText(me.statusText ?? '');
    setAvatarUrl(me.avatarUrl ?? '');
    setPreview(null);
  }, [open, me]);

  async function pickAvatar(event) {
    const file = event.target.files?.[0];
    event.target.value = ''; // let the same file be re-picked after a failure
    if (!file) return;

    if (!isImage(file.type)) return toast.error('Choose an image file');
    if (file.size > MAX_UPLOAD_BYTES) {
      return toast.error(`That image is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_UPLOAD_BYTES)}`);
    }

    // show it immediately; the upload catches up
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);

    try {
      const { attachment } = await uploadFile(file);
      setAvatarUrl(attachment.url);
    } catch (err) {
      setPreview(null);
      toast.error(errorMessage(err, 'Could not upload that image'));
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localUrl);
    }
  }

  const dirty =
    name.trim() !== (me?.name ?? '') ||
    statusText.trim() !== (me?.statusText ?? '') ||
    avatarUrl !== (me?.avatarUrl ?? '');

  async function save() {
    if (!dirty || saving || uploading) return;
    if (name.trim().length < 2) return toast.error('Name must be at least 2 characters');

    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), statusText: statusText.trim(), avatarUrl });
      toast.success('Profile updated');
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save your profile'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Your profile</DialogTitle>
          <DialogDescription>Everyone you chat with sees this.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-2 py-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label="Change profile picture"
            className="group relative rounded-full"
          >
            <PresenceAvatar name={name || me?.name || ''} src={preview ?? avatarUrl} online size="xl" />

            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
              {uploading ? <Loader2 className="size-6 animate-spin" /> : <Camera className="size-6" />}
            </span>

            {uploading && (
              <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50 text-white">
                <Loader2 className="size-6 animate-spin" />
              </span>
            )}
          </button>

          <p className="text-xs text-muted-foreground">
            {uploading ? 'Uploading…' : 'Tap the picture to change it'}
          </p>

          <input ref={fileRef} type="file" accept="image/*" onChange={pickAvatar} className="hidden" />
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Display name</Label>
            <Input
              id="profile-name"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="profile-status">Status</Label>
              <span className="text-xs text-muted-foreground">
                {statusText.length}/{MAX_STATUS}
              </span>
            </div>
            <Input
              id="profile-status"
              value={statusText}
              maxLength={MAX_STATUS}
              placeholder="Hey there! I am on Relay."
              onChange={(e) => setStatusText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              className="h-11"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {me?.email} — your email can’t be changed.
          </p>

          <Button
            onClick={save}
            disabled={!dirty || saving || uploading}
            className="brand-gradient h-11 w-full text-white"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
