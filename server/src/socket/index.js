import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { verifyAccessToken } from '../lib/tokens.js';
import { addSocket, onlineUserIds, removeSocket, resetPresence } from '../lib/presence.js';
import { Conversation } from '../models/Conversation.js';
import { markDeliveredOnConnect } from '../services/receipt.service.js';
import { registerMessageHandlers } from './handlers/message.js';
import { registerTypingHandlers } from './handlers/typing.js';
import { registerReceiptHandlers } from './handlers/receipt.js';
import { registerReactionHandlers } from './handlers/reaction.js';
import { registerMessageEditHandlers } from './handlers/messageEdit.js';
import { userRoom } from './rooms.js';

export { userRoom };

let io = null;
export const getIO = () => io;

export async function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.clientOrigin, credentials: true },
    // client reconnects on its own; this just bounds how long a dead link lingers
    pingTimeout: 20_000,
  });

  // stale isOnline flags from a previous run would otherwise show ghosts
  await resetPresence();

  // --- handshake auth: same access token the REST API uses ---
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('UNAUTHORIZED'));

    try {
      socket.userId = verifyAccessToken(token).sub;
      next();
    } catch (err) {
      // the client listens for this exact message, refreshes, and reconnects
      next(new Error(err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    const { userId } = socket;

    /**
     * Listeners must be attached synchronously. Awaiting anything first leaves
     * a window where the client is connected but nothing is listening, and a
     * message sent in that window is dropped with no ack — which is exactly
     * what a client does when it reconnects and flushes a queued send.
     */
    socket.join(userRoom(userId));
    registerMessageHandlers(io, socket);
    registerTypingHandlers(io, socket);
    registerReceiptHandlers(io, socket);
    registerReactionHandlers(io, socket);
    registerMessageEditHandlers(io, socket);

    socket.on('disconnect', async () => {
      const wentOffline = await removeSocket(userId, socket.id);
      if (wentOffline) {
        io.emit('presence:update', { userId, isOnline: false, lastSeen: new Date() });
      }
    });

    // presence and catch-up receipts touch the database, so they run after
    // the socket is already usable
    void (async () => {
      const cameOnline = await addSocket(userId, socket.id);

      socket.emit('presence:init', { userIds: onlineUserIds() });
      if (cameOnline) socket.broadcast.emit('presence:update', { userId, isOnline: true });

      // everything that arrived while they were offline is now delivered
      try {
        for (const receipt of await markDeliveredOnConnect(userId)) {
          await emitToConversationId(receipt.conversationId, 'receipt:delivered', receipt);
        }
      } catch (err) {
        console.error('[socket] delivery catch-up failed:', err.message);
      }
    })();
  });

  console.log('[socket] ready');
  return io;
}

/** Emits an event to every member of a conversation, on every device. */
export function emitToConversation(conversation, event, payload) {
  if (!io) return;
  for (const member of conversation.members) {
    io.to(userRoom(member.user)).emit(event, payload);
  }
}

/** Same, but looks the conversation up first. */
export async function emitToConversationId(conversationId, event, payload) {
  const conversation = await Conversation.findById(conversationId).select('members');
  if (conversation) emitToConversation(conversation, event, payload);
}
