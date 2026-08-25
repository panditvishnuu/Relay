import { useEffect, useState } from 'react';
import { Loader2, WifiOff } from 'lucide-react';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';

/**
 * Surfaces socket state so a dropped connection is visible rather than the app
 * silently going quiet. Only shows after a short delay — a reconnect that
 * resolves in 300ms shouldn't flash a scary banner.
 */
export function ConnectionBanner() {
  const [state, setState] = useState('connected');

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    let timer;
    const showDisconnected = () => {
      timer = setTimeout(() => setState('reconnecting'), 1200);
    };
    const onConnect = () => {
      clearTimeout(timer);
      setState((prev) => (prev === 'connected' ? 'connected' : 'restored'));
      setTimeout(() => setState('connected'), 2000);
    };

    socket.on('disconnect', showDisconnected);
    socket.on('connect', onConnect);

    return () => {
      clearTimeout(timer);
      socket.off('disconnect', showDisconnected);
      socket.off('connect', onConnect);
    };
  }, []);

  if (state === 'connected') return null;

  const reconnecting = state === 'reconnecting';

  return (
    <div
      role="status"
      className={cn(
        'fixed top-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-lg',
        reconnecting ? 'bg-foreground text-background' : 'bg-online text-white'
      )}
    >
      {reconnecting ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Reconnecting…
        </>
      ) : (
        <>
          <WifiOff className="size-4" />
          Back online
        </>
      )}
    </div>
  );
}
