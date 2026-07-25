import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AuthGate } from "@/components/AuthGate";
import { useCloudSync } from "@/hooks/useCloudSync";
import { AppShell, type AppView } from "@/components/AppShell";
import { GroupsView } from "@/components/groups/GroupsView";
import { NotificationsView } from "@/components/NotificationsView";
import { MentorView } from "@/components/MentorView";
import { LeaderboardView } from "@/components/LeaderboardView";
import { AdminView } from "@/components/AdminView";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Flame, Calendar, Download, Upload, Forward, X } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "7 Day Weekly Task Tracker & Daily Planner" },
      {
        name: "description",
        content:
          "A 7-day weekly task tracker with points, carry-over, notepads, and bulk actions to plan every day with focus.",
      },
      { property: "og:title", content: "7 Day Weekly Task Tracker & Daily Planner" },
      {
        property: "og:description",
        content:
          "A 7-day weekly task tracker with points, carry-over, notepads, and bulk actions to plan every day with focus.",
      },
    ],
  }),
  component: RouteRoot,
});

function RouteRoot() {
  return <AuthGate>{({ user, signOut }) => <TrackerApp user={user} signOut={signOut} />}</AuthGate>;
}

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
  carriedForward?: boolean; // carried from a previous week (item 5)
  custom?: boolean;
  isStreak?: boolean; // streak task (item 3)
  streakCount?: number; // current streak length (item 3)
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
  daysSnapshot?: DayData[]; // read-only snapshot for history drill-down (item 7)
}

