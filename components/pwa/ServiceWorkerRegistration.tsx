"use client";

import { Download, RefreshCw, WifiOff, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

const INSTALL_DISMISSED_AT = "mathforces:pwa-install-dismissed-at";
const INSTALL_REMINDER_DELAY = 7 * 24 * 60 * 60 * 1000;

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as NavigatorWithStandalone).standalone)
  );
}

function wasInstallRecentlyDismissed() {
  const dismissedAt = Number(window.localStorage.getItem(INSTALL_DISMISSED_AT));
  return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < INSTALL_REMINDER_DELAY;
}

function subscribeToNetworkStatus(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function ServiceWorkerRegistration() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isIosInstallAvailable, setIsIosInstallAvailable] = useState(false);
  const [updateWorker, setUpdateWorker] = useState<ServiceWorker | null>(null);
  const isOnline = useSyncExternalStore(
    subscribeToNetworkStatus,
    () => navigator.onLine,
    () => true
  );
  const reloadForUpdate = useRef(false);

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (!isStandalone() && !wasInstallRecentlyDismissed()) {
        setInstallPrompt(event as InstallPromptEvent);
      }
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsIosInstallAvailable(false);
      window.localStorage.removeItem(INSTALL_DISMISSED_AT);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const iosEligibilityTimer = window.setTimeout(() => {
      setIsIosInstallAvailable(isIos && !isStandalone() && !wasInstallRecentlyDismissed());
    }, 0);

    if (!("serviceWorker" in navigator)) {
      return () => {
        window.clearTimeout(iosEligibilityTimer);
        window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
        window.removeEventListener("appinstalled", handleInstalled);
      };
    }

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister()))
        )
        .catch((error: unknown) => {
          console.error("Не удалось очистить service worker разработки", error);
        });

      if ("caches" in window) {
        void caches
          .keys()
          .then((keys) =>
            Promise.all(
              keys.filter((key) => key.startsWith("mathforces-")).map((key) => caches.delete(key))
            )
          )
          .catch((error: unknown) => {
            console.error("Не удалось очистить PWA-кэш разработки", error);
          });
      }
      return () => {
        window.clearTimeout(iosEligibilityTimer);
        window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
        window.removeEventListener("appinstalled", handleInstalled);
      };
    }

    let registration: ServiceWorkerRegistration | undefined;
    let updateTimer: number | undefined;
    const hadControllerAtStart = Boolean(navigator.serviceWorker.controller);

    const watchRegistration = (nextRegistration: ServiceWorkerRegistration) => {
      registration = nextRegistration;
      if (nextRegistration.waiting) {
        setUpdateWorker(nextRegistration.waiting);
      }

      nextRegistration.addEventListener("updatefound", () => {
        const installingWorker = nextRegistration.installing;
        installingWorker?.addEventListener("statechange", () => {
          if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
            setUpdateWorker(nextRegistration.waiting ?? installingWorker);
          }
        });
      });
    };

    const registerServiceWorker = async () => {
      try {
        watchRegistration(await navigator.serviceWorker.register("/sw.js"));
        updateTimer = window.setInterval(
          () => {
            void registration?.update();
          },
          60 * 60 * 1000
        );
      } catch (error: unknown) {
        console.error("Не удалось зарегистрировать service worker", error);
      }
    };

    const handleControllerChange = () => {
      // An existing controller changing means a stale cached build was
      // replaced. Reload once so the current document receives matching JS.
      if (reloadForUpdate.current || hadControllerAtStart) {
        window.location.reload();
      }
    };
    const handleFocus = () => {
      void registration?.update();
    };

    if (document.readyState === "complete") {
      void registerServiceWorker();
    } else {
      window.addEventListener("load", registerServiceWorker);
    }
    window.addEventListener("focus", handleFocus);
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      window.clearTimeout(iosEligibilityTimer);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("load", registerServiceWorker);
      window.removeEventListener("focus", handleFocus);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      if (updateTimer) {
        window.clearInterval(updateTimer);
      }
    };
  }, []);

  async function install() {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (choice.outcome === "dismissed") {
      window.localStorage.setItem(INSTALL_DISMISSED_AT, String(Date.now()));
    }
  }

  function dismissInstall() {
    window.localStorage.setItem(INSTALL_DISMISSED_AT, String(Date.now()));
    setInstallPrompt(null);
    setIsIosInstallAvailable(false);
  }

  function applyUpdate() {
    if (!updateWorker) {
      return;
    }
    reloadForUpdate.current = true;
    updateWorker.postMessage({ type: "SKIP_WAITING" });
  }

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-[5.7rem] z-[60] flex flex-col items-center gap-2 xl:bottom-5 xl:left-auto xl:max-w-sm"
    >
      {!isOnline && (
        <div className="pointer-events-auto flex w-full items-center gap-3 rounded-2xl bg-[var(--strong)] p-3 text-sm text-white shadow-2xl">
          <WifiOff aria-hidden="true" className="shrink-0 text-red-300" size={19} />
          <p className="min-w-0 flex-1">Нет соединения. Доступны сохранённые страницы.</p>
          <button
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-3 font-semibold hover:bg-white/20"
            onClick={() => window.location.reload()}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={15} />
            Повторить
          </button>
        </div>
      )}

      {updateWorker && (
        <div className="pointer-events-auto flex w-full items-center gap-3 rounded-2xl border border-[var(--line)] bg-white p-3 text-sm shadow-2xl">
          <p className="min-w-0 flex-1 font-medium">Доступна новая версия Mathforces.</p>
          <button
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--strong)] px-3 font-semibold text-white"
            onClick={applyUpdate}
            type="button"
          >
            Обновить
          </button>
        </div>
      )}

      {(installPrompt || isIosInstallAvailable) && (
        <div className="pointer-events-auto relative w-full rounded-2xl border border-[var(--line)] bg-white p-4 pr-11 shadow-2xl">
          <button
            aria-label="Скрыть предложение установки"
            className="absolute right-2 top-2 grid size-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-muted)]"
            onClick={dismissInstall}
            type="button"
          >
            <X aria-hidden="true" size={17} />
          </button>
          <div className="flex gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--strong)] text-white">
              <Download aria-hidden="true" size={18} />
            </span>
            <div>
              <p className="font-semibold">Установить Mathforces</p>
              {installPrompt ? (
                <>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                    Открывайте контесты как обычное приложение.
                  </p>
                  <button
                    className="mt-3 min-h-9 rounded-lg bg-[var(--strong)] px-3 text-sm font-semibold text-white"
                    onClick={() => void install()}
                    type="button"
                  >
                    Установить
                  </button>
                </>
              ) : (
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  В Safari нажмите «Поделиться», затем «На экран “Домой”».
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
