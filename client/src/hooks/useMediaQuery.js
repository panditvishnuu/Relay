import { useSyncExternalStore } from 'react';

/**
 * Subscribe to a CSS media query. Used where layout must branch in JS rather
 * than CSS — e.g. the details pane is a docked column on desktop but a Sheet
 * on smaller screens, which is a different component tree, not a class swap.
 */
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false // SSR / first paint fallback: assume mobile
  );
}

// Mirrors the Tailwind breakpoints used across the shell.
export const useIsDesktop = () => useMediaQuery('(min-width: 1280px)'); // xl — three panes
export const useIsTablet = () => useMediaQuery('(min-width: 768px)'); // md — list + thread
