import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import type { ApiError, Session } from "../../shared/types";
let csrfToken = "";
export class RequestError extends Error {
  constructor(
    public status: number,
    public detail: ApiError,
  ) {
    super(detail.error?.message || "The request could not be completed.");
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  // The synchronizer token is never persisted in browser storage.
  if (
    options.method &&
    !["GET", "HEAD"].includes(options.method) &&
    !csrfToken
  ) {
    await api<Session>("/api/session");
  }
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (options.method && !["GET", "HEAD"].includes(options.method))
    headers.set("X-CSRF-Token", csrfToken);
  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  const body = await response.json().catch(() => ({
    error: {
      code: "invalid_response",
      message: "Unable to load this page. Please try again.",
    },
  }));
  if (!response.ok) throw new RequestError(response.status, body);
  if (body.csrfToken) csrfToken = body.csrfToken;
  return body as T;
}
export const post = <T,>(path: string, body: unknown = {}) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState<Error | null>(null),
    [loading, setLoading] = useState(Boolean(path)),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!path) {
      setLoading(false);
      setData(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);
    api<T>(path, { signal: controller.signal })
      .then(setData)
      .catch((error) => {
        if (error.name !== "AbortError") setError(error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, revision]);
  return {
    data,
    error,
    loading,
    reload: useCallback(() => setRevision((v) => v + 1), []),
  };
}
interface FlashNotice {
  id: number;
  text: string;
  error: boolean;
  routeKey: string;
  destination?: string;
}
interface NoticeOptions {
  error?: boolean;
  /** Keep the confirmation through this action's redirect, then scope it to that page. */
  destination?: string;
}
interface AppContextValue {
  session: Session | null;
  sessionError: Error | null;
  loading: boolean;
  reloadSession: () => Promise<void>;
  setSession: (s: Session) => void;
  flash: FlashNotice | null;
  notify: (text: string, options?: NoticeOptions) => void;
  dismissFlash: () => void;
  favorite: (slug: string, id: number) => Promise<boolean>;
}
const AppContext = createContext<AppContextValue | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const location = useLocation(),
    noticeId = useRef(0);
  const [session, setSessionState] = useState<Session | null>(null),
    [sessionError, setSessionError] = useState<Error | null>(null),
    [loading, setLoading] = useState(true),
    [flash, setFlash] = useState<FlashNotice | null>(null);
  const setSession = useCallback((s: Session) => {
    csrfToken = s.csrfToken;
    setSessionState(s);
    setSessionError(null);
  }, []);
  const reloadSession = useCallback(async () => {
    setLoading(true);
    try {
      setSession(await api<Session>("/api/session"));
    } catch (error) {
      setSessionError(error as Error);
    } finally {
      setLoading(false);
    }
  }, [setSession]);
  useEffect(() => {
    void reloadSession();
  }, [reloadSession]);
  const notify = useCallback(
    (text: string, { error = false, destination }: NoticeOptions = {}) =>
      setFlash({
        id: ++noticeId.current,
        text,
        error,
        routeKey: location.key,
        destination,
      }),
    [location.key],
  );
  const dismissFlash = useCallback(() => setFlash(null), []);
  useEffect(() => {
    const path = location.pathname + location.search + location.hash;
    setFlash((current) => {
      if (!current) return null;
      if (current.destination === path)
        return { ...current, destination: undefined, routeKey: location.key };
      return current.routeKey === location.key ? current : null;
    });
  }, [location, flash?.id]);
  useEffect(() => {
    // Errors require an explicit dismissal or navigation; success notices are transient.
    if (!flash || flash.error || flash.destination) return;
    const timer = window.setTimeout(() => {
      setFlash((current) => (current?.id === flash.id ? null : current));
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [flash]);
  const favorite = useCallback(
    async (slug: string, id: number) => {
      const r = await post<{ favorite: boolean }>(
        `/api/businesses/${encodeURIComponent(slug)}/favorite`,
      );
      setSessionState((s) =>
        s
          ? {
              ...s,
              favorites: r.favorite
                ? [...s.favorites.filter((n) => n !== id), id]
                : s.favorites.filter((n) => n !== id),
            }
          : s,
      );
      notify(r.favorite ? "Saved to My Faves" : "Removed from My Faves");
      return r.favorite;
    },
    [notify],
  );
  return (
    <AppContext.Provider
      value={{
        session,
        sessionError,
        loading,
        reloadSession,
        setSession,
        flash,
        notify,
        dismissFlash,
        favorite,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("AppProvider required");
  return context;
}
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
