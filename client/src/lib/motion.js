/**
 * One motion vocabulary for the whole app. Components import from here rather
 * than inventing their own durations, so everything decelerates the same way
 * and the app reads as one system instead of a pile of separate effects.
 *
 * Springs, not durations, for anything the user initiates — a spring keeps its
 * character regardless of the distance travelled.
 */

export const spring = {
  /** Default for entrances: settles quickly, barely overshoots. */
  soft: { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 },
  /** Snappier, for small things like badges and ticks. */
  snappy: { type: 'spring', stiffness: 600, damping: 26, mass: 0.6 },
  /** For panels and shared-element moves, where overshoot would feel cheap. */
  smooth: { type: 'spring', stiffness: 320, damping: 38 },
};

export const ease = {
  out: [0.16, 1, 0.3, 1], // expo-out: fast start, long gentle tail
  inOut: [0.65, 0, 0.35, 1],
};

/** Messages rise into place, leaning in from the sender's side. */
export const messageVariants = {
  initial: (own) => ({ opacity: 0, y: 12, scale: 0.96, x: own ? 8 : -8 }),
  animate: { opacity: 1, y: 0, scale: 1, x: 0, transition: spring.soft },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.12 } },
};

/** Sidebar rows cascade in rather than all appearing at once. */
export const listContainer = {
  animate: { transition: { staggerChildren: 0.035, delayChildren: 0.04 } },
};

export const listItem = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: spring.soft },
};

/** Dialog and sheet content. */
export const popIn = {
  initial: { opacity: 0, scale: 0.97, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: spring.smooth },
  exit: { opacity: 0, scale: 0.98, y: 4, transition: { duration: 0.12 } },
};

/** Auth screens slide between each other. */
export const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: ease.out } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2, ease: ease.inOut } },
};

/**
 * Shared layoutId names. Keeping them in one place stops two unrelated
 * components accidentally claiming the same id and animating into each other.
 */
export const layoutIds = {
  activeRail: 'sidebar-active-rail',
  avatar: (id) => `avatar-${id}`,
};
