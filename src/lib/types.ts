export type TaskStatus = "pending" | "done" | "carry";
export type BadgeType = "OVERDUE" | "URGENT" | "MEETING" | "ONE-TIME";

/** A permanent task definition. Belongs to a weekday, not a specific date. */
export interface TaskDef {
  id: string;
  title: string;
  points: number;
  sectionId: string;
  weekday: number; // 0=Sun..6=Sat
  isStreak?: boolean;
  badges?: BadgeType[];
}

export interface Task {
  id: string;
  title: string;
  points: number;
  status: TaskStatus;
  sectionId: string;
  badges?: BadgeType[];
  carriedFromDay?: number; // 1-indexed
  custom?: boolean;
  /** Links this instance back to its permanent TaskDef */
  defId?: string;
  isStreak?: boolean;
}

export interface Section {
  id: string;
  label: string;
  color: string; // hex
}

export interface Note {
  id: string;
  text: string;
  status: TaskStatus;
  carriedFromDay?: number;
}

export interface DayData {
  date: string; // dd/M
  isoDate: string;
  sections: Section[]; // ordered
  tasks: Task[];
  notes: Note[];
}

export interface HistoryDayTask {
  title: string;
  points: number;
  status: TaskStatus;
  sectionLabel: string;
}

export interface HistoryDay {
  date: string;
  tasks: HistoryDayTask[];
}

export interface WeekHistory {
  week: number;
  range: string;
  taskPct: number;
  ptsPct: number;
  tasksDone: number;
  tasksTotal: number;
  days?: HistoryDay[];
}

export interface StreakInfo {
  count: number;
  lastDoneDate?: string; // yyyy-mm-dd
}

export interface TrackerState {
  weekStartISO: string;
  weekNumber: number;
  days: DayData[];
  history: WeekHistory[];
  /** Permanent task definitions — the source of truth for what exists each week */
  taskDefs: TaskDef[];
  streaks?: Record<string, StreakInfo>;
  ui?: {
    isDemo?: boolean;
    demoBannerDismissed?: boolean;
  };
}

export type AppState = TrackerState;
