import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ALLOWED_EMAIL_DOMAIN,
  isAllowedEmail,
  isAdminEmail,
  canView as canViewFeature,
  canEdit as canEditFeature,
  type FeatureKey,
  type Permissions,
} from "./tenant";

export type SessionInfo = {
  company: string | null;
  tenantCode: string | null;
  email: string | null;
  name: string | null;
};

type Ctx = {
  status: "loading" | "authenticated" | "unauthenticated" | "forbidden";
  session: SessionInfo;
  isAdmin: boolean;
  permissions: Permissions;
  canView: (feature: FeatureKey) => boolean;
  canEdit: (feature: FeatureKey) => boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

// Keep a single context instance across hot-module reloads so that a stale
// module copy never renders with a different context object (which would make
// consumers see "no provider").
const globalScope = globalThis as unknown as { __sessionCtx?: React.Context<Ctx | null> };
const SessionCtx: React.Context<Ctx | null> =
  globalScope.__sessionCtx ?? (globalScope.__sessionCtx = createContext<Ctx | null>(null));

export function useSession() {
  const c = useContext(SessionCtx);
  if (!c) throw new Error("useSession must be used inside <SessionProvider>");
  return c;
}

const empty: SessionInfo = { company: null, tenantCode: null, email: null, name: null };

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Ctx["status"]>("loading");
  const [session, setSession] = useState<SessionInfo>(empty);
  const [permissions, setPermissions] = useState<Permissions>({});

  const apply = useCallback(async () => {
    let data;
    try {
      ({ data } = await supabase.auth.getSession());
    } catch {
      // Transient network/refresh failure — keep the existing session state
      // instead of forcing the user back to the sign-in screen.
      return;
    }
    const user = data.session?.user;
    if (!user) {
      setSession(empty);
      setStatus("unauthenticated");
      return;
    }
    const email = (user.email || "").toLowerCase();
    if (!isAllowedEmail(email)) {
      setSession({ ...empty, email });
      setStatus("forbidden");
      return;
    }
    // Server-side access list: an email that has been revoked (mailbox no
    // longer in use) loses access on every device, even with a live session.
    try {
      const res = await fetch("/api/data/app-access?self=1", {
        headers: { Authorization: `Bearer ${data.session!.access_token}` },
      });
      if (res.ok) {
        const body = (await res.json()) as { active?: boolean; permissions?: Permissions };
        setPermissions(body.permissions ?? {});
        if (body.active === false) {
          setSession({ ...empty, email });
          setStatus("forbidden");
          return;
        }
      } else if (res.status === 403) {
        setSession({ ...empty, email });
        setStatus("forbidden");
        return;
      }
    } catch {
      // Network hiccup — don't lock the user out of an offline tab.
    }

    setSession({
      company: ALLOWED_EMAIL_DOMAIN,
      tenantCode: null,
      email,
      name: (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || email,
    });
    setStatus("authenticated");
  }, []);


  useEffect(() => {
    apply();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "USER_UPDATED" ||
        event === "TOKEN_REFRESHED" ||
        event === "INITIAL_SESSION"
      ) {
        apply();
      }
    });

    // Keep long-lived device sessions alive: whenever the tab comes back to the
    // foreground or the network returns, refresh the token instead of expiring.
    const revive = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void supabase.auth.refreshSession().catch(() => {}).finally(() => void apply());
    };
    window.addEventListener("focus", revive);
    window.addEventListener("online", revive);
    document.addEventListener("visibilitychange", revive);

    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("focus", revive);
      window.removeEventListener("online", revive);
      document.removeEventListener("visibilitychange", revive);
    };
  }, [apply]);


  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: { hd: ALLOWED_EMAIL_DOMAIN, prompt: "select_account" },
      },
    });
    if (error) throw error;
    // signInWithOAuth navigates the browser away to Google; apply() runs on
    // return via the INITIAL_SESSION/SIGNED_IN listener in the effect above.
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(empty);
    setStatus("unauthenticated");
  }, []);

  const isAdmin = isAdminEmail(session.email);

  return (
    <SessionCtx.Provider
      value={{
        status,
        session,
        isAdmin,
        permissions,
        canView: (feature) => canViewFeature(permissions, feature, isAdmin),
        canEdit: (feature) => canEditFeature(permissions, feature, isAdmin),
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </SessionCtx.Provider>
  );
}
