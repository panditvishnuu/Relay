import { AnimatePresence, motion } from 'framer-motion';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * Three dots riding a sine-ish wave. Each dot runs the same keyframes offset by
 * 150ms, which reads as a travelling pulse rather than three things blinking.
 */
export function TypingIndicator({ names = [], className }) {
  const label =
    names.length === 1
      ? `${names[0].split(' ')[0]} is typing`
      : names.length === 2
        ? `${names[0].split(' ')[0]} and ${names[1].split(' ')[0]} are typing`
        : `${names.length} people are typing`;

  return (
    <AnimatePresence>
      {names.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0, y: 6 }}
          animate={{ opacity: 1, height: 'auto', y: 0 }}
          exit={{ opacity: 0, height: 0, y: 6 }}
          transition={spring.smooth}
          className={cn('overflow-hidden', className)}
          aria-live="polite"
        >
          <div className="flex items-center gap-2 px-2 pb-1 sm:px-6">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-border/70 bg-bubble-in px-3 py-2.5 shadow-sm">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="size-1.5 rounded-full bg-muted-foreground"
                  animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                  transition={{
                    duration: 1.1,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: i * 0.15,
                  }}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
