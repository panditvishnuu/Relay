import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useUIStore } from '@/store/ui';

/**
 * emoji-mart plus its data set is ~600KB — far too much to sit in the initial
 * bundle for a picker most sessions never open. Both are dynamically imported
 * on first use and cached in this module afterwards.
 */
let modulesPromise = null;
const loadEmojiMart = () =>
  (modulesPromise ??= Promise.all([import('emoji-mart'), import('@emoji-mart/data')]));

/**
 * emoji-mart's official React wrapper hasn't declared React 19 support, and
 * forcing it with --legacy-peer-deps would affect the whole dependency tree.
 * The wrapper only instantiates the vanilla picker into a ref, which is all
 * this does — no peer conflict, same component.
 */
export function EmojiPicker({ onSelect, className }) {
  const containerRef = useRef(null);
  const theme = useUIStore((s) => s.theme);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;

    loadEmojiMart().then(([{ Picker }, { default: data }]) => {
      if (cancelled || !container) return;

      const picker = new Picker({
        data,
        theme,
        previewPosition: 'none',
        skinTonePosition: 'search',
        navPosition: 'bottom',
        perLine: 8,
        onEmojiSelect: (emoji) => onSelect?.(emoji.native),
      });

      container.replaceChildren(picker);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      container?.replaceChildren();
    };
  }, [theme, onSelect]);

  return (
    <div className={className}>
      {loading && (
        <div className="grid h-[360px] w-[352px] place-items-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      <div ref={containerRef} />
    </div>
  );
}

/** The six one-tap reactions shown on hover, before opening the full picker. */
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
