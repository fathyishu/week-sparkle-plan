import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "7-Day Weekly Task Tracker & Daily Planner" },
      {
        name: "description",
        content:
          "A 7-day weekly task tracker with points, carry-over, notepads, and bulk actions to plan every day with focus.",
      },
      { property: "og:title", content: "7-Day Weekly Task Tracker" },
      {
        property: "og:description",
        content: "Plan your week, track points, carry incomplete tasks forward.",
      },
    ],
  }),
  component: TrackerApp,
});

/* =========================================================================
   TYPES
   ========================================================================= */
type TaskStatus = "pending" | "done" | "carry";
type BadgeType = "OVERDUE" | "URGENT" | "MEETING" | "ONE-TIME";

interface Task {
  id: string;
  title: string;
  points: number;
  status: TaskStatus;
  sectionId: string;
  badges?: BadgeType[];
  carriedFromDay?: number; // 1-indexed
  custom?: boolean;
}

interface Section {
  id: string;
  label: string;
  color: string; // hex
}

interface Note {
  id: string;
  text: string;
  status: TaskStatus;
  carriedFromDay?: number;
}

interface DayData {
  date: string; // dd/M
  isoDate: string;
  sections: Section[]; // ordered
  tasks: Task[];
  notes: Note[];
}

interface WeekHistory {
  week: number;
  range: string;
  taskPct: number;
  ptsPct: number;
  tasksDone: number;
  tasksTotal: number;
}

interface AppState {
  weekStartISO: string; // Monday
  weekNumber: number;
  days: DayData[];
  history: WeekHistory[];
}

/* =========================================================================
   BASE DATA — sections and seed tasks
   ========================================================================= */

const CORE_SECTIONS: Section[] = [
  { id: "deen", label: "Deen & Quran", color: "#D4537E" },
  { id: "workout", label: "Workout", color: "#639922" },
  { id: "team", label: "Team Briefings", color: "#1D9E75" },
  { id: "muhammad", label: "Muhammad Report", color: "#FF6F61" },
  { id: "ca", label: "Carbon Academy Follow-up", color: "#BA7517" },
  { id: "video", label: "Video Pipeline", color: "#7F77DD" },
  { id: "personal", label: "Daily Personal", color: "#888780" },
  { id: "onetime", label: "One-Time Tasks", color: "#4B5563" },
];

const DAY_SPECIFIC: Record<number, Section[]> = {
  1: [
    { id: "ai-deep", label: "AI Deep Dive", color: "#7F77DD" },
    { id: "content-cam", label: "Content & Camera", color: "#E4572E" },
  ],
  2: [
    { id: "content-mastery", label: "Content Mastery", color: "#E4572E" },
    { id: "sales-li", label: "Sales + LinkedIn", color: "#1D9E75" },
  ],
  3: [
    { id: "ai-agents", label: "AI Agents", color: "#7F77DD" },
    { id: "finance", label: "Finance & Stocks", color: "#BA7517" },
  ],
  4: [
    { id: "tech-gh", label: "Tech & GitHub", color: "#2563EB" },
    { id: "mix-finance", label: "Mix — Finance + Scale Intro", color: "#0EA5A4" },
  ],
  5: [
    { id: "scale-acq", label: "Scaling & Acquisition", color: "#7F77DD" },
    { id: "tax-shoot", label: "Tax + Batch Content Shoot", color: "#E4572E" },
  ],
  6: [
    { id: "podcasts", label: "Podcasts & Upskilling", color: "#888780" },
    { id: "scale2", label: "Scale Round 2", color: "#7F77DD" },
  ],
  7: [{ id: "final-push", label: "Final Push", color: "#166534" }],
};

// [title, points, badges?]
type Seed = [string, number, BadgeType[]?];

const SEED_CORE: Record<string, Seed[]> = {
  deen: [
    ["Fajr prayer", 5],
    ["Recite 5 pages of Quran", 5],
    ["10 min sit & ponder", 5],
    ["10 min day plan — map today's priorities", 5],
    ["Deen / hajj / marriage learning (15 min)", 5],
  ],
  workout: [
    ["Full workout — 1 hour", 5],
    ["Post-workout stretch (10 min)", 3],
  ],
  team: [
    ["Morning briefing with manager & team", 3],
    ["Evening briefing with manager & HR", 3],
    ["Reply to team messages & resolve all blockers", 3],
  ],
  muhammad: [
    ["Follow up with Muhammad", 4],
    ["Get daily Muhammad report", 4],
  ],
  ca: [
    ["Follow up CA team — check all pending items", 3],
    ["Confirm all scheduled posts going out", 3],
    ["Confirm all meetings happening as planned", 3],
    ["Check progress on all active CA work streams", 3],
    ["Ensure all deliverables on track — zero blockers", 3],
  ],
  video: [
    ["Send today's raw footage to videographer", 4],
    ["Receive & review 5 edited videos", 5],
    ["Approve edits or send revision notes", 4],
    ["Add captions/subtitles to all 5 videos", 4],
    ["Schedule 5 videos across all platforms", 5],
  ],
  personal: [
    ["Read book — 30 min", 4],
    ["Write own book — 30 min", 5],
    ["Shoot video content for tomorrow's batch (30 min)", 5],
    ["Build something on Lovable (daily credits)", 5],
    ["Content storming — brainstorm shoot ideas", 4],
  ],
};

