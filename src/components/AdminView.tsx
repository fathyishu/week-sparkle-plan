import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Search, ArrowLeft, Mail } from "lucide-react";

// NOTE: The admin PIN is verified via a Supabase edge function
// (supabase/functions/admin-auth), NOT hardcoded in this client code.
// A 4-digit PIN is weak — strengthen before real production use.

type UserInfo = {
  user_id: string;
  email: string;
  display_name: string | null;
};

export function AdminView({ user }: { user: User }) {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  // --- admin dashboard state ---
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
  const [userState, setUserState] = useState<unknown>(null);
  const [userCount, setUserCount] = useState(0);

  const verifyPin = async () => {
    setBusy(true);
    setError(null);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-auth`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ""}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ action: "verify", pin }),
      });
      if (!res.ok) {
        setError("Verification failed.");
        setBusy(false);
        return;
      }
      const data = (await res.json()) as { ok?: boolean };
      if (data.ok) {
        setAuthed(true);
      } else {
        setError("Incorrect PIN.");
      }
    } catch {
      setError("Network error.");
    }
    setBusy(false);
  };

  const sendForgotCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-auth`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ""}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ action: "forgot" }),
      });
      if (res.ok) setForgotSent(true);
      else setError("Could not send reset code.");
    } catch {
      setError("Network error.");
    }
    setBusy(false);
  };

  const loadUsers = async () => {
    const { data } = await supabase
      .from("group_members")
      .select("user_id, email, display_name")
      .order("email", { ascending: true });
    const all = (data ?? []) as UserInfo[];
    const unique = new Map<string, UserInfo>();
    for (const u of all) {
      if (!unique.has(u.user_id)) unique.set(u.user_id, u);
    }
    setUsers([...unique.values()]);
    setUserCount(unique.size);
  };

  useEffect(() => {
    if (authed) loadUsers();
  }, [authed]);

  const viewUser = async (u: UserInfo) => {
    setSelectedUser(u);
    const { data, error } = await supabase.rpc("admin_read_user_state", {
      _target: u.user_id,
    });
    if (error) {
      setUserState({ error: error.message });
    } else {
      setUserState(data);
    }
  };

  // --- password gate ---
  if (!authed) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col items-center justify-center px-4">
        <Shield className="mb-4 h-10 w-10 text-primary" />
        <h1 className="text-xl font-bold">Admin Login</h1>
        <p className="mb-4 text-xs text-muted-foreground">
          Separate login for the admin dashboard.
        </p>
        {!forgotMode ? (
          <>
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && verifyPin()}
              placeholder="PIN"
              className="mb-3 w-full rounded-md border border-input bg-background px-3 py-2 text-center text-lg tracking-widest"
            />
            {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
            <button
              onClick={verifyPin}
              disabled={busy || pin.length < 4}
              className="mb-2 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Verifying..." : "Enter"}
            </button>
            <button
              onClick={() => {
                setForgotMode(true);
                setError(null);
              }}
              className="text-xs text-muted-foreground underline"
            >
              Forgot PIN?
            </button>
          </>
        ) : (
          <>
            {forgotSent ? (
              <p className="text-center text-sm text-muted-foreground">
                A reset code has been emailed to the admin address.
              </p>
            ) : (
              <>
                <p className="mb-3 text-center text-xs text-muted-foreground">
                  A reset code will be emailed to the admin address (farhanzuhair123@gmail.com).
                </p>
                {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
                <button
                  onClick={sendForgotCode}
                  disabled={busy}
                  className="mb-2 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {busy ? "Sending..." : "Send Reset Code"}
                </button>
              </>
            )}
            <button
              onClick={() => {
                setForgotMode(false);
                setForgotSent(false);
              }}
              className="text-xs text-muted-foreground underline"
            >
              Back to PIN
            </button>
          </>
        )}
      </div>
    );
  }

  // --- user detail view ---
  if (selectedUser) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
        <button
          onClick={() => setSelectedUser(null)}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to user list
        </button>
        <h1 className="mb-1 text-2xl font-bold">{selectedUser.display_name ?? "User"}</h1>
        <p className="mb-4 text-sm text-muted-foreground">{selectedUser.email}</p>
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">Tracker State</h2>
          <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(userState, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  // --- admin dashboard ---
  const filtered = users.filter((u) => u.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
      <header className="mb-6 flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {userCount} {userCount === 1 ? "user" : "users"} registered
          </p>
        </div>
      </header>

      <section className="mb-6">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email..."
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No users found.</div>
          ) : (
            filtered.map((u, i) => (
              <button
                key={u.user_id}
                onClick={() => viewUser(u)}
                className={`flex w-full items-center gap-3 border-b border-border p-3 text-left text-sm last:border-b-0 hover:bg-muted ${i % 2 ? "bg-muted/30" : ""}`}
              >
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-medium">{u.display_name ?? "Unknown"}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
