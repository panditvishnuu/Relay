import { useMemo, useState } from 'react';
import { SmilePlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EmojiPicker, QUICK_REACTIONS } from '@/components/composer/EmojiPicker';
import { cn } from '@/lib/utils';

/** Groups the flat reaction list into [{ emoji, count, mine }]. */
export function summarise(reactions = [], myId) {
  const byEmoji = new Map();

  for (const { emoji, user } of reactions) {
    const entry = byEmoji.get(emoji) ?? { emoji, count: 0, mine: false };
    entry.count += 1;
    if (String(user) === String(myId)) entry.mine = true;
    byEmoji.set(emoji, entry);
  }

  return [...byEmoji.values()].sort((a, b) => b.count - a.count);
}

/** The pills under a bubble. Clicking yours removes it. */
export function ReactionPills({ reactions, myId, onToggle, own }) {
  const summary = useMemo(() => summarise(reactions, myId), [reactions, myId]);
  if (!summary.length) return null;

  return (
    <div className={cn('mt-1 flex flex-wrap gap-1', own ? 'justify-end' : 'justify-start')}>
      {summary.map(({ emoji, count, mine }) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onToggle(emoji)}
          aria-pressed={mine}
          className={cn(
            'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] leading-none transition-colors',
            'hover:bg-accent',
            mine ? 'border-primary/40 bg-primary/10 font-semibold text-primary' : 'bg-card'
          )}
        >
          <span className="text-[13px]">{emoji}</span>
          {count > 1 && <span>{count}</span>}
        </button>
      ))}
    </div>
  );
}

/**
 * Hover/long-press action bar. Six one-tap reactions plus the full picker —
 * the common cases stay one click away.
 */
export function ReactionBar({ onReact, own }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 rounded-full border bg-card p-1 shadow-md',
        // hidden until hover on pointer devices; always available via the menu on touch
        'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
        pickerOpen && 'opacity-100'
      )}
    >
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onReact(emoji)}
          aria-label={`React with ${emoji}`}
          className="grid size-7 place-items-center rounded-full text-[15px] transition-transform hover:scale-125 hover:bg-accent"
        >
          {emoji}
        </button>
      ))}

      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="More reactions"
            className="grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <SmilePlus className="size-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align={own ? 'end' : 'start'}
          className="w-auto border-none p-0 shadow-xl"
        >
          <EmojiPicker
            onSelect={(emoji) => {
              onReact(emoji);
              setPickerOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