const SEED_DAY_SPECIFIC: Record<number, Record<string, Seed[]>> = {
  1: {
    "ai-deep": [
      ["OutSkill modules", 8],
      ["AI agent build", 9],
      ["ElevenLabs deep dive", 7],
      ["WhatsApp AI", 8],
      ["Customer support AI", 8],
    ],
    "content-cam": [
      ["Camera settings mastery", 6],
      ["Angles & framing", 6],
      ["Lighting theory", 6],
      ["Laptop editing workflow", 6],
    ],
  },
  2: {
    "content-mastery": [
      ["Content strategy deep dive", 7],
      ["Instagram algorithm study", 7],
      ["90-day content calendar", 7],
      ["Storytelling frameworks", 7],
    ],
    "sales-li": [
      ["Hormozi Close — study", 8],
      ["Sales systems build", 8],
      ["LinkedIn profile overhaul", 7],
      ["LinkedIn course modules", 7],
    ],
  },
  3: {
    "ai-agents": [
      ["AI agent full build", 9],
      ["WhatsApp automation", 8],
      ["ElevenLabs project", 8],
    ],
    finance: [
      ["Ishaan finance course", 7],
      ["Stock market study", 6],
      ["Money management plan", 8],
    ],
  },
  4: {
    "tech-gh": [
      ["GitHub setup", 6],
      ["Push / fork / PR practice", 6],
      ["Web hosting basics", 6],
      ["Databases intro", 7],
      ["Deploy a project", 7],
    ],
    "mix-finance": [
      ["Tax basics", 6],
      ["How to scale — study", 7],
      ["Investment basics", 7],
    ],
  },
  5: {
    "scale-acq": [
      ["Scale playbook", 8],
      ["M&A basics", 7],
      ["Attract investors — study", 8],
      ["Acquisition frameworks", 8],
    ],
    "tax-shoot": [
      ["Tax management deep dive", 6],
      ["Batch talking-head shoot", 7],
      ["B-roll shoot", 7],
    ],
  },
  6: {
    podcasts: [
      ["Hormozi podcast", 6],
      ["Sales/marketing podcast", 6],
      ["Key learnings notes", 7],
    ],
    scale2: [
      ["Investment management", 8],
      ["Due diligence study", 7],
      ["OutSkill completion", 8],
      ["ElevenLabs final", 7],
    ],
  },
  7: {
    "final-push": [
      ["OutSkill all remaining", 9],
      ["Schedule all posts", 9],
      ["Final shoot", 7],
      ["Handoff doc", 8],
      ["Action plan post-Qatar", 8],
    ],
  },
};

const DAY7_MUHAMMAD_EXTRA: Seed = ["Weekly meeting with Muhammad", 6, ["MEETING"]];

const ONE_TIME_BY_DAY: Record<number, Seed[]> = {
  1: [
    ["Send video to Farshana", 8, ["OVERDUE"]],
    ["Review Fathi/Fatima chat videos", 9, ["OVERDUE"]],
    ["Review Shabbir's chat videos", 9, ["OVERDUE"]],
    ["AI video #1 — publish NOW", 10, ["OVERDUE"]],
    ["AI video #2 — publish NOW", 10, ["OVERDUE"]],
    ["Build ChatGPT agent", 10, ["OVERDUE"]],
    ["Build Call GPT agent", 9, ["URGENT"]],
    ["Give Farshana rest of videos before 30th", 8, ["ONE-TIME"]],
    ["Shopify — fix payment gateway", 9, ["URGENT"]],
    ["Weekly meeting with Ishaan", 6, ["MEETING"]],
    ["Qatar Living items finalize", 5, ["ONE-TIME"]],
    ["Moto G35 check", 4, ["ONE-TIME"]],
    ["Carbon Academy posters", 7, ["ONE-TIME"]],
    ["Finish posting", 8, ["URGENT"]],
    ["WhatsApp CRM research", 7, ["ONE-TIME"]],
    ["Company WhatsApp integration", 8, ["ONE-TIME"]],
    ["Meta AI WhatsApp integration", 8, ["ONE-TIME"]],
    ["Hand footage to videographer", 7, ["ONE-TIME"]],
    ["Check flight refund", 5, ["ONE-TIME"]],
    ["Update refund status", 5, ["ONE-TIME"]],
    ["Find password solution", 6, ["ONE-TIME"]],
    ["Meet Amjit Sir", 6, ["MEETING"]],
    ["Explore all subscriptions", 5, ["ONE-TIME"]],
    ["Top purchases review", 5, ["ONE-TIME"]],
    ["Clear gallery", 4, ["ONE-TIME"]],
    ["Recover Instagram account", 9, ["URGENT"]],
    ["Make new Instagram page", 8, ["ONE-TIME"]],
    ["Get all videos on new page", 7, ["ONE-TIME"]],
    ["Schedule content on new page", 8, ["ONE-TIME"]],
    ["Make new Farhaan business email", 7, ["ONE-TIME"]],
    ["Get secondary backup email", 6, ["ONE-TIME"]],
    ["Setup 2-step verification on all Instagram accounts", 7, ["ONE-TIME"]],
    ["Interact setup", 7, ["ONE-TIME"]],
    ["Research Qatar Living laptop/mobile/iPhone/TV/HDD/SSD", 5, ["ONE-TIME"]],
    ["Check d4d iPhone offer", 4, ["ONE-TIME"]],
    ["Brief editor style guide", 6, ["ONE-TIME"]],
    ["Facebook Marketplace setup", 6, ["ONE-TIME"]],
    ["Qatar Living listings setup", 5, ["ONE-TIME"]],
  ],
  2: [
    ["Plan all finances", 8, ["ONE-TIME"]],
    ["Bilal meeting", 6, ["MEETING"]],
    ["Riyazka meeting", 6, ["MEETING"]],
  ],
  3: [
    ["Teach AI video to Zayed & Manha", 7, ["ONE-TIME"]],
    ["Amjit Sir weekly meeting", 6, ["MEETING"]],
    ["Nihal's house", 5, ["MEETING"]],
  ],
  4: [],
  5: [
    ["Founding sales completion", 8, ["ONE-TIME"]],
    ["MJ niche supplier research", 6, ["ONE-TIME"]],
    ["Manager SOP send to Aisha", 7, ["ONE-TIME"]],
  ],
  6: [
    ["MJ AI customer support system", 9, ["ONE-TIME"]],
    ["MJ reseller website", 9, ["ONE-TIME"]],
    ["Points system website", 8, ["ONE-TIME"]],
    ["Islamic page 30+ posts", 8, ["ONE-TIME"]],
    ["AI page 20+ posts", 7, ["ONE-TIME"]],
    ["MJ YouTube channel setup", 7, ["ONE-TIME"]],
  ],
  7: [
    ["100 carousel posts scheduled", 9, ["ONE-TIME"]],
    ["200 caption posts scheduled", 9, ["ONE-TIME"]],
    ["Full team handoff doc", 7, ["ONE-TIME"]],
    ["1-page action plan post-Qatar", 7, ["ONE-TIME"]],
    ["Weekly meeting with Muhammad", 6, ["MEETING"]],
  ],
};

