import { motion, useReducedMotion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { initials } from '@/lib/format';
import { spring } from '@/lib/motion';

const sizeClasses = {
  sm: 'size-9',
  default: 'size-11',
  lg: 'size-12',
  xl: 'size-24',
};

const dotClasses = {
  sm: 'size-2.5',
  default: 'size-3',
  lg: 'size-3.5',
  xl: 'size-5',
};

/**
 * Avatar + presence dot. When someone is online the dot emits a slow halo —
 * one ring expanding and fading on a loop. It's the only continuously animating
 * thing in the UI, so it stays subtle and stops entirely when they go offline.
 */
export function PresenceAvatar({
  name,
  src,
  online = false,
  showPresence = true,
  size = 'default',
  className,
  layoutId,
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div className={cn('relative shrink-0', className)}>
      <motion.div layoutId={layoutId} transition={spring.smooth}>
        <Avatar className={cn(sizeClasses[size], 'ring-2 ring-background shadow-sm')}>
          <AvatarImage src={src} alt={name} className="object-cover" />
          <AvatarFallback className="brand-gradient text-xs font-semibold text-white">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
      </motion.div>

      {showPresence && (
        <span className={cn('absolute -right-0.5 -bottom-0.5', dotClasses[size])}>
          {/* the halo: a second ring that scales out and fades, on a loop */}
          {online && !reduceMotion && (
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full bg-online"
              initial={{ scale: 1, opacity: 0.55 }}
              animate={{ scale: 2.1, opacity: 0 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', repeatDelay: 0.6 }}
            />
          )}

          <motion.span
            aria-label={online ? 'Online' : 'Offline'}
            animate={{ backgroundColor: online ? 'var(--online)' : 'var(--away)' }}
            transition={{ duration: 0.3 }}
            className="relative block size-full rounded-full ring-2 ring-background"
          />
        </span>
      )}
    </div>
  );
}
