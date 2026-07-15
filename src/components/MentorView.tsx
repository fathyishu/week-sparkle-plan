import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, GraduationCap, Plus, ShieldOff } from "lucide-react";

type Mentorship = {
  id: string;
  mentor_id: string;
  mentee_id: string | null;
  mentee_email: string;
  status: string;
  mentor_name: string | null;
  mentor_avatar: string | null;
  mentee_name: string | null;
  mentee_avatar: string | null;
};

type MenteeState = {
  days?: Array<{
    date: string;
    isoDate: string;
    tasks: Array<{
      id: string;
      title: string;
      status: string;
      points: number;
      sectionId: string;
    }>;
    sections: Array<{ id: string; label: string; color: string }>;
  }>;
};

export function MentorView({ user }: { user: User }) {
  const [asMentor, setAsMentor] = useState<Mentorship[]>([]);
  const [asMentee, setAsMentee] = useState<Mentorship[]>([]);
  const [selected, setSelected] = useState<Mentorship | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("mentorships").select("*");
    const list = ((data ?? []) as Mentorship[]) ?? [];
    setAsMentor(list.filter((m) => m.mentor_id === user.id));
    setAsMentee(list.filter((m) => m.mentee_id === user.id));
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`mentors:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mentorships" },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const revoke = async (m: Mentorship, asWhom: "mentor" | "mentee") => {
    const label =
      asWhom === "mentor"
        ? `Stop mentoring ${m.mentee_name ?? m.mentee_email}?`
        : `Revoke ${m.mentor_name ?? "this mentor"}'s access?`;
    if (!confirm(label)) return;
    await supabase.from("mentorships").update({ status: "revoked" }).eq("id", m.id);
    if (selected?.id === m.id) setSelected(null);
    setToast("Access revoked");
    setTimeout(() => setToast(null), 2000);
  };

  if (selected) {
    return <MenteeDashboard mentorship={selected} onBack={() => setSelected(null)} />;
  }

  const acceptedMentees = asMentor.filter((m) => m.status === "accepted");
  const pendingSent = asMentor.filter((m) => m.status === "pending");
  const acceptedMentors = asMentee.filter((m) => m.status === "accepted");

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-xs font-medium text-background shadow-lg">
          {toast}
        </div>
      )}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mentorship</h1>
            <p className="text-sm text-muted-foreground">
              Give a mentor read-only visibility into your personal tasks — or track
              your own mentees.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add Mentee
        </button>
      </header>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          My Mentees
        </h2>
        {acceptedMentees.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            You aren't mentoring anyone yet.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {acceptedMentees.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelected(m)}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left shadow-sm hover:border-primary/50"
              >
                {m.mentee_avatar ? (
                  <img
                    src={m.mentee_avatar}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                    {(m.mentee_name ?? m.mentee_email ?? "?")[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {m.mentee_name ?? m.mentee_email}
                  </div>
                  <div className="text-xs text-muted-foreground">{m.mentee_email}</div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    revoke(m, "mentor");
                  }}
                  className="rounded p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                  title="Stop mentoring"
                >
                  <ShieldOff className="h-4 w-4" />
                </button>
              </button>
            ))}
          </div>
        )}
      </section>

      {pendingSent.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Pending Invitations
          </h2>
          <div className="rounded-lg border border-border bg-card">
            {pendingSent.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between border-b border-border p-3 text-sm last:border-b-0"
              >
                <div>
                  <div className="font-medium">{m.mentee_email}</div>
                  <div className="text-xs text-muted-foreground">
                    Awaiting acceptance
                  </div>
                </div>
                <button
                  onClick={() => revoke(m, "mentor")}
                  className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {acceptedMentors.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            My Mentors
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {acceptedMentors.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm"
              >
                {m.mentor_avatar ? (
                  <img
                    src={m.mentor_avatar}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                    {(m.mentor_name ?? "?")[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {m.mentor_name ?? "Mentor"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Can view your personal tasks
                  </div>
                </div>
                <button
                  onClick={() => revoke(m, "mentee")}
                  className="rounded p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                  title="Revoke access"
                >
                  <ShieldOff className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {showAdd && (
        <AddMenteeModal user={user} onClose={() => setShowAdd(false)} onDone={load} />
      )}
    </div>
  );
}

function AddMenteeModal({
  user,
  onClose,
  onDone,
}: {
  user: User;
  onClose: () => void;
  onDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from("mentorships").insert({
      mentor_id: user.id,
      mentee_email: email.trim().toLowerCase(),
      mentor_name:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        user.email ??
        null,
      mentor_avatar:
        (user.user_metadata?.avatar_url as string | undefined) ??
        (user.user_metadata?.picture as string | undefined) ??
        null,
      status: "pending",
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onDone();
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
        <h2 className="mb-3 text-lg font-semibold">Add Mentee</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Enter your mentee's email. They'll receive a notification and you'll see
          their personal task progress once they accept.
        </p>
        <input
          autoFocus
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="mentee@example.com"
          className="mb-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        {err && <p className="mb-2 text-xs text-red-500">{err}</p>}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !email.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Send Request
          </button>
        </div>
      </div>
    </div>
  );
}

function MenteeDashboard({
  mentorship,
  onBack,
}: {
  mentorship: Mentorship;
  onBack: () => void;
}) {
  const [state, setState] = useState<MenteeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!mentorship.mentee_id) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("user_app_state")
        .select("data")
        .eq("user_id", mentorship.mentee_id)
        .maybeSingle();
      if (cancel) return;
      if (error) setErr(error.message);
      setState((data?.data as MenteeState) ?? null);
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [mentorship.mentee_id]);

  const stats = useMemo(() => {
    if (!state?.days) return null;
    const days = state.days.slice(-7);
    let done = 0;
    let carry = 0;
    let pending = 0;
    let points = 0;
    let total = 0;
    for (const d of days) {
      for (const t of d.tasks ?? []) {
        total++;
        if (t.status === "done") {
          done++;
          points += t.points ?? 0;
        } else if (t.status === "carry") carry++;
        else pending++;
      }
    }
    return {
      done,
      carry,
      pending,
      total,
      points,
      rate: total ? Math.round((done / total) * 100) : 0,
    };
  }, [state]);

  const today = state?.days?.[state.days.length - 1];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <div className="flex items-center gap-3">
          {mentorship.mentee_avatar ? (
            <img
              src={mentorship.mentee_avatar}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
              {(mentorship.mentee_name ?? mentorship.mentee_email)[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">
              {mentorship.mentee_name ?? mentorship.mentee_email}
            </h1>
            <p className="text-xs text-muted-foreground">
              Read-only view · personal tasks only
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : err ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-500">
          {err}
        </div>
      ) : !state ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No task data yet.
        </div>
      ) : (
        <>
          {stats && (
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Completion" value={`${stats.rate}%`} />
              <StatCard label="Done (7d)" value={stats.done} />
              <StatCard label="Carried" value={stats.carry} />
              <StatCard label="Points (7d)" value={stats.points} />
            </div>
          )}

          {today && (
            <section className="mb-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Today ({today.date})
              </h2>
              <TaskList day={today} />
            </section>
          )}

          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Last 7 days activity
            </h2>
            <div className="rounded-lg border border-border bg-card">
              {(state.days ?? []).slice(-7).map((d) => {
                const total = d.tasks?.length ?? 0;
                const done = d.tasks?.filter((t) => t.status === "done").length ?? 0;
                const pct = total ? Math.round((done / total) * 100) : 0;
                return (
                  <div
                    key={d.date}
                    className="flex items-center gap-3 border-b border-border p-3 text-sm last:border-b-0"
                  >
                    <div className="w-16 font-medium">{d.date}</div>
                    <div className="flex-1">
                      <div className="h-2 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-24 text-right text-xs text-muted-foreground">
                      {done}/{total} ({pct}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}

function TaskList({
  day,
}: {
  day: NonNullable<MenteeState["days"]>[number];
}) {
  const secMap = new Map(day.sections?.map((s) => [s.id, s]) ?? []);
  const bySec = new Map<string, typeof day.tasks>();
  for (const t of day.tasks ?? []) {
    const arr = bySec.get(t.sectionId) ?? [];
    arr.push(t);
    bySec.set(t.sectionId, arr);
  }
  return (
    <div className="space-y-3">
      {[...bySec.entries()].map(([sid, tasks]) => {
        const sec = secMap.get(sid);
        return (
          <div key={sid} className="rounded-lg border border-border bg-card p-3">
            <div className="mb-2 flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: sec?.color ?? "#888" }}
              />
              <h3 className="text-sm font-semibold">{sec?.label ?? "Section"}</h3>
            </div>
            <ul className="space-y-1">
              {tasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span
                    className={
                      t.status === "done"
                        ? "text-muted-foreground line-through"
                        : ""
                    }
                  >
                    {t.title}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      t.status === "done"
                        ? "bg-green-500/15 text-green-700 dark:text-green-400"
                        : t.status === "carry"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                          : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {t.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
