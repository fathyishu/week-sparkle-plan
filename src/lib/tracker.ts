import type {
  DayData,
  HistoryDay,
  Section,
  StreakInfo,
  Task,
  TaskDef,
  TrackerState,
} from "./types";

export const uid = () => Math.random().toString(36).slice(2, 11);

export const weekdayOf = (isoDate: string) => new Date(isoDate).getDay();

/** Local calendar key (yyyy-mm-dd). Using UTC here shifts the day for most users. */
export const dayKey = (isoDate: string) => {
  const d = new Date(isoDate);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
};

export const fmtDate = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;

/** All known sections across the week, used to resolve a def's section metadata. */
export function sectionCatalog(days: DayData[], extra: Section[] = []): Section[] {
  const map = new Map<string, Section>();
  for (const s of extra) map.set(s.id, s);
  for (const d of days) for (const s of d.sections) map.set(s.id, s);
  return [...map.values()];
}

/**
 * Ensures every day contains one instance of every TaskDef matching that day's
 * weekday, and drops instances whose definition no longer exists.
 * Never touches statuses of existing instances.
 */
export function materializeWeek(
  state: Pick<TrackerState, "taskDefs">,
  days: DayData[],
  extraSections: Section[] = [],
): DayData[] {
  const defs = state.taskDefs ?? [];
  const defById = new Map(defs.map((d) => [d.id, d]));
  const catalog = sectionCatalog(days, extraSections);
  const secById = new Map(catalog.map((s) => [s.id, s]));

  return days.map((day) => {
    const wd = weekdayOf(day.isoDate);
    // prune orphan instances (definition deleted elsewhere)
    let tasks = day.tasks.filter((t) => !t.defId || defById.has(t.defId));
    const present = new Set(tasks.map((t) => t.defId).filter(Boolean) as string[]);
    let sections = day.sections;

    const wanted = defs.filter((d) => d.weekday === wd && !present.has(d.id));
    if (wanted.length) {
      const added: Task[] = wanted.map((def) => ({
        id: uid(),
        title: def.title,
        points: def.points,
        status: "pending",
        sectionId: def.sectionId,
        badges: def.badges,
        custom: true,
        defId: def.id,
        isStreak: def.isStreak,
        streakKey: def.streakKey,
      }));
      tasks = [...tasks, ...added];
      for (const def of wanted) {
        if (!sections.some((s) => s.id === def.sectionId)) {
          const known = secById.get(def.sectionId);
          sections = [
            ...sections,
            known ?? { id: def.sectionId, label: def.sectionId, color: "#6B7280" },
          ];
        }
      }
    }
    return { ...day, sections, tasks };
  });
}

/** Backfills taskDefs for states saved before permanent tasks existed. */
export function migrateState<T extends TrackerState>(state: T): T {
  if (state.taskDefs && state.taskDefs.length) return state;
  const defs: TaskDef[] = [];
  const days = state.days.map((day) => {
    const wd = weekdayOf(day.isoDate);
    const tasks = day.tasks.map((t) => {
      if (t.carriedFromDay || t.defId) return t;
      const def: TaskDef = {
        id: uid(),
        title: t.title,
        points: t.points,
        sectionId: t.sectionId,
        weekday: wd,
        badges: t.badges,
      };
      defs.push(def);
      return { ...t, defId: def.id };
    });
    return { ...day, tasks };
  });
  return { ...state, days, taskDefs: defs, streaks: state.streaks ?? {} };
}

/** Unchecks everything for a fresh week; keeps every task in place. */
export function resetWeekToPending(days: DayData[]): DayData[] {
  return days.map((d) => ({
    ...d,
    tasks: d.tasks
      .filter((t) => !t.carriedFromDay)
      .map((t) => ({ ...t, status: "pending" as const })),
    notes: d.notes
      .filter((n) => !n.carriedFromDay)
      .map((n) => ({ ...n, status: "pending" as const })),
  }));
}