interface AppState {
  weekStartISO: string; // Monday
  weekNumber: number;
  days: DayData[];
  history: WeekHistory[];
  ui?: {
    isDemo?: boolean;
    demoBannerDismissed?: boolean;
  };
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

// Minimal CSV row parser supporting quoted fields and doubled-quote escapes.
function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function buildWeek(mondayISO: string, weekNumber: number): DayData[] {
  const monday = new Date(mondayISO);
  const days: DayData[] = [];
  for (let i = 0; i < 7; i++) {
    const dayNum = i + 1;
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);

    const sections: Section[] = [...CORE_SECTIONS, ...(DAY_SPECIFIC[dayNum] ?? [])];

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

/* Demo starter template shown to first-time users */
const DEMO_SECTIONS: Section[] = [
  { id: "demo-morning", label: "Morning Routine", color: "#D4537E" },
  { id: "demo-sleep", label: "Sleep & Recovery", color: "#378ADD" },
  { id: "demo-exercise", label: "Exercise & Health", color: "#639922" },
  { id: "demo-personal", label: "Personal Development", color: "#7F77DD" },
  { id: "demo-deen", label: "Deen & Personal Development", color: "#BA7517" },
];

const DEMO_TASKS: Record<string, [string, number][]> = {
  "demo-morning": [
    ["Get up at 4:00 AM", 4],
    ["Drink a full glass of water immediately", 3],
    ["10 min journaling or planning your day", 4],
    ["Read for 20 minutes", 4],
  ],
  "demo-sleep": [
    ["Sleep by 10:00 PM", 5],
    ["No screen time 30 min before bed", 4],
    ["Prepare tomorrow's clothes and bag", 3],
  ],
  "demo-exercise": [
    ["Do a 1-hour workout", 5],
    ["Post-workout stretch 10 min", 3],
    ["Track calories or meals today", 3],
  ],
  "demo-personal": [
    ["Learn something new for 30 min", 5],
    ["Listen to a podcast or audiobook", 4],
    ["Review your goals for the week", 4],
  ],
  "demo-deen": [
    ["Learn something new for 30 min", 5],
    ["Listen to a podcast or audiobook", 4],
    ["Review your goals for the week", 4],
    ["Listen to Islamic class Dars for 30 minutes", 7],
    ["Fajr prayer", 6],
    ["Tahajjud", 10],
    ["Workout — 40 pushups total", 4],
    ["Recite five pages of the Quran and memorize two ayahs", 6],
  ],
};

function buildDemoWeek(mondayISO: string): DayData[] {
  const monday = new Date(mondayISO);
  const days: DayData[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const tasks: Task[] = [];
    for (const sec of DEMO_SECTIONS) {
      for (const [title, points] of DEMO_TASKS[sec.id] ?? []) {
        tasks.push({
          id: uid(),
          title,
          points,
          status: "pending",
          sectionId: sec.id,
          custom: true,
        });
      }
    }
    days.push({
      date: fmtDate(d),
      isoDate: d.toISOString(),
      sections: [...DEMO_SECTIONS],
      tasks,
      notes: [],
    });
  }
  return days;
}

function buildDemoState(): AppState {
  return {
    weekStartISO: MONDAY_JUNE_16.toISOString(),
    weekNumber: 1,
    days: buildDemoWeek(MONDAY_JUNE_16.toISOString()),
    history: [],
    ui: { isDemo: true, demoBannerDismissed: false },
  };
}

const STORAGE_KEY = "weekly-tracker-v2";

/* =========================================================================
   MAIN COMPONENT
   ========================================================================= */

interface TrackerProps {
  user: User;
  signOut: () => Promise<void>;
  mentorMode?: {
    targetUserId: string;
    targetName: string;
    targetAvatar?: string | null;
    onBack: () => void;
  };
}

export function TrackerApp({ user, signOut, mentorMode }: TrackerProps) {
  const syncUserId = mentorMode?.targetUserId ?? user.id;
  const [state, setState] = useState<AppState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [activeDay, setActiveDay] = useState(1); // 1-indexed
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setHydrated(false);
    setCloudReady(false);
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}:${syncUserId}`);
      if (raw) setState(JSON.parse(raw));
      else setState(initialState());
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [syncUserId]);

  const {
    status: syncStatus,
    online,
    remotePulse,
  } = useCloudSync<AppState>({
    userId: syncUserId,
    state,
    setState,
    hydrated,
    ready: cloudReady,
    onReady: () => setCloudReady(true),
    buildFirstTime: buildDemoState,
  });

  const [view, setView] = useState<AppView>("personal");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [historyDetail, setHistoryDetail] = useState<WeekHistory | null>(null);
  const [showEditDate, setShowEditDate] = useState(false);
  const [editDateTarget, setEditDateTarget] = useState<
    { kind: "day"; dayIndex: number } | { kind: "start" } | null
  >(null);
  const [editDateValue, setEditDateValue] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(`${STORAGE_KEY}:${syncUserId}`, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, hydrated, syncUserId]);

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
              tasks: day.tasks.map((x) => (x.id === taskId ? { ...x, status: nextStatus } : x)),
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
            (t) => !existing.some((x) => x.carriedFromDay === activeDay && x.title === t.title),
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
    isStreak?: boolean;
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
              isStreak: opts.isStreak,
              streakCount: 0,
            } satisfies Task,
          ],
        };
      });
      return { ...s, days: newDays };
    });
  };

  /* ---------- item 1: select-all helpers ---------- */
  // Select every task in a single section (category) on the active day.
  const selectAllInSection = (sectionId: string) => {
    const day = state.days[activeDay - 1];
    if (!day) return;
    const ids = day.tasks.filter((t) => t.sectionId === sectionId).map((t) => t.id);
    setSelected(new Set(ids));
    setSelectMode(true);
  };
  // Select all carried-over tasks across the whole week in one click.
  const selectAllCarried = () => {
    const ids: string[] = [];
    for (const d of state.days) {
      for (const t of d.tasks) {
        if (t.status === "carry") ids.push(t.id);
      }
    }
    setSelected(new Set(ids));
    setSelectMode(true);
  };

  /* ---------- item 2: edit date ---------- */
  const openEditDate = (target: { kind: "day"; dayIndex: number } | { kind: "start" }) => {
    if (target.kind === "day") {
      setEditDateValue(state.days[target.dayIndex].isoDate.slice(0, 10));
    } else {
      setEditDateValue(state.weekStartISO.slice(0, 10));
    }
    setEditDateTarget(target);
    setShowEditDate(true);
  };
  const applyEditDate = () => {
    if (!editDateTarget || !editDateValue) return;
    setState((s) => {
      if (editDateTarget.kind === "start") {
        const newStart = new Date(editDateValue + "T00:00:00");
        const shifted: DayData[] = s.days.map((d, i) => {
          const iso = new Date(newStart);
          iso.setDate(iso.getDate() + i);
          return {
            ...d,
            isoDate: iso.toISOString(),
            date: iso.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          };
        });
        return { ...s, weekStartISO: newStart.toISOString(), days: shifted };
      }
      // editing a single day's date — only the current week shifts
      const newDate = new Date(editDateValue + "T00:00:00");
      const shifted = s.days.map((d, i) =>
        i === editDateTarget.dayIndex
          ? {
              ...d,
              isoDate: newDate.toISOString(),
              date: newDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              }),
            }
          : d,
      );
      return { ...s, days: shifted };
    });
    setShowEditDate(false);
    setEditDateTarget(null);
  };

  /* ---------- item 10: CSV export / import ---------- */
  const exportCSV = () => {
    const rows = ["title,section,points,isStreak"];
    const seen = new Set<string>();
    for (const d of state.days) {
      for (const t of d.tasks) {
        const key = `${t.title}|${t.sectionId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const sec = d.sections.find((s2) => s2.id === t.sectionId)?.label ?? t.sectionId;
        const title = `"${t.title.replace(/"/g, '""')}"`;
        const section = `"${sec.replace(/"/g, '""')}"`;
        rows.push(`${title},${section},${t.points},${t.isStreak ? "true" : "false"}`);
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `week-${state.weekNumber}-tasks.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importCSV = (file: File) => {
    setCsvError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        setCsvError("CSV is empty or missing data rows.");
        return;
      }
      const header = lines[0].toLowerCase();
      if (!header.includes("title") || !header.includes("section") || !header.includes("points")) {
        setCsvError("CSV must have columns: title, section, points, isStreak.");
        return;
      }
      const parsed: {
        title: string;
        section: string;
        points: number;
        isStreak: boolean;
      }[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length < 3) {
          setCsvError(`Row ${i + 1} is malformed (too few columns).`);
          return;
        }
        const pts = Number(cols[2]);
        if (Number.isNaN(pts)) {
          setCsvError(`Row ${i + 1}: points "${cols[2]}" is not a number.`);
          return;
        }
        parsed.push({
          title: cols[0],
          section: cols[1],
          points: pts,
          isStreak: cols[3]?.toLowerCase() === "true",
        });
      }
      // Append imported tasks to the current day; ensure sections exist.
      setState((s) => {
        const dIdx = activeDay - 1;
        const newDays = s.days.map((d, i) => {
          if (i !== dIdx) return d;
          let sections = d.sections;
          let tasks = d.tasks;
          for (const p of parsed) {
            let sectionId = sections.find(
              (sec) => sec.label.toLowerCase() === p.section.toLowerCase(),
            )?.id;
            if (!sectionId) {
              sectionId = uid();
              sections = [...sections, { id: sectionId, label: p.section, color: "#6B7280" }];
            }
            tasks = [
              ...tasks,
              {
                id: uid(),
                title: p.title,
                points: p.points,
                status: "pending" as TaskStatus,
                sectionId,
                custom: true,
                isStreak: p.isStreak,
                streakCount: 0,
              } satisfies Task,
            ];
          }
          return { ...d, sections, tasks };
        });
        return { ...s, days: newDays };
      });
    };
    reader.onerror = () => setCsvError("Could not read the file.");
    reader.readAsText(file);
  };

  // Item 9: server-side admin check — the admin nav button only renders for
  // the single hardcoded account. Verified via the admin-auth edge function
  // (which checks the auth session server-side), NOT a client-side string
  // compare, so the icon never appears in the DOM for anyone else.
  useEffect(() => {
    if (mentorMode) return;
    (async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token ?? "";
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-auth`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ action: "check" }),
        });
        if (res.ok) {
          const data = (await res.json()) as { isAdmin?: boolean };
          if (data.isAdmin) setIsAdmin(true);
        }
      } catch {
        /* not admin or network error — stays hidden */
      }
    })();
  }, [user.id, mentorMode]);

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
        daysSnapshot: s.days.map((d) => ({
          ...d,
          tasks: d.tasks.map((t) => ({ ...t })),
          notes: d.notes.map((n) => ({ ...n })),
        })),
      };
      const nextMonday = new Date(s.weekStartISO);
      nextMonday.setDate(nextMonday.getDate() + 7);
      // Item 6 fix: preserve task definitions across weeks — only reset
      // completion status to pending. buildWeek() is no longer called here,
      // so custom tasks, sections, streak flags, and points survive rollover.
      const carriedForwardTasks = new Set<string>();
      const preservedDays: DayData[] = Array.from({ length: 7 }, (_, i) => {
        const iso = new Date(nextMonday);
        iso.setDate(iso.getDate() + i);
        const prev = s.days[i];
        const tasks: Task[] = (prev?.tasks ?? []).map((t) => {
          // preserve definition; reset status to pending in the new week.
          const fresh: Task = {
            ...t,
            id: crypto.randomUUID(),
            status: "pending" as TaskStatus,
            carriedFromDay: undefined,
            carriedForward: t.carriedForward, // retain the landing flag
          };
          return fresh;
        });
        const notes: Note[] = (prev?.notes ?? []).map((n) => ({
          ...n,
          id: crypto.randomUUID(),
          done: false,
        }));
        // collect carried-forward task titles for the landing section
        for (const t of tasks) {
          if (t.carriedForward) carriedForwardTasks.add(t.id);
        }
        return {
          date: iso.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          isoDate: iso.toISOString(),
          tasks,
          notes,
        };
      });
      return {
        weekStartISO: nextMonday.toISOString(),
        weekNumber: s.weekNumber + 1,
        days: preservedDays,
        history: [...s.history, snap],
      };
    });
    setActiveDay(1);
  };

  // Item 5: Carry Forward to Next Week — copies selected tasks into next
  // week's day 1. Distinct from the daily "carry" status. The task copies
  // land with carriedForward=true so a landing section can surface them.
  const carryForwardToNextWeek = (taskIds: string[]) => {
    if (taskIds.length === 0) return;
    setState((s) => {
      const nextMonday = new Date(s.weekStartISO);
      nextMonday.setDate(nextMonday.getDate() + 7);
      const targets: Task[] = [];
      for (const d of s.days) {
        for (const t of d.tasks) {
          if (taskIds.includes(t.id)) {
            targets.push({
              ...t,
              id: crypto.randomUUID(),
              status: "pending" as TaskStatus,
              carriedForward: true,
              carriedFromDay: undefined,
            });
          }
        }
      }
      // Build the next week preserving definitions (same fix as rollover),
      // then prepend carried-forward tasks to day 1.
      const preservedDays: DayData[] = Array.from({ length: 7 }, (_, i) => {
        const iso = new Date(nextMonday);
        iso.setDate(iso.getDate() + i);
        const prev = s.days[i];
        const tasks: Task[] = (prev?.tasks ?? []).map((t) => ({
          ...t,
          id: crypto.randomUUID(),
          status: "pending" as TaskStatus,
          carriedFromDay: undefined,
          carriedForward: t.carriedForward,
        }));
        const notes: Note[] = (prev?.notes ?? []).map((n) => ({
          ...n,
          id: crypto.randomUUID(),
          done: false,
        }));
        return {
          date: iso.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          isoDate: iso.toISOString(),
          tasks: i === 0 ? [...targets, ...tasks] : tasks,
          notes,
        };
      });
      const firstD = new Date(s.days[0].isoDate);
      const lastD = new Date(s.days[6].isoDate);
      const snap: WeekHistory = {
        week: s.weekNumber,
        range: `${fmtDate(firstD)} – ${fmtDate(lastD)}`,
        taskPct: 0,
        ptsPct: 0,
        tasksDone: 0,
        tasksTotal: 0,
        daysSnapshot: s.days.map((d) => ({
          ...d,
          tasks: d.tasks.map((t) => ({ ...t })),
          notes: d.notes.map((n) => ({ ...n })),
        })),
      };
      return {
        weekStartISO: nextMonday.toISOString(),
        weekNumber: s.weekNumber + 1,
        days: preservedDays,
        history: [...s.history, snap],
      };
    });
    setActiveDay(1);
  };

  const resetAll = () => {
    setShowResetDialog(true);
  };
  const confirmReset = () => {
    setState(initialState());
    setActiveDay(1);
    setShowResetDialog(false);
  };

  if (!hydrated || !cloudReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs text-muted-foreground">Loading your tasks…</p>
        </div>
      </div>
    );
  }

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    "Account";
  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined);

  const syncLabel =
    syncStatus === "saving"
      ? "Saving…"
      : syncStatus === "saved"
        ? "Synced ✓"
        : syncStatus === "offline"
          ? "Offline"
          : syncStatus === "error"
            ? "Sync error"
            : syncStatus === "loading"
              ? "Loading"
              : "Up to date";

  const headerName = mentorMode ? mentorMode.targetName : displayName;
  const headerAvatar = mentorMode ? (mentorMode.targetAvatar ?? undefined) : avatarUrl;

  const personalContent = (
    <>
      {!online && (
        <div className="w-full bg-amber-500 px-4 py-1.5 text-center text-xs font-medium text-white">
          Offline — changes will sync when reconnected
        </div>
      )}
      {mentorMode && (
        <div className="w-full bg-primary/10 px-4 py-1.5 text-center text-xs font-medium text-primary">
          Mentor mode — you are editing {mentorMode.targetName}'s personal tasks
        </div>
      )}
      {state.ui?.isDemo && !state.ui?.demoBannerDismissed && (
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <div className="flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
            <span className="text-lg">👋</span>
            <p className="flex-1">
              Welcome! These are sample tasks to get you started. Add your own tasks or delete these
              anytime.
            </p>
            <button
              onClick={() =>
                setState((s) => ({
                  ...s,
                  ui: { ...(s.ui ?? {}), demoBannerDismissed: true },
                }))
              }
              className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Weekly Task Tracker</h1>
            <p className="text-sm text-muted-foreground">
              Week {state.weekNumber} · {fmtDate(new Date(state.days[0].isoDate))} –{" "}
              {fmtDate(new Date(state.days[6].isoDate))}
            </p>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span
                key={remotePulse}
                className={`inline-block h-2 w-2 rounded-full ${
                  remotePulse > 0 ? "animate-ping-fast bg-green-500" : "bg-muted-foreground/30"
                }`}
                title="Realtime sync"
              />
              <span>{syncLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-2 py-1 shadow-sm">
            {headerAvatar ? (
              <img
                src={headerAvatar}
                alt={headerName}
                className="h-8 w-8 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                {headerName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="max-w-[140px] truncate text-xs font-medium">{headerName}</span>
            {mentorMode ? (
              <button
                onClick={mentorMode.onBack}
                className="rounded-full border border-input bg-background px-3 py-1 text-xs font-medium transition hover:bg-accent"
              >
                ← Back
              </button>
            ) : (
              <button
                onClick={signOut}
                className="rounded-full border border-input bg-background px-3 py-1 text-xs font-medium transition hover:bg-accent"
              >
                Sign out
              </button>
            )}
          </div>
        </header>

        {/* Global stats */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <StatBox
            label="Tasks Complete"
            value={`${globalStats.done} / ${globalStats.total}`}
            pct={globalStats.total ? (globalStats.done / globalStats.total) * 100 : 0}
            barColor="var(--stat-green)"
          />
          <StatBox
            label="Points Earned"
            value={`${globalStats.pts} / ${globalStats.totalPts} pts`}
            pct={globalStats.totalPts ? (globalStats.pts / globalStats.totalPts) * 100 : 0}
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
                  <button
                    onClick={() => setHistoryDetail(h)}
                    className="text-left underline-offset-2 hover:underline"
                  >
                    <span className="font-semibold">Week {h.week}</span> ({h.range}
                    ): {h.taskPct}% tasks · {h.ptsPct}% pts ({h.tasksDone}/{h.tasksTotal})
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Rollover + export/import + edit date */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={rollover}
            className="rounded-md bg-[var(--stat-purple)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
          >
            ⏭ Carry Forward to Next Week (+7 days)
          </button>
          {selectMode && selected.size > 0 && (
            <button
              onClick={() => carryForwardToNextWeek([...selected])}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:opacity-90"
            >
              <Forward className="h-3.5 w-3.5" /> Forward {selected.size} to Next Week
            </button>
          )}
          <button
            onClick={() => openEditDate({ kind: "start" })}
            className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium transition hover:bg-accent"
          >
            <Calendar className="h-3.5 w-3.5" /> Edit Start Date
          </button>
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium transition hover:bg-accent"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium transition hover:bg-accent"
          >
            <Upload className="h-3.5 w-3.5" /> Import CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCSV(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={resetAll}
            className="rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-accent"
          >
            Reset all
          </button>
        </div>
        {csvError && (
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {csvError}
          </div>
        )}

        {/* Day tabs */}
        <div className="mb-4 flex flex-wrap gap-2">
          {state.days.map((d, i) => {
            const st = dayStats(d);
            const pct = st.total ? st.done / st.total : 0;
            const activeCls = activeDay === i + 1 ? "ring-2 ring-ring" : "";
            let bg = "bg-secondary text-secondary-foreground";
            if (pct === 1 && st.total > 0) bg = "bg-[var(--stat-green)] text-white";
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
          dayIndex={activeDay - 1}
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
          onSelectAllInSection={selectAllInSection}
          onSelectAllCarried={selectAllCarried}
          onEditDayDate={(i) => openEditDate({ kind: "day", dayIndex: i })}
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
                  <span className="text-[10px] opacity-90">{Math.round(pct * 100)}%</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );

  if (mentorMode) {
    return <div className="min-h-screen bg-background">{personalContent}</div>;
  }

  return (
    <AppShell
      view={view}
      setView={setView}
      user={user}
      selectedGroupId={selectedGroupId}
      setSelectedGroupId={setSelectedGroupId}
      isAdmin={isAdmin}
    >
      {view === "groups" ? (
        <GroupsView
          user={user}
          selectedGroupId={selectedGroupId}
          setSelectedGroupId={setSelectedGroupId}
        />
      ) : view === "notifications" ? (
        <NotificationsView user={user} />
      ) : view === "mentors" ? (
        <MentorView user={user} signOut={signOut} />
      ) : view === "leaderboard" ? (
        <LeaderboardView user={user} />
      ) : view === "admin" && isAdmin ? (
        <AdminView user={user} />
      ) : (
        personalContent
      )}

      {/* Item 8: destructive reset confirmation dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset entire tracker?</AlertDialogTitle>
            <AlertDialogDescription>
              This will completely erase this data — all tasks, points, and history will be cleared
              and reset to the starter set. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Item 7: history detail dialog */}
      <Dialog open={!!historyDetail} onOpenChange={(o) => !o && setHistoryDetail(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {historyDetail ? `Week ${historyDetail.week} · ${historyDetail.range}` : ""}
            </DialogTitle>
          </DialogHeader>
          {historyDetail?.daysSnapshot ? (
            <HistoryDetail days={historyDetail.daysSnapshot} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No detailed snapshot saved for this week.
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Item 2: edit date dialog */}
      <Dialog
        open={showEditDate}
        onOpenChange={(o) => {
          setShowEditDate(o);
          if (!o) setEditDateTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editDateTarget?.kind === "start" ? "Edit Week Start Date" : "Edit Day Date"}
            </DialogTitle>
          </DialogHeader>
          <input
            type="date"
            value={editDateValue}
            onChange={(e) => setEditDateValue(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowEditDate(false)}
              className="rounded-md border border-border px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={applyEditDate}
              disabled={!editDateValue}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
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
      <div className="mt-1 text-right text-[11px] text-muted-foreground">{Math.round(pct)}%</div>
    </div>
  );
}

/* =========================================================================
   DAY PANEL
   ========================================================================= */

interface DayPanelProps {
  day: DayData;
  dayNumber: number;
  dayIndex: number;
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
  onSelectAllInSection: (sectionId: string) => void;
  onSelectAllCarried: () => void;
  onEditDayDate: (dayIndex: number) => void;
  onAddTask: (opts: {
    title: string;
    points: number;
    sectionId: string;
    sectionLabel?: string;
    sectionColor?: string;
    daily: boolean;
    isStreak?: boolean;
  }) => void;
}

function DayPanel({
  day,
  dayNumber,
  dayIndex,
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
  onSelectAllInSection,
  onSelectAllCarried,
  onEditDayDate,
  onAddTask,
}: DayPanelProps) {
  const doneCount = day.tasks.filter((t) => t.status === "done").length;
  const totalCount = day.tasks.length;
  const pts = day.tasks.reduce((a, t) => a + (t.status === "done" ? t.points : 0), 0);
  const totalPts = day.tasks.reduce((a, t) => a + t.points, 0);

  const carriedTasks = day.tasks.filter((t) => t.carriedFromDay);
  const forwardedTasks = day.tasks.filter((t) => t.carriedForward);

  // Item 1: select-all for carried tasks across the whole week
  const anyCarried = carriedTasks.length > 0;

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
            <button
              onClick={() => onEditDayDate(dayIndex)}
              className="ml-2 inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-0.5 text-[11px] font-medium transition hover:bg-accent"
              title="Edit this day's date"
            >
              <Calendar className="h-3 w-3" /> Edit
            </button>
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
        <div className="flex flex-wrap gap-2">
          {anyCarried && (
            <button
              onClick={onSelectAllCarried}
              className="rounded-md border border-amber-400/60 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-500/20 dark:text-amber-300"
              title="Select all carried-over tasks this week"
            >
              ↻ Select All Carried
            </button>
          )}
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
      </div>

      {/* Progress bars */}
      <div className="mb-4 space-y-2">
        <div>
          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
            <span>Tasks</span>
            <span>{totalCount ? Math.round((doneCount / totalCount) * 100) : 0}%</span>
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

      {/* Item 5: Carried Forward from Last Week landing section (day 1 only) */}
      {dayNumber === 1 && forwardedTasks.length > 0 && (
        <div className="mb-4 rounded-lg border border-blue-400/50 bg-blue-500/10 p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-300">
            <Forward className="mr-1 inline h-3 w-3" /> Carried Forward from Last Week (
            {forwardedTasks.length} {forwardedTasks.length === 1 ? "task" : "tasks"})
          </h3>
          <div className="space-y-1.5">
            {forwardedTasks.map((t) => (
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
              {g.tasks.length > 0 && (
                <button
                  onClick={() => onSelectAllInSection(g.section.id)}
                  className="ml-1 rounded border border-input bg-background px-1.5 py-0.5 text-[10px] font-medium transition hover:bg-accent"
                  title="Select all tasks in this category"
                >
                  Select all
                </button>
              )}
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
        {day.notes.length === 0 && <p className="text-xs text-muted-foreground">No notes yet.</p>}
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
        <input type="checkbox" checked={selected} onChange={onToggleSelect} className="h-4 w-4" />
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
        {task.isStreak && (
          <span className="ml-2 inline-flex items-center gap-0.5 rounded bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-orange-800 dark:text-orange-300">
            <Flame className="h-3 w-3" />
            {task.streakCount && task.streakCount > 0 ? `${task.streakCount} day streak` : "streak"}
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
    isStreak?: boolean;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [points, setPoints] = useState(5);
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? "onetime");
  const [newSectionMode, setNewSectionMode] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [daily, setDaily] = useState(false);
  const [isStreak, setIsStreak] = useState(false);

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
        isStreak,
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
        isStreak,
      });
    }
    setTitle("");
    setPoints(5);
    setNewSectionName("");
    setNewSectionMode(false);
    setDaily(false);
    setIsStreak(false);
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
          <input type="checkbox" checked={daily} onChange={(e) => setDaily(e.target.checked)} />
          <span>Daily (add to all 7 days)</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={isStreak}
            onChange={(e) => setIsStreak(e.target.checked)}
          />
          <span className="inline-flex items-center gap-1">
            <Flame className="h-3 w-3 text-orange-500" /> Streak task
          </span>
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

/* =========================================================================
   HISTORY DETAIL (item 7) — read-only drill-down into a past week
   ========================================================================= */
function HistoryDetail({ days }: { days: DayData[] }) {
  return (
    <div className="space-y-4">
      {days.map((d, i) => {
        const done = d.tasks.filter((t) => t.status === "done").length;
        const total = d.tasks.length;
        const pct = total ? Math.round((done / total) * 100) : 0;
        const grouped = d.sections
          .map((sec) => ({
            section: sec,
            tasks: d.tasks.filter((t) => t.sectionId === sec.id),
          }))
          .filter((g) => g.tasks.length > 0);
        return (
          <div key={i} className="rounded-lg border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold">
                Day {i + 1} · {d.date}
              </h4>
              <span className="text-xs text-muted-foreground">
                {done}/{total} tasks · {pct}%
              </span>
            </div>
            {total === 0 ? (
              <p className="text-xs text-muted-foreground">No tasks.</p>
            ) : (
              <div className="space-y-2">
                {grouped.map((g) => (
                  <div key={g.section.id}>
                    <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: g.section.color }}
                      />
                      {g.section.label}
                    </div>
                    <ul className="space-y-1">
                      {g.tasks.map((t) => (
                        <li key={t.id} className="flex items-center justify-between text-xs">
                          <span className={t.status === "done" ? "" : "text-muted-foreground"}>
                            {t.status === "done" ? "✓" : t.status === "carry" ? "↻" : "○"} {t.title}
                          </span>
                          <span className="text-muted-foreground">
                            {t.status === "done" ? `${t.points}pts` : t.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
