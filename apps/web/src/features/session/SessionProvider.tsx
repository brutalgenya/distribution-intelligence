import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

export interface SessionHeaders {
  userId: string;
  organizationId: string;
}

interface SessionContextValue extends SessionHeaders {
  isConfigured: boolean;
  setSession: (next: Partial<SessionHeaders>) => void;
  resetSession: () => void;
}

const STORAGE_KEY = "inventory-intelligence-demo-session";

const DEFAULT_SESSION: SessionHeaders = {
  userId: import.meta.env.VITE_DEMO_USER_ID ?? "",
  organizationId: import.meta.env.VITE_DEMO_ORGANIZATION_ID ?? "",
};

const SessionContext = createContext<SessionContextValue | null>(null);

const readStoredSession = (): SessionHeaders => {
  if (typeof window === "undefined") {
    return DEFAULT_SESSION;
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return DEFAULT_SESSION;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<SessionHeaders>;
    return {
      userId: parsed.userId ?? DEFAULT_SESSION.userId,
      organizationId: parsed.organizationId ?? DEFAULT_SESSION.organizationId,
    };
  } catch {
    return DEFAULT_SESSION;
  }
};

export const SessionProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const [session, setSessionState] = useState<SessionHeaders>(readStoredSession);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  const value = useMemo<SessionContextValue>(
    () => ({
      ...session,
      isConfigured: Boolean(session.userId && session.organizationId),
      setSession: (next) =>
        setSessionState((current) => ({
          userId: next.userId ?? current.userId,
          organizationId: next.organizationId ?? current.organizationId,
        })),
      resetSession: () => setSessionState(DEFAULT_SESSION),
    }),
    [session],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = (): SessionContextValue => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider.");
  }

  return context;
};
