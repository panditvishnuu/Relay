import { format, isToday, isYesterday, differenceInSeconds } from 'date-fns';

/** "Christina Gomez" -> "CG" */
export function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** Clock time inside the thread: "14:05" */
export const messageTime = (iso) => format(new Date(iso), 'HH:mm');

/** Right-aligned stamp in the conversation list: "Just now" / "14:05" / "12 Aug" */
export function listTimestamp(iso) {
  const d = new Date(iso);
  if (differenceInSeconds(new Date(), d) < 60) return 'Just now';
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'd MMM');
}

/** Sticky separator between days: "Today" / "Yesterday" / "12 August 2026" */
export function dayLabel(iso) {
  const d = new Date(iso);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'd MMMM yyyy');
}

/** Groups a chronological message list into [{ day, messages }] buckets. */
export function groupByDay(messages) {
  const groups = [];
  for (const message of messages) {
    const day = dayLabel(message.createdAt);
    const last = groups.at(-1);
    if (last?.day === day) last.messages.push(message);
    else groups.push({ day, messages: [message] });
  }
  return groups;
}
