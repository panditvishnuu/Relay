import { useSyncExternalStore } from 'react';

/**
 * True when the tab is in the foreground. Read receipts gate on this so a
 * background tab left open on a conversation doesn't mark messages read.
 */
export function useDocumentVisible() {
  return useSyncExternalStore(
    (onChange) => {
      document.addEventListener('visibilitychange', onChange);
      window.addEventListener('focus', onChange);
      window.addEventListener('blur', onChange);
      return () => {
        document.removeEventListener('visibilitychange', onChange);
        window.removeEventListener('focus', onChange);
        window.removeEventListener('blur', onChange);
      };
    },
    () => document.visibilityState === 'visible' && document.hasFocus(),
    () => true
  );
}
