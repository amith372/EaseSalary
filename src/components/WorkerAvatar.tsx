import { RailIcon } from "@/components/icons";

/** The tile beside a worker's name. Nothing stores a photo, so it holds the
 * person glyph rather than standing empty like a picture that failed to load. */
export function WorkerAvatar({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={
        size === "lg"
          ? "flex size-14 flex-none items-center justify-center rounded-[18px] bg-shell text-clay-soft sm:size-17 sm:rounded-[22px]"
          : "flex size-12 flex-none items-center justify-center rounded-card-sm bg-shell text-clay-soft sm:size-15 sm:rounded-[18px]"
      }
    >
      <RailIcon
        name="person"
        className={size === "lg" ? "size-7 sm:size-8" : "size-6 sm:size-7"}
      />
    </span>
  );
}