/* =========================================================================
   HELPERS
   ========================================================================= */

const uid = () => Math.random().toString(36).slice(2, 11);

const MONDAY_JUNE_16 = new Date(2026, 6, 10); // Day 1 = Friday July 10, 2026

const fmtDate = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;

function buildWeek(mondayISO: string, weekNumber: number): DayData[] {
  const monday = new Date(mondayISO);
  const days: DayData[] = [];
  for (let i = 0; i < 7; i++) {
    const dayNum = i + 1;
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);

    const sections: Section[] = [
      ...CORE_SECTIONS,
      ...(DAY_SPECIFIC[dayNum] ?? []),
    ];

    const tasks: Task[] = [];
    // core sections
    for (const sec of CORE_SECTIONS) {
      const seeds = SEED_CORE[sec.id];
      if (seeds) {
        for (const [title, points] of seeds) {
          tasks.push({
            id: uid(),
            title,
            points,
            status: "pending",
            sectionId: sec.id,
          });
        }
      }
    }
    // day 7 extra muhammad
    if (dayNum === 7) {
      tasks.push({
        id: uid(),
        title: DAY7_MUHAMMAD_EXTRA[0],
        points: DAY7_MUHAMMAD_EXTRA[1],
        badges: DAY7_MUHAMMAD_EXTRA[2],
        status: "pending",
        sectionId: "muhammad",
      });
    }
    // one-time
    for (const [title, points, badges] of ONE_TIME_BY_DAY[dayNum] ?? []) {
      tasks.push({
        id: uid(),
        title,
        points,
        badges,
        status: "pending",
        sectionId: "onetime",
      });
    }
    // day-specific
    const daySpecificSeeds = SEED_DAY_SPECIFIC[dayNum] ?? {};
    for (const secId of Object.keys(daySpecificSeeds)) {
      for (const [title, points] of daySpecificSeeds[secId]) {
        tasks.push({
          id: uid(),
          title,
          points,
          status: "pending",
          sectionId: secId,
        });
      }
    }

    days.push({
      date: fmtDate(d),
      isoDate: d.toISOString(),
      sections,
      tasks,
      notes: [],
    });
  }
  // ignore weekNumber, but keeping arg for API sym
  void weekNumber;
  return days;
}

function initialState(): AppState {
  return {
    weekStartISO: MONDAY_JUNE_16.toISOString(),
    weekNumber: 1,
    days: buildWeek(MONDAY_JUNE_16.toISOString(), 1),
    history: [],
  };
}

const STORAGE_KEY = "weekly-tracker-v2";

/* =========================================================================
   MAIN COMPONENT
   ========================================================================= */

