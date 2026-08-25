/**
 * Room naming lives in its own module so handlers can import it without
 * creating a cycle back through socket/index.js.
 *
 * Every socket a user has open joins their room, so an event reaches all of
 * their tabs and devices at once.
 */
export const userRoom = (userId) => `user:${userId}`;
