import { MessagesSquare } from 'lucide-react';

/** Shown on desktop when no conversation is selected. */
export function EmptyThread() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="brand-gradient grid size-20 place-items-center rounded-3xl text-white shadow-lg">
        <MessagesSquare className="size-9" />
      </div>
      <div>
        <h2 className="text-xl font-bold">Welcome to Relay</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Pick a conversation from the left to start talking. Messages sync instantly across every device you sign in on.
        </p>
      </div>
    </div>
  );
}
