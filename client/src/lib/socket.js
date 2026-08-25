import { io } from 'socket.io-client';
import { getAccessToken, refreshSession } from './api';

let socket = null;

/**
 * Single shared connection, authenticated with the same access token as REST.
 *
 * When that token expires mid-session the server rejects the handshake with
 * TOKEN_EXPIRED; we refresh once, swap the token into `auth`, and let
 * socket.io's own backoff retry. Any other failure just backs off.
 */
export function connectSocket() {
  if (socket?.connected) return socket;

  socket ??= io({
    path: '/socket.io',
    autoConnect: false,
    auth: (cb) => cb({ token: getAccessToken() }),
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect_error', async (err) => {
    if (err.message === 'TOKEN_EXPIRED') {
      try {
        await refreshSession(); // auth callback re-reads the token on retry
      } catch {
        socket.disconnect();
      }
    }
  });

  if (!socket.connected) socket.connect();
  return socket;
}

export const getSocket = () => socket;

export function disconnectSocket() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}

/** Promise wrapper over socket.io acks, with a timeout so the UI can't hang. */
export function emitWithAck(event, payload, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    if (!s?.connected) return reject(new Error('Not connected'));

    const timer = setTimeout(() => reject(new Error('Timed out')), timeoutMs);
    s.emit(event, payload, (response) => {
      clearTimeout(timer);
      response?.ok ? resolve(response) : reject(new Error(response?.error ?? 'Failed'));
    });
  });
}