/** Moves the 7 day cards forward/backward by N days, keeping content. */
export function shiftDays(days: DayData[], delta: number): DayData[] {
  return days.map((d) => {
    const nd = new Date(d.isoDate);
    nd.setDate(nd.getDate() + delta);
    return { ...d, isoDate: nd.toISOString(), date: fmtDate(nd) };
  });
}

export function snapshotDays(days: DayData[]): HistoryDay[] {
  return days.map((d) => {
    const labels = new Map(d.sections.map((s) => [s.id, s.label]));
    return {
      date: d.date,
      tasks: d.tasks.map((t) => ({
        title: t.title,
        points: t.points,
        status: t.status,
        sectionLabel: labels.get(t.sectionId) ?? t.sectionId,
      })),
    };
  });
}

/* ---------------- streaks ---------------- */

/** Whole days between two yyyy-mm-dd keys (b - a). */
function dayDiff(aKey: string, bKey: string): number {
  const a = Date.parse(`${aKey}T00:00:00Z`);
  const b = Date.parse(`${bKey}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export function bumpStreak(
  prev: { count: number; lastDoneDate?: string } | undefined,
  dateISO: string,
): { count: number; lastDoneDate: string } {
  const today = dayKey(dateISO);
  if (!prev?.lastDoneDate) return { count: 1, lastDoneDate: today };
  const gap = dayDiff(prev.lastDoneDate, today);
  if (gap === 0) return { count: Math.max(1, prev.count), lastDoneDate: today };
  // Exactly one calendar day later continues the chain; any missed day resets it.
  if (gap === 1) return { count: prev.count + 1, lastDoneDate: today };
  return { count: 1, lastDoneDate: today };
}

export function dropStreak(
  prev: { count: number; lastDoneDate?: string } | undefined,
  dateISO: string,
): { count: number; lastDoneDate?: string } {
  const today = dayKey(dateISO);
  if (prev?.lastDoneDate === today) {
    const count = Math.max(0, prev.count - 1);
    // Step the anchor back one day so re-checking tomorrow still continues the chain.
    const prevDay = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000)
      .toISOString()
      .slice(0, 10);
    return count > 0
      ? { count, lastDoneDate: prevDay }
      : { count: 0, lastDoneDate: undefined };
  }
  return prev ?? { count: 0 };
}

/**
 * The streak as of `nowISO`. A chain is only alive if it was completed today or
 * yesterday — otherwise a day was missed and the streak is 0.
 */
export function currentStreak(
  info: { count: number; lastDoneDate?: string } | undefined,
  nowISO: string = new Date().toISOString(),
): number {
  if (!info?.lastDoneDate || info.count <= 0) return 0;
  const gap = dayDiff(info.lastDoneDate, dayKey(nowISO));
  if (gap < 0) return info.count; // completed on a future-dated day cell
  return gap <= 1 ? info.count : 0;
}

/* ---------------- CSV ---------------- */

const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;

export function defsToCsv(defs: TaskDef[], sections: Section[]): string {
  const label = new Map(sections.map((s) => [s.id, s.label]));
  const rows = [
    "title,points,section,weekday,streak",
    ...defs.map((d) =>
      [
        esc(d.title),
        String(d.points),
        esc(label.get(d.sectionId) ?? d.sectionId),
        String(d.weekday),
        d.isStreak ? "1" : "0",
      ].join(","),
    ),
  ];
  return rows.join("\n");
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

export interface ParsedDefRow {
  title: string;
  points: number;
  sectionLabel: string;
  weekday: number;
  isStreak: boolean;
}

export function parseDefsCsv(text: string): ParsedDefRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return [];
  const start = /title/i.test(lines[0]) ? 1 : 0;
  const rows: ParsedDefRow[] = [];
  for (let i = start; i < lines.length; i++) {
    const [title, points, sectionLabel, weekday, streak] = splitCsvLine(lines[i]);
    if (!title?.trim()) continue;
    rows.push({
      title: title.trim(),
      points: Math.max(1, Math.min(10, Number(points) || 5)),
      sectionLabel: (sectionLabel || "Imported").trim(),
      weekday: Math.max(0, Math.min(6, Number(weekday) || 0)),
      isStreak: streak?.trim() === "1" || streak?.trim().toLowerCase() === "true",
    });
  }
  return rows;
}

/* ---------------- streak derived from actual day data ---------------- */

function prevDayKey(key: string): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
}

/**
 * The streak for a definition as of the day cell at `dayIdx`:
 * consecutive completed days ending yesterday, +1 when today is done.
 * `carry` extends the chain across the week boundary.
 */
export function streakForDef(
  days: DayData[],
  key: string,
  dayIdx: number,
  carry?: { count: number; lastDoneDate?: string },
): number {
  // A daily streak task has one def per weekday — match instances by the
  // shared streakKey (falling back to defId for legacy data).
  const matches = (x: Task) => (x.streakKey ?? x.defId) === key;
  let base = 0;
  let i = dayIdx - 1;
  for (; i >= 0; i--) {
    const t = days[i].tasks.find(matches);
    if (t && t.status === "done") base += 1;
    else break;
  }
  if (i < 0 && carry?.lastDoneDate && carry.count > 0 && days.length) {
    if (carry.lastDoneDate === prevDayKey(dayKey(days[0].isoDate))) base += carry.count;
  }
  const today = days[dayIdx]?.tasks.find(matches);
  return today?.status === "done" ? base + 1 : base;
}

/**
 * One-time repair for streak defs saved before streakKey existed:
 * defs that are the same task on different weekdays (same title/section/points)
 * get one shared streakKey, and existing day instances are tagged to match.
 * Old per-def streak records are merged, keeping the latest chain.
 */
export function migrateStreakKeys<T extends TrackerState>(state: T): T {
  const defs = state.taskDefs ?? [];
  if (!defs.some((d) => d.isStreak && !d.streakKey)) {
    // Still ensure instances carry the def's key.
    if (!defs.some((d) => d.streakKey)) return state;
  }
  const groupKey = (d: TaskDef) => `${d.title}|${d.sectionId}|${d.points}`;
  const keyByGroup = new Map<string, string>();
  let changed = false;
  const newDefs = defs.map((d) => {
    if (!d.isStreak) return d;
    if (d.streakKey) {
      keyByGroup.set(groupKey(d), d.streakKey);
      return d;
    }
    changed = true;
    const g = groupKey(d);
    if (!keyByGroup.has(g)) keyByGroup.set(g, uid());
    const streakKey = keyByGroup.get(g);
    return streakKey ? { ...d, streakKey } : d;
  });
  const keyByDefId = new Map(newDefs.map((d) => [d.id, d.streakKey]));
  const days = state.days.map((day) => ({
    ...day,
    tasks: day.tasks.map((t) => {
      const k = t.defId ? keyByDefId.get(t.defId) : undefined;
      if (!k || t.streakKey === k) return t;
      changed = true;
      return { ...t, streakKey: k };
    }),
  }));
  // Merge legacy per-def streak records into one per streakKey.
  const streaks: Record<string, StreakInfo> = {};
  for (const d of newDefs) {
    if (!d.isStreak || !d.streakKey) continue;
    const candidates = [state.streaks?.[d.streakKey], state.streaks?.[d.id]].filter(
      Boolean,
    ) as StreakInfo[];
    const best = candidates
      .filter((c) => c.count > 0 && c.lastDoneDate)
      .sort((a, b) => (a.lastDoneDate ?? "") < (b.lastDoneDate ?? "") ? 1 : -1)[0];
    if (best) streaks[d.streakKey] = best;
  }
  if (!changed) return state;
  return { ...state, taskDefs: newDefs, days, streaks };
}
