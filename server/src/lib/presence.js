import { User } from '../models/User.js';

/**
 * In-memory online registry: userId -> Set(socketId).
 * A user is online while at least one socket is connected, so opening a second
 * tab and closing it doesn't flip them offline.
 *
 * Single-process only. Scaling past one node means moving this to Redis and
 * adding the socket.io Redis adapter — noted for chunk 8.
 */
const sockets = new Map();

export const isOnline = (userId) => sockets.has(String(userId));
export const onlineUserIds = () => [...sockets.keys()];

/** @returns true when this is the user's first connection (worth broadcasting) */
export async function addSocket(userId, socketId) {
  const key = String(userId);
  const existing = sockets.get(key);

  if (existing) {
    existing.add(socketId);
    return false;
  }

  sockets.set(key, new Set([socketId]));
  await User.findByIdAndUpdate(key, { isOnline: true }).catch(() => {});
  return true;
}

/** @returns true when the user's last connection just went away */
export async function removeSocket(userId, socketId) {
  const key = String(userId);
  const existing = sockets.get(key);
  if (!existing) return false;

  existing.delete(socketId);
  if (existing.size > 0) return false;

  sockets.delete(key);
  await User.findByIdAndUpdate(key, { isOnline: false, lastSeen: new Date() }).catch(() => {});
  return true;
}

/** Rebuilds the registry's view of the world after a server restart. */
export async function resetPresence() {
  sockets.clear();
  await User.updateMany({ isOnline: true }, { isOnline: false }).catch(() => {});
}
