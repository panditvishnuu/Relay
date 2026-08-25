/** Centred pill for "X added Y", "X left the group", renames, etc. */
export function SystemMessage({ message }) {
  return (
    <div className="flex justify-center py-1.5">
      <span className="max-w-[85%] rounded-full bg-muted px-3 py-1 text-center text-[11.5px] font-medium text-muted-foreground">
        {message.text}
      </span>
    </div>
  );
}
