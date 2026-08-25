/**
 * HTTP rate limiting doesn't cover the socket — once connected, a client can
 * emit as fast as it likes. This is a per-socket token bucket for the events
 * that write to the database.
 *
 * In-memory and per-process, like the presence registry: good enough for one
 * node, and it moves to Redis alongside presence when that changes.
 */
const BUCKETS = {
  'message:send': { capacity: 25, refillPerSec: 1 },
  'message:edit': { capacity: 15, refillPerSec: 0.5 },
  'message:delete': { capacity: 20, refillPerSec: 0.5 },
  'message:forward': { capacity: 10, refillPerSec: 0.2 },
  'message:react': { capacity: 40, refillPerSec: 2 },
  // typing fires constantly by design, so it gets a wide bucket
  'typing:start': { capacity: 60, refillPerSec: 5 },
};

/**
 * Wraps socket.on so a handler only runs if the caller has budget. Returns a
 * registrar with the same signature, so handlers stay unaware of throttling.
 */
export function throttled(socket) {
  const buckets = new Map();

  return (event, handler) => {
    const config = BUCKETS[event];
    if (!config) return socket.on(event, handler);

    socket.on(event, (...args) => {
      const ack = typeof args.at(-1) === 'function' ? args.at(-1) : null;
      const now = Date.now();

      const state = buckets.get(event) ?? { tokens: config.capacity, at: now };
      // refill proportionally to elapsed time, capped at capacity
      state.tokens = Math.min(
        config.capacity,
        state.tokens + ((now - state.at) / 1000) * config.refillPerSec
      );
      state.at = now;

      if (state.tokens < 1) {
        buckets.set(event, state);
        return ack?.({ ok: false, error: 'You’re doing that too fast — slow down a moment.' });
      }

      state.tokens -= 1;
      buckets.set(event, state);
      handler(...args);
    });
  };
}
