/** The small pulsing dot used wherever something is "live" — a reader
 * present right now (CurrentReaders.tsx), a section currently being read
 * (ChaptersDrawer.tsx). One shared visual so every "this is happening now"
 * signal in the app reads the same way. The rooms' dots (Rooms v4 sheet
 * #c1, #c4, #c10) are larger, with a soft ring: `forest` is "reading /
 * replying now", `live` a reading room on air, `onAir` its pinned row. */
const LOOKS = {
  brand: "h-1.5 w-1.5 bg-brand-500",
  forest: "size-1.75 bg-forest-500 ring-3 ring-forest-500/18",
  live: "size-2 bg-brand-400 ring-3 ring-brand-400/30",
  onAir: "size-2.25 bg-brand-400 ring-4 ring-brand-400/30",
};

export default function PulseDot({ tone = "brand", className = "" }: { tone?: keyof typeof LOOKS; className?: string }) {
  const look = LOOKS[tone];
  return <span className={`flex-none animate-pulse rounded-full ${look} ${className}`} />;
}