function TrackerApp() {
  const [state, setState] = useState<AppState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [activeDay, setActiveDay] = useState(1); // 1-indexed
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, hydrated]);

  useEffect(() => {
    setSelected(new Set());
    setSelectMode(false);
  }, [activeDay]);

  const day = state.days[activeDay - 1];

  /* ---------- global stats ---------- */
  const globalStats = useMemo(() => {
    let done = 0,
      total = 0,
      pts = 0,
      totalPts = 0;
    for (const d of state.days) {
      for (const t of d.tasks) {
        total += 1;
        totalPts += t.points;
        if (t.status === "done") {
          done += 1;
          pts += t.points;
        }
      }
    }
    return { done, total, pts, totalPts };
  }, [state.days]);

  /* ---------- day stats helper ---------- */
  const dayStats = (d: DayData) => {
    let done = 0,
      pts = 0,
      totalPts = 0;
    for (const t of d.tasks) {
      totalPts += t.points;
      if (t.status === "done") {
        done += 1;
        pts += t.points;
      }
    }
    return { done, total: d.tasks.length, pts, totalPts };
  };

  /* ---------- mutation helpers ---------- */
  const updateDay = (idx: number, fn: (d: DayData) => DayData) => {
    setState((s) => ({
      ...s,
      days: s.days.map((d, i) => (i === idx ? fn(d) : d)),
    }));
  };

  const cycleTask = (taskId: string) => {
    updateDay(activeDay - 1, (d) => ({
      ...d,
      tasks: d.tasks.map((t) => {
        if (t.id !== taskId) return t;
        const next: TaskStatus =
          t.status === "pending" ? "done" : t.status === "done" ? "carry" : "pending";
        return { ...t, status: next };
      }),
    }));

    // Handle carry-over cascade: if became "carry", add copy to next day at top
    setState((s) => {
      const dIdx = activeDay - 1;
      const t = s.days[dIdx].tasks.find((x) => x.id === taskId);
      if (!t) return s;
      // We just cycled; determine what its status IS now (after cycle) — recompute
      // But state above already updated it. Recompute here isn't safe because setState hasn't applied yet.
      // Instead: peek prior status and predict.
      return s;
    });
  };

  // Better: single setState that handles cascade
  const cycleTaskFull = (taskId: string) => {
    setState((s) => {
      const dIdx = activeDay - 1;
      const d = s.days[dIdx];
      const t = d.tasks.find((x) => x.id === taskId);
      if (!t) return s;
      const prevStatus = t.status;
      const nextStatus: TaskStatus =
        prevStatus === "pending" ? "done" : prevStatus === "done" ? "carry" : "pending";

      const newDays = s.days.map((day, i) =>
        i === dIdx
          ? {
              ...day,
              tasks: day.tasks.map((x) =>
                x.id === taskId ? { ...x, status: nextStatus } : x
              ),
            }
          : day,
      );

      // Cascade: adding to next day when becoming "carry"
      const nextIdx = dIdx + 1;
      if (nextStatus === "carry" && nextIdx < 7) {
        // if a carried copy already exists (from earlier), skip
        const alreadyThere = newDays[nextIdx].tasks.some(
          (x) => x.carriedFromDay === activeDay && x.title === t.title,
        );
        if (!alreadyThere) {
          const carried: Task = {
            id: uid(),
            title: t.title,
            points: t.points,
            status: "pending",
            sectionId: t.sectionId,
            badges: t.badges,
            carriedFromDay: activeDay,
          };
          // prepend
          newDays[nextIdx] = {
            ...newDays[nextIdx],
            tasks: [carried, ...newDays[nextIdx].tasks],
          };
        }
      }
      // If reverting from carry to pending, remove the cascaded copy
      if (prevStatus === "carry" && nextIdx < 7) {
        newDays[nextIdx] = {
          ...newDays[nextIdx],
          tasks: newDays[nextIdx].tasks.filter(
            (x) => !(x.carriedFromDay === activeDay && x.title === t.title),
          ),
        };
      }

      return { ...s, days: newDays };
    });
  };

  const deleteTask = (taskId: string) => {
    updateDay(activeDay - 1, (d) => ({
      ...d,
      tasks: d.tasks.filter((t) => t.id !== taskId),
    }));
  };

  const bulkMoveCarry = () => {
    setState((s) => {
      const dIdx = activeDay - 1;
      const nextIdx = dIdx + 1;
      const day = s.days[dIdx];
      const chosen = day.tasks.filter((t) => selected.has(t.id));
      const newDays = s.days.map((d, i) =>
        i === dIdx
          ? {
              ...d,
              tasks: d.tasks.map((t) =>
                selected.has(t.id) ? { ...t, status: "carry" as TaskStatus } : t,
              ),
            }
          : d,
      );
      if (nextIdx < 7) {
        const existing = newDays[nextIdx].tasks;
        const carried: Task[] = chosen
          .filter(
            (t) =>
              !existing.some(
                (x) => x.carriedFromDay === activeDay && x.title === t.title,
              ),
          )
          .map((t) => ({
            id: uid(),
            title: t.title,
            points: t.points,
            status: "pending",
            sectionId: t.sectionId,
            badges: t.badges,
            carriedFromDay: activeDay,
          }));
        newDays[nextIdx] = {
          ...newDays[nextIdx],
          tasks: [...carried, ...existing],
        };
      }
      return { ...s, days: newDays };
    });
    setSelected(new Set());
    setSelectMode(false);
  };

  const bulkDelete = () => {
    updateDay(activeDay - 1, (d) => ({
      ...d,
      tasks: d.tasks.filter((t) => !selected.has(t.id)),
    }));
    setSelected(new Set());
    setSelectMode(false);
  };

  /* ---------- notes ---------- */
  const addNote = () => {
    updateDay(activeDay - 1, (d) => ({
      ...d,
      notes: [...d.notes, { id: uid(), text: "", status: "pending" }],
    }));
  };
  const updateNoteText = (id: string, text: string) => {
    updateDay(activeDay - 1, (d) => ({
      ...d,
      notes: d.notes.map((n) => (n.id === id ? { ...n, text } : n)),
    }));
  };
  const markNoteDone = (id: string) => {
    updateDay(activeDay - 1, (d) => ({
      ...d,
      notes: d.notes.map((n) =>
        n.id === id ? { ...n, status: n.status === "done" ? "pending" : "done" } : n,
      ),
    }));
  };
  const carryNote = (id: string) => {
    setState((s) => {
      const dIdx = activeDay - 1;
      const nextIdx = dIdx + 1;
      const note = s.days[dIdx].notes.find((n) => n.id === id);
      if (!note || nextIdx >= 7) return s;
      const newDays = [...s.days];
      newDays[nextIdx] = {
        ...newDays[nextIdx],
        notes: [
          ...newDays[nextIdx].notes,
          { id: uid(), text: note.text, status: "pending", carriedFromDay: activeDay },
        ],
      };
      return { ...s, days: newDays };
    });
  };
  const deleteNote = (id: string) => {
    updateDay(activeDay - 1, (d) => ({
      ...d,
      notes: d.notes.filter((n) => n.id !== id),
    }));
  };

  /* ---------- add task ---------- */
  const addTask = (opts: {
    title: string;
    points: number;
    sectionId: string;
    sectionLabel?: string;
    sectionColor?: string;
    daily: boolean;
  }) => {
    setState((s) => {
      const targetIdxs = opts.daily ? [0, 1, 2, 3, 4, 5, 6] : [activeDay - 1];
      const newDays = s.days.map((d, i) => {
        if (!targetIdxs.includes(i)) return d;
        // ensure section exists on this day
        let sections = d.sections;
        if (!sections.some((sec) => sec.id === opts.sectionId)) {
          sections = [
            ...sections,
            {
              id: opts.sectionId,
              label: opts.sectionLabel ?? opts.sectionId,
              color: opts.sectionColor ?? "#6B7280",
            },
          ];
        }
        return {
          ...d,
          sections,
          tasks: [
            ...d.tasks,
            {
              id: uid(),
              title: opts.title,
              points: opts.points,
              status: "pending" as TaskStatus,
              sectionId: opts.sectionId,
              custom: true,
            } satisfies Task,

          ],
        };
      });
      return { ...s, days: newDays };
    });
  };

  /* ---------- week rollover ---------- */
  const rollover = () => {
    setState((s) => {
      let totalDone = 0,
        totalTasks = 0,
        totalPts = 0,
        totalPtsAll = 0;
      for (const d of s.days) {
        for (const t of d.tasks) {
          totalTasks += 1;
          totalPtsAll += t.points;
          if (t.status === "done") {
            totalDone += 1;
            totalPts += t.points;
          }
        }
      }
      const firstD = new Date(s.days[0].isoDate);
      const lastD = new Date(s.days[6].isoDate);
      const snap: WeekHistory = {
        week: s.weekNumber,
        range: `${fmtDate(firstD)} – ${fmtDate(lastD)}`,
        taskPct: totalTasks ? Math.round((totalDone / totalTasks) * 100) : 0,
        ptsPct: totalPtsAll ? Math.round((totalPts / totalPtsAll) * 100) : 0,
        tasksDone: totalDone,
        tasksTotal: totalTasks,
      };
      const nextMonday = new Date(s.weekStartISO);
      nextMonday.setDate(nextMonday.getDate() + 7);
      return {
        weekStartISO: nextMonday.toISOString(),
        weekNumber: s.weekNumber + 1,
        days: buildWeek(nextMonday.toISOString(), s.weekNumber + 1),
        history: [...s.history, snap],
      };
    });
    setActiveDay(1);
  };

  const resetAll = () => {
    if (confirm("Reset entire tracker to Week 1? This clears all progress and history.")) {
      setState(initialState());
      setActiveDay(1);
    }
  };

  if (!hydrated) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Weekly Task Tracker
          </h1>
          <p className="text-sm text-muted-foreground">
            Week {state.weekNumber} · {fmtDate(new Date(state.days[0].isoDate))} –{" "}
            {fmtDate(new Date(state.days[6].isoDate))}
          </p>
        </header>

        {/* Global stats */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <StatBox
            label="Tasks Complete"
            value={`${globalStats.done} / ${globalStats.total}`}
            pct={
              globalStats.total ? (globalStats.done / globalStats.total) * 100 : 0
            }
            barColor="var(--stat-green)"
          />
          <StatBox
            label="Points Earned"
            value={`${globalStats.pts} / ${globalStats.totalPts} pts`}
            pct={
              globalStats.totalPts
                ? (globalStats.pts / globalStats.totalPts) * 100
                : 0
            }
            barColor="var(--stat-purple)"
          />
        </div>

        {/* History */}
        {state.history.length > 0 && (
          <div className="mb-4 rounded-lg border border-purple-300/40 bg-purple-500/10 p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">
              Weekly History
            </h3>
            <ul className="space-y-1 text-sm">
              {state.history.map((h) => (
                <li key={h.week}>
                  <span className="font-semibold">Week {h.week}</span> ({h.range}
                  ): {h.taskPct}% tasks · {h.ptsPct}% pts ({h.tasksDone}/
                  {h.tasksTotal})
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Rollover */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={rollover}
            className="rounded-md bg-[var(--stat-purple)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
          >
            ⏭ Carry Forward to Next Week (+7 days)
          </button>
          <button
            onClick={resetAll}
            className="rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-accent"
          >
            Reset all
          </button>
        </div>

        {/* Day tabs */}
        <div className="mb-4 flex flex-wrap gap-2">
          {state.days.map((d, i) => {
            const st = dayStats(d);
            const pct = st.total ? st.done / st.total : 0;
            const activeCls = activeDay === i + 1 ? "ring-2 ring-ring" : "";
            let bg = "bg-secondary text-secondary-foreground";
            if (pct === 1 && st.total > 0)
              bg = "bg-[var(--stat-green)] text-white";
            else if (pct > 0) bg = "bg-amber-500 text-white";
            return (
              <button
                key={i}
                onClick={() => setActiveDay(i + 1)}
                className={`rounded-md px-3 py-2 text-xs font-medium transition ${bg} ${activeCls}`}
              >
                <div>Day {i + 1}</div>
                <div className="text-[10px] opacity-90">
                  {d.date}
                  {st.done > 0 ? ` · ${st.done}/${st.total}` : ""}
                </div>
              </button>
            );
          })}
        </div>

        <DayPanel
          day={day}
          dayNumber={activeDay}
          selectMode={selectMode}
          setSelectMode={setSelectMode}
          selected={selected}
          setSelected={setSelected}
          onCycleTask={cycleTaskFull}
          onDeleteTask={deleteTask}
          onBulkCarry={bulkMoveCarry}
          onBulkDelete={bulkDelete}
          onAddNote={addNote}
          onNoteText={updateNoteText}
          onNoteDone={markNoteDone}
          onNoteCarry={carryNote}
          onNoteDelete={deleteNote}
          onAddTask={addTask}
        />

        {/* Mini overview */}
        <div className="mt-8">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            7-Day Overview
          </h3>
          <div className="grid grid-cols-7 gap-2">
            {state.days.map((d, i) => {
              const st = dayStats(d);
              const pct = st.total ? st.done / st.total : 0;
              let bg = "bg-secondary";
              if (pct === 1 && st.total > 0) bg = "bg-[var(--stat-green)]";
              else if (pct > 0.5) bg = "bg-green-400";
              else if (pct > 0) bg = "bg-amber-400";
              return (
                <button
                  key={i}
                  onClick={() => setActiveDay(i + 1)}
                  className={`flex h-16 flex-col items-center justify-center rounded-md text-xs font-medium transition ${bg} ${
                    pct > 0 ? "text-white" : "text-muted-foreground"
                  }`}
                >
                  <span>D{i + 1}</span>
                  <span className="text-[10px] opacity-90">
                    {Math.round(pct * 100)}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   STAT BOX
   ========================================================================= */
function StatBox({
  label,
  value,
  pct,
  barColor,
}: {
  label: string;
  value: string;
  pct: number;
  barColor: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-sm font-semibold">{value}</span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, pct)}%`, background: barColor }}
        />
      </div>
      <div className="mt-1 text-right text-[11px] text-muted-foreground">
        {Math.round(pct)}%
      </div>
    </div>
  );
}

/* =========================================================================
   DAY PANEL
   ========================================================================= */

interface DayPanelProps {
  day: DayData;
  dayNumber: number;
  selectMode: boolean;
  setSelectMode: (v: boolean) => void;
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  onCycleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onBulkCarry: () => void;
  onBulkDelete: () => void;
  onAddNote: () => void;
  onNoteText: (id: string, text: string) => void;
  onNoteDone: (id: string) => void;
  onNoteCarry: (id: string) => void;
  onNoteDelete: (id: string) => void;
  onAddTask: (opts: {
    title: string;
    points: number;
    sectionId: string;
    sectionLabel?: string;
    sectionColor?: string;
    daily: boolean;
  }) => void;
}

function DayPanel({
  day,
  dayNumber,
  selectMode,
  setSelectMode,
  selected,
  setSelected,
  onCycleTask,
  onDeleteTask,
  onBulkCarry,
  onBulkDelete,
  onAddNote,
  onNoteText,
  onNoteDone,
  onNoteCarry,
  onNoteDelete,
  onAddTask,
}: DayPanelProps) {
  const doneCount = day.tasks.filter((t) => t.status === "done").length;
  const totalCount = day.tasks.length;
  const pts = day.tasks.reduce((a, t) => a + (t.status === "done" ? t.points : 0), 0);
  const totalPts = day.tasks.reduce((a, t) => a + t.points, 0);

  const carriedTasks = day.tasks.filter((t) => t.carriedFromDay);

  // Video pipeline strip: 3 conceptual checkpoints — done based on video tasks
  const videoTasks = day.tasks.filter((t) => t.sectionId === "video");
  const videoDone = videoTasks.filter((t) => t.status === "done").length;

  const toggleSelect = (id: string) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelected(s);
  };

  // Group tasks by section, preserving order of day.sections
  const grouped = day.sections
    .map((sec) => ({
      section: sec,
      tasks: day.tasks.filter((t) => t.sectionId === sec.id && !t.carriedFromDay),
    }))
    .filter((g) => g.tasks.length > 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      {/* Day header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            Day {dayNumber} · {day.date}
          </h2>
          <div className="mt-1 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>
              Tasks: {doneCount}/{totalCount}
            </span>
            <span>
              Points: {pts}/{totalPts}
            </span>
          </div>
        </div>
        <button
          onClick={() => {
            setSelectMode(!selectMode);
            if (selectMode) setSelected(new Set());
          }}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-accent"
        >
          ☑ {selectMode ? "Cancel select" : "Select Tasks"}
        </button>
      </div>

      {/* Progress bars */}
      <div className="mb-4 space-y-2">
        <div>
          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
            <span>Tasks</span>
            <span>
              {totalCount ? Math.round((doneCount / totalCount) * 100) : 0}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-[var(--stat-green)] transition-all"
              style={{
                width: `${totalCount ? (doneCount / totalCount) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
            <span>Points</span>
            <span>{totalPts ? Math.round((pts / totalPts) * 100) : 0}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-[var(--stat-purple)] transition-all"
              style={{ width: `${totalPts ? (pts / totalPts) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Video pipeline strip */}
      {videoTasks.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-2">
          {[
            { label: "→ Send", threshold: 1 },
            { label: "5 in", threshold: 2 },
            { label: "5 out", threshold: 4 },
          ].map((cell, i) => {
            const active = videoDone >= cell.threshold;
            return (
              <div
                key={i}
                className={`rounded-md p-2 text-center text-xs font-medium transition ${
                  active
                    ? "bg-[var(--stat-green)] text-white"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {cell.label}
              </div>
            );
          })}
        </div>
      )}

      {/* Carried over */}
      {carriedTasks.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-400/50 bg-amber-500/10 p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
            ↻ Carried over today ({carriedTasks.length}{" "}
            {carriedTasks.length === 1 ? "task" : "tasks"})
          </h3>
          <div className="space-y-1.5">
            {carriedTasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                selectMode={selectMode}
                selected={selected.has(t.id)}
                onToggleSelect={() => toggleSelect(t.id)}
                onCycle={() => onCycleTask(t.id)}
                onDelete={() => onDeleteTask(t.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selectMode && selected.size > 0 && (
        <div className="sticky top-2 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-background/95 p-2 shadow-md backdrop-blur">
          <span className="text-xs font-medium">
            {selected.size} task{selected.size === 1 ? "" : "s"} selected
          </span>
          <button
            onClick={onBulkCarry}
            className="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
          >
            ↻ Move to Next Day
          </button>
          <button
            onClick={onBulkDelete}
            className="rounded-md bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground hover:opacity-90"
          >
            🗑 Delete Selected
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent"
          >
            ✕ Clear
          </button>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-5">
        {grouped.map((g) => (
          <section key={g.section.id}>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: g.section.color }}
              />
              <span>{g.section.label}</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                ({g.tasks.filter((t) => t.status === "done").length}/{g.tasks.length})
              </span>
            </h3>
            <div className="space-y-1.5">
              {g.tasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  selectMode={selectMode}
                  selected={selected.has(t.id)}
                  onToggleSelect={() => toggleSelect(t.id)}
                  onCycle={() => onCycleTask(t.id)}
                  onDelete={() => onDeleteTask(t.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Notepad */}
      <div className="mt-6 rounded-lg border border-border bg-secondary/50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Notepad</h3>
          <button
            onClick={onAddNote}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs font-medium hover:bg-accent"
          >
            + Add note
          </button>
        </div>
        {day.notes.length === 0 && (
          <p className="text-xs text-muted-foreground">No notes yet.</p>
        )}
        <div className="space-y-2">
          {day.notes.map((n) => (
            <div
              key={n.id}
              className={`flex flex-wrap items-center gap-2 rounded-md border border-border bg-background p-2 ${
                n.status === "done" ? "opacity-60" : ""
              }`}
            >
              {n.carriedFromDay && (
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-300">
                  ↻ from Day {n.carriedFromDay}
                </span>
              )}
              <input
                type="text"
                value={n.text}
                onChange={(e) => onNoteText(n.id, e.target.value)}
                placeholder="Type a note..."
                className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${
                  n.status === "done" ? "line-through" : ""
                }`}
              />
              <button
                onClick={() => onNoteDone(n.id)}
                className={`rounded-md px-2 py-1 text-xs font-medium ${
                  n.status === "done"
                    ? "bg-[var(--stat-green)] text-white"
                    : "border border-input hover:bg-accent"
                }`}
              >
                ✓ Done
              </button>
              <button
                onClick={() => onNoteCarry(n.id)}
                className="rounded-md border border-input bg-background px-2 py-1 text-xs font-medium hover:bg-accent"
              >
                ↻ Carry
              </button>
              <button
                onClick={() => onNoteDelete(n.id)}
                className="rounded-md border border-input bg-background px-2 py-1 text-xs font-medium hover:bg-accent"
                aria-label="Delete note"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Add task */}
      <AddTaskForm sections={day.sections} onAdd={onAddTask} />
    </div>
  );
}

/* =========================================================================
   TASK ROW
   ========================================================================= */

function TaskRow({
  task,
  selectMode,
  selected,
  onToggleSelect,
  onCycle,
  onDelete,
}: {
  task: Task;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onCycle: () => void;
  onDelete: () => void;
}) {
  const isDone = task.status === "done";
  const isCarry = task.status === "carry";
  const isUrgent = task.badges?.some((b) => b === "OVERDUE" || b === "URGENT");

  let bg = "bg-background";
  if (isDone) bg = "bg-green-500/15";
  else if (isCarry) bg = "bg-orange-500/15";

  let ptsBg = "bg-secondary text-muted-foreground";
  if (isDone) ptsBg = "bg-[var(--stat-green)] text-white";
  else if (isCarry) ptsBg = "bg-orange-500 text-white";

  return (
    <div
      className={`flex items-center gap-2 rounded-md border p-2 transition ${bg} ${
        isUrgent ? "border-red-500/60 shadow-[0_0_0_1px_rgba(239,68,68,0.35)]" : "border-border"
      }`}
    >
      {selectMode && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="h-4 w-4"
        />
      )}
      <button
        onClick={onCycle}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs transition ${
          isDone
            ? "border-transparent bg-[var(--stat-green)] text-white"
            : isCarry
              ? "border-transparent bg-orange-500 text-white"
              : "border-input bg-background"
        }`}
        aria-label="Cycle task status"
      >
        {isDone ? "✓" : isCarry ? "↻" : ""}
      </button>
      <div
        className={`flex-1 cursor-pointer text-sm ${
          isDone ? "line-through text-muted-foreground" : ""
        }`}
        onClick={onCycle}
      >
        <span>{task.title}</span>
        {task.carriedFromDay && (
          <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-300">
            ↻ from Day {task.carriedFromDay}
          </span>
        )}
        {task.badges?.map((b) => (
          <span
            key={b}
            className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
              b === "OVERDUE"
                ? "bg-red-500 text-white"
                : b === "URGENT"
                  ? "bg-orange-500 text-white"
                  : b === "MEETING"
                    ? "bg-blue-500 text-white"
                    : "bg-purple-500 text-white"
            }`}
          >
            {b}
          </span>
        ))}
      </div>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ptsBg}`}>
        {task.points}pt
      </span>
      <button
        onClick={onDelete}
        aria-label="Delete task"
        className="rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
      >
        🗑
      </button>
    </div>
  );
}

/* =========================================================================
   ADD TASK FORM
   ========================================================================= */

function AddTaskForm({
  sections,
  onAdd,
}: {
  sections: Section[];
  onAdd: (opts: {
    title: string;
    points: number;
    sectionId: string;
    sectionLabel?: string;
    sectionColor?: string;
    daily: boolean;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [points, setPoints] = useState(5);
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? "onetime");
  const [newSectionMode, setNewSectionMode] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [daily, setDaily] = useState(false);

  const submit = () => {
    if (!title.trim()) return;
    if (newSectionMode) {
      const name = newSectionName.trim();
      if (!name) return;
      const id = `custom-${name.toLowerCase().replace(/\s+/g, "-")}-${uid()}`;
      onAdd({
        title: title.trim(),
        points,
        sectionId: id,
        sectionLabel: name,
        sectionColor: "#6B7280",
        daily,
      });
    } else {
      const sec = sections.find((s) => s.id === sectionId);
      onAdd({
        title: title.trim(),
        points,
        sectionId,
        sectionLabel: sec?.label,
        sectionColor: sec?.color,
        daily,
      });
    }
    setTitle("");
    setPoints(5);
    setNewSectionName("");
    setNewSectionMode(false);
    setDaily(false);
  };

  return (
    <div className="mt-6 rounded-lg border border-dashed border-border p-3">
      <h3 className="mb-3 text-sm font-semibold">+ Add Task</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task name..."
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          value={newSectionMode ? "__new" : sectionId}
          onChange={(e) => {
            if (e.target.value === "__new") setNewSectionMode(true);
            else {
              setNewSectionMode(false);
              setSectionId(e.target.value);
            }
          }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
          <option value="__new">+ Add New Section</option>
        </select>
      </div>
      {newSectionMode && (
        <input
          type="text"
          value={newSectionName}
          onChange={(e) => setNewSectionName(e.target.value)}
          placeholder="New section name..."
          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      )}
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">Points</span>
          <button
            onClick={() => setPoints((p) => Math.max(1, p - 1))}
            className="h-7 w-7 rounded-md border border-input bg-background text-sm hover:bg-accent"
          >
            −
          </button>
          <span className="w-6 text-center text-sm font-semibold">{points}</span>
          <button
            onClick={() => setPoints((p) => Math.min(10, p + 1))}
            className="h-7 w-7 rounded-md border border-input bg-background text-sm hover:bg-accent"
          >
            +
          </button>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={daily}
            onChange={(e) => setDaily(e.target.checked)}
          />
          <span>Daily (add to all 7 days)</span>
        </label>
        <button
          onClick={submit}
          className="ml-auto rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Add Task
        </button>
      </div>
    </div>
  );
}
