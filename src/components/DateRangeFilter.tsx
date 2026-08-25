import { useMemo, useState } from "react";
import {
  RANGE_OPTIONS,
  buildRange,
  type DateRange,
  type RangePreset,
} from "@/lib/dateRange";

/** Shared filter control. Every date filter in the app renders this. */
export function useDateRangeFilter(initial: RangePreset = "week") {
  const [preset, setPreset] = useState<RangePreset>(initial);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const range = useMemo(
    () => buildRange(preset, customStart, customEnd),
    [preset, customStart, customEnd],
  );
  const control = (
    <DateRangeFilter
      preset={preset}
      setPreset={setPreset}
      customStart={customStart}
      setCustomStart={setCustomStart}
      customEnd={customEnd}
      setCustomEnd={setCustomEnd}
    />
  );
  return { range, control, preset } as { range: DateRange; control: JSX.Element; preset: RangePreset };
}

export function DateRangeFilter({
  preset,
  setPreset,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
}: {
  preset: RangePreset;
  setPreset: (p: RangePreset) => void;
  customStart: string;
  setCustomStart: (v: string) => void;
  customEnd: string;
  setCustomEnd: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex overflow-hidden rounded-md border border-border">
        {RANGE_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => setPreset(o.value)}
            className={`px-2.5 py-1 text-xs font-medium transition ${
              preset === o.value
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {preset === "custom" && (
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          />
        </div>
      )}
    </div>
  );
}
