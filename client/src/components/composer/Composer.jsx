import { useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { ImagePlus, Paperclip, Smile } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EmojiPicker } from './EmojiPicker';
import { AttachmentDraft } from './AttachmentDraft';
import { SendButton } from './SendButton';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { getSocket } from '@/lib/socket';
import { errorMessage } from '@/lib/api';
import { MAX_UPLOAD_BYTES, formatBytes, uploadFile } from '@/lib/upload';

const MAX_ROWS_PX = 140;
const TYPING_IDLE_MS = 2000;

export function Composer({ conversationId, onSend }) {
  const [value, setValue] = useState('');
  const [draft, setDraft] = useState(null); // { file, progress, error, uploaded }
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const textareaRef = useRef(null);
  const typingRef = useRef(false);
  const idleTimer = useRef(null);
  const abortRef = useRef(null);

  const canSend = (value.trim().length > 0 || draft?.uploaded) && !sending;

  // ------------------------------------------------------------- typing

  /**
   * One typing:start on the leading edge, then a trailing typing:stop after
   * two idle seconds — so a fast typist sends two events for a whole message,
   * not one per keystroke.
   */
  function signalTyping() {
    const socket = getSocket();
    if (!socket?.connected || !conversationId) return;

    if (!typingRef.current) {
      typingRef.current = true;
      socket.emit('typing:start', { conversationId });
    }
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  }

  function stopTyping() {
    clearTimeout(idleTimer.current);
    if (!typingRef.current) return;
    typingRef.current = false;
    getSocket()?.emit('typing:stop', { conversationId });
  }

  // switching threads must not leave a stuck indicator or a half-done upload
  useEffect(() => {
    return () => {
      stopTyping();
      abortRef.current?.abort();
    };
  }, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------- uploads

  async function stageFile(file) {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`“${file.name}” is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_UPLOAD_BYTES)}`);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setDraft({ file, progress: 0 });

    try {
      const result = await uploadFile(file, {
        signal: controller.signal,
        onProgress: (progress) => setDraft((d) => (d?.file === file ? { ...d, progress } : d)),
      });
      setDraft((d) => (d?.file === file ? { ...d, progress: 100, uploaded: result } : d));
    } catch (err) {
      if (controller.signal.aborted) return;
      setDraft((d) => (d?.file === file ? { ...d, error: errorMessage(err, 'Upload failed') } : d));
      toast.error(errorMessage(err, 'Upload failed'));
    }
  }

  function clearDraft() {
    abortRef.current?.abort();
    setDraft(null);
  }

  // whole-composer drop target; noClick so it doesn't hijack textarea clicks
  const { getRootProps, getInputProps, open: openFilePicker, isDragActive } = useDropzone({
    onDrop: (files) => stageFile(files[0]),
    noClick: true,
    noKeyboard: true,
    multiple: false,
    maxSize: MAX_UPLOAD_BYTES,
  });

  // ------------------------------------------------------------- sending

  async function submit() {
    if (!canSend) return;

    // a still-uploading attachment would send a message pointing at nothing
    if (draft && !draft.uploaded) {
      toast.error(draft.error ? 'That upload failed — remove it or try again' : 'Still uploading…');
      return;
    }

    setSending(true);
    stopTyping();
    try {
      await onSend?.({
        text: value.trim(),
        attachment: draft?.uploaded?.attachment,
        type: draft?.uploaded?.type,
      });
      setValue('');
      setDraft(null);
      requestAnimationFrame(() => autoResize(textareaRef.current));
    } finally {
      setSending(false);
    }
  }

  function autoResize(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_ROWS_PX)}px`;
  }

  function handleKeyDown(e) {
    // Enter sends, Shift+Enter newlines — but never on mobile keyboards
    if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(min-width: 768px)').matches) {
      e.preventDefault();
      submit();
    }
  }

  function insertEmoji(emoji) {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const next = value.slice(0, start) + emoji + value.slice(el?.selectionEnd ?? value.length);
    setValue(next);
    setEmojiOpen(false);

    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
      autoResize(el);
    });
  }

  // paste an image straight from the clipboard
  function handlePaste(e) {
    const file = [...(e.clipboardData?.files ?? [])][0];
    if (file) {
      e.preventDefault();
      stageFile(file);
    }
  }

  return (
    <div
      {...getRootProps()}
      className="relative border-t bg-card/80 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:px-4 sm:pb-3"
    >
      <input {...getInputProps()} />

      <AnimatePresence>
        {isDragActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={spring.snappy}
            className="absolute inset-2 z-10 grid place-items-center rounded-2xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm"
          >
            <motion.p
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              className="flex items-center gap-2 text-sm font-semibold text-primary"
            >
              <ImagePlus className="size-5" /> Drop to attach
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      <AttachmentDraft
        file={draft?.file}
        progress={draft?.progress}
        error={draft?.error}
        onCancel={clearDraft}
      />

      <div className="flex items-end gap-1.5 rounded-3xl border bg-background px-2 py-1.5 shadow-sm transition-shadow focus-within:border-ring/60 focus-within:shadow-md">
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Emoji" className="size-10 shrink-0 rounded-full text-muted-foreground">
              <Smile className="size-[20px]" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" side="top" className="w-auto border-none p-0 shadow-xl">
            <EmojiPicker onSelect={insertEmoji} />
          </PopoverContent>
        </Popover>

        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            autoResize(e.target);
            e.target.value.trim() ? signalTyping() : stopTyping();
          }}
          onPaste={handlePaste}
          onBlur={stopTyping}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          aria-label="Message"
          className="max-h-[140px] min-h-10 flex-1 resize-none bg-transparent py-2.5 text-[15px] leading-snug placeholder:text-muted-foreground focus:outline-none scrollbar-thin"
        />

        <Button
          variant="ghost"
          size="icon"
          onClick={openFilePicker}
          aria-label="Attach file"
          className="size-10 shrink-0 rounded-full text-muted-foreground"
        >
          <Paperclip className="size-[20px]" />
        </Button>

        <SendButton canSend={canSend} onClick={submit} />
      </div>
    </div>
  );
}
