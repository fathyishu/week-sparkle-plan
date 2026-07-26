import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap, Plus, ShieldOff } from "lucide-react";
import { TrackerApp } from "@/routes/index";

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

export function MentorView({
  user,
  signOut,
}: {
  user: User;
  signOut: () => Promise<void>;
}) {
  const [asMentor, setAsMentor] = useState<Mentorship[]>([]);
  const [asMentee, setAsMentee] = useState<Mentorship[]>([]);
  const [selected, setSelected] = useState<Mentorship | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("mentorships").select("*");
    const list = (data ?? []) as Mentorship[];
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
        : `Revoke ${m.mentor_name ?? "this mentor"}'s access? They will immediately lose access to your tasks.`;
    if (!confirm(label)) return;
    await supabase.from("mentorships").update({ status: "revoked" }).eq("id", m.id);
    if (selected?.id === m.id) setSelected(null);
    setToast("Access revoked");
    setTimeout(() => setToast(null), 2000);
  };

  if (selected && selected.mentee_id) {
    return (
      <TrackerApp
        user={user}
        signOut={signOut}
        mentorMode={{
          targetUserId: selected.mentee_id,
          targetName: selected.mentee_name ?? selected.mentee_email,
          targetAvatar: selected.mentee_avatar,
          onBack: () => setSelected(null),
        }}
      />
    );
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
              Mentors get full access to view, add, edit, and delete your personal
              tasks. Group tasks are never shared.
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
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left shadow-sm hover:border-primary/50"
              >
                <button
                  onClick={() => setSelected(m)}
                  className="flex flex-1 items-center gap-3 text-left"
                  disabled={!m.mentee_id}
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
                    <div className="text-xs text-muted-foreground">
                      {m.mentee_email}
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => revoke(m, "mentor")}
                  className="rounded p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                  title="Stop mentoring"
                >
                  <ShieldOff className="h-4 w-4" />
                </button>
              </div>
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
                    Full access to your personal tasks
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
          Enter your mentee's email. They'll receive a notification. Once they
          accept, you'll have full access to view, add, edit, and delete their
          personal tasks.
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
