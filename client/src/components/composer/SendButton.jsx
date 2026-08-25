import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mic, SendHorizonal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { spring } from '@/lib/motion';

let rippleId = 0;

/**
 * Send button with a ripple that expands from the click point. The ripples are
 * self-cleaning — each one removes itself when its animation completes, so
 * hammering the button can't leak elements.
 */
export function SendButton({ canSend, onClick }) {
  const [ripples, setRipples] = useState([]);

  function handleClick(e) {
    if (canSend) {
      const rect = e.currentTarget.getBoundingClientRect();
      const id = ++rippleId;
      setRipples((r) => [...r, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    }
    onClick?.();
  }

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      disabled={!canSend}
      aria-label={canSend ? 'Send message' : 'Record voice note'}
      whileTap={canSend ? { scale: 0.88 } : undefined}
      whileHover={canSend ? { scale: 1.06 } : undefined}
      transition={spring.snappy}
      className={cn(
        'relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full',
        'disabled:cursor-not-allowed',
        canSend ? 'brand-gradient text-white shadow-md' : 'bg-muted text-muted-foreground'
      )}
    >
      {ripples.map(({ id, x, y }) => (
        <motion.span
          key={id}
          className="pointer-events-none absolute size-3 rounded-full bg-white/60"
          style={{ left: x - 6, top: y - 6 }}
          initial={{ scale: 0, opacity: 0.7 }}
          animate={{ scale: 9, opacity: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          onAnimationComplete={() => setRipples((r) => r.filter((item) => item.id !== id))}
        />
      ))}

      {/* the icon swaps as soon as there's something to send */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={canSend ? 'send' : 'mic'}
          initial={{ opacity: 0, rotate: -35, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 35, scale: 0.6 }}
          transition={spring.snappy}
          className="relative"
        >
          {canSend ? <SendHorizonal className="size-[18px]" /> : <Mic className="size-[18px]" />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
