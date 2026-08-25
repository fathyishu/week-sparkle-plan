import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type SyncStatus = "idle" | "loading" | "saving" | "saved" | "offline" | "error";

interface UseCloudSyncArgs<T> {
  userId: string;
  state: T;
  setState: (t: T) => void;
  hydrated: boolean;
  ready: boolean; // set true after cloud hydration completes
  onReady: () => void;
  buildFirstTime?: () => T;
}

export function useCloudSync<T>({
  userId,
  state,
  setState,
  hydrated,
  ready,
  onReady,
  buildFirstTime,
}: UseCloudSyncArgs<T>) {
  const [status, setStatus] = useState<SyncStatus>("loading");
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [remotePulse, setRemotePulse] = useState(0);
  const lastRemoteHash = useRef<string>("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<T | null>(null);

  // online/offline listeners
  useEffect(() => {
    const onOn = () => setOnline(true);
    const onOff = () => setOnline(false);
    window.addEventListener("online", onOn);
    window.addEventListener("offline", onOff);
    return () => {
      window.removeEventListener("online", onOn);
      window.removeEventListener("offline", onOff);
    };
  }, []);

  // Initial hydrate from cloud
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    (async () => {
      setStatus("loading");
      const { data, error } = await supabase
        .from("user_app_state")
        .select("data")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("[cloud-sync] load error", error);
        setStatus("error");
        onReady();
        return;
      }
      if (data?.data) {
        try {
          const remote = data.data as T;
          lastRemoteHash.current = JSON.stringify(remote);
          setState(remote);
        } catch (e) {
          console.error("[cloud-sync] parse error", e);
        }
      } else if (buildFirstTime) {
        // Brand-new user — seed with starter (demo) data and persist it
        try {
          const seed = buildFirstTime();
          setState(seed);
          const seedJson = JSON.stringify(seed);
          const { error: seedErr } = await supabase
            .from("user_app_state")
            .upsert({ user_id: userId, data: seed as never });
          if (!seedErr) lastRemoteHash.current = seedJson;
        } catch (e) {
          console.error("[cloud-sync] seed error", e);
        }
      }
      setStatus("idle");
      onReady();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, hydrated]);

  // Realtime subscription
  useEffect(() => {
    if (!ready) return;
    const channel = supabase
      .channel(`user_app_state:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_app_state",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = (payload.new as { data?: T } | null) ?? null;
          if (!row?.data) return;
          const incoming = JSON.stringify(row.data);
          if (incoming === lastRemoteHash.current) return; // our own echo
          lastRemoteHash.current = incoming;
          setState(row.data);
          setRemotePulse((n) => n + 1);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, ready]);

  // Debounced save on state change
  useEffect(() => {
    if (!ready) return;
    const serialized = JSON.stringify(state);
    if (serialized === lastRemoteHash.current) return;
    pendingRef.current = state;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!online) {
        setStatus("offline");
        try {
          localStorage.setItem(`cloud-queue:${userId}`, serialized);
        } catch {
          /* ignore */
        }
        return;
      }
      setStatus("saving");
      // UPDATE (not upsert): upsert is checked against the INSERT policy, which a
      // mentor editing a mentee's row can never satisfy.
      const { error } = await supabase
        .from("user_app_state")
        .update({ data: pendingRef.current as never })
        .eq("user_id", userId);
      if (error) {
        console.error("[cloud-sync] save error", error);
        setStatus("error");
        try {
          localStorage.setItem(`cloud-queue:${userId}`, serialized);
        } catch {
          /* ignore */
        }
      } else {
        lastRemoteHash.current = serialized;
        try {
          localStorage.removeItem(`cloud-queue:${userId}`);
        } catch {
          /* ignore */
        }
        setStatus("saved");
        setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1200);
      }
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, ready, online, userId]);

  // Flush offline queue when reconnected
  useEffect(() => {
    if (!ready || !online) return;
    const queued = (() => {
      try {
        return localStorage.getItem(`cloud-queue:${userId}`);
      } catch {
        return null;
      }
    })();
    if (!queued) return;
    (async () => {
      setStatus("saving");
      try {
        const parsed = JSON.parse(queued) as T;
        const { error } = await supabase
          .from("user_app_state")
          .upsert({ user_id: userId, data: parsed as never });
        if (!error) {
          lastRemoteHash.current = queued;
          localStorage.removeItem(`cloud-queue:${userId}`);
          setStatus("saved");
          setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1200);
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, ready]);

  return { status, online, remotePulse };
}
