"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { CurrentUser } from "@/types/account";

type CurrentUserContextValue = {
  hasError: boolean;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
  setUser: (user: CurrentUser | null) => void;
  user: CurrentUser | null;
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export function CurrentUserProvider({
  children,
  initialResolved = false,
  initialUser = null
}: {
  children: React.ReactNode;
  initialResolved?: boolean;
  initialUser?: CurrentUser | null;
}) {
  const [user, setUser] = useState<CurrentUser | null>(initialUser);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialResolved);
  const requestId = useRef(0);
  const lastRefreshAt = useRef(0);

  const refreshUser = useCallback(async () => {
    const currentRequest = ++requestId.current;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch("/api/users/me", {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal
      });
      if (currentRequest !== requestId.current) return;
      if (response.status === 401) {
        setUser(null);
        setHasError(false);
        return;
      }
      if (!response.ok) {
        throw new Error(`Current user request failed: ${response.status}`);
      }
      const payload = (await response.json()) as { user: CurrentUser };
      setUser(payload.user);
      setHasError(false);
    } catch (error: unknown) {
      if (currentRequest !== requestId.current) return;
      if (error instanceof DOMException && error.name === "AbortError") {
        console.warn("Загрузка аккаунта превысила 10 секунд");
      } else {
        console.error("Не удалось обновить данные аккаунта", error);
      }
      setHasError(true);
    } finally {
      window.clearTimeout(timeout);
      if (currentRequest === requestId.current) {
        lastRefreshAt.current = Date.now();
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (initialResolved) lastRefreshAt.current = Date.now();
    const initialLoad = initialResolved
      ? undefined
      : window.setTimeout(() => void refreshUser(), 0);
    const handleUserUpdated = () => void refreshUser();
    const refreshAfterLongPause = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastRefreshAt.current > 2 * 60_000
      ) {
        void refreshUser();
      }
    };
    window.addEventListener("mathforces:user-updated", handleUserUpdated);
    document.addEventListener("visibilitychange", refreshAfterLongPause);
    return () => {
      if (initialLoad) window.clearTimeout(initialLoad);
      requestId.current += 1;
      window.removeEventListener("mathforces:user-updated", handleUserUpdated);
      document.removeEventListener("visibilitychange", refreshAfterLongPause);
    };
  }, [initialResolved, refreshUser]);

  const value = useMemo<CurrentUserContextValue>(
    () => ({ hasError, isLoading, refreshUser, setUser, user }),
    [hasError, isLoading, refreshUser, user]
  );

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
  const context = useContext(CurrentUserContext);
  if (!context) {
    throw new Error("useCurrentUser must be used inside CurrentUserProvider");
  }
  return context;
}
