import { cn } from "@/lib/utils";
import { ARENA_STATUS_META, type ArenaStatus } from "../schemas/arena";

/** Badge de status da raid (o `Seal` do kit é específico de missão). */
export function StatusBadge({ status, className }: { status: ArenaStatus; className?: string }) {
  const meta = ARENA_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-display text-[0.7rem] font-semibold uppercase tracking-wider",
        meta.className,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {meta.label}
    </span>
  );
}
