import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import "@/app/globals.css";
import { MobileNav } from "@/components/layout/MobileNav";
import { NavigationProgress } from "@/components/layout/NavigationProgress";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { CurrentUserProvider } from "@/components/auth/CurrentUserProvider";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import { PreferencesProvider } from "@/components/settings/PreferencesProvider";
import { ThemeScript } from "@/components/settings/ThemeScript";
import { getCurrentUser } from "@/server/auth/session";
import { serializeCurrentUser } from "@/server/users/serialize";

export const metadata: Metadata = {
  title: {
    default: "Mathforces — математика как спорт",
    template: "%s · Mathforces"
  },
  description: "Платформа для школьных математических контестов, решений и рейтинга.",
  applicationName: "Mathforces",
  manifest: "/manifest.webmanifest",
  icons: {
    apple: "/icons/apple-touch-icon.png",
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mathforces"
  },
  formatDetection: {
    telephone: false
  }
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: "#13233d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  await connection();
  let initialUser = null;
  let initialResolved = false;
  try {
    const user = await getCurrentUser();
    initialUser = user ? serializeCurrentUser(user) : null;
    initialResolved = true;
  } catch (error: unknown) {
    console.error("Не удалось проверить сессию в layout", error);
  }
  return (
    <html data-scroll-behavior="smooth" lang="ru" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <PreferencesProvider>
          <CurrentUserProvider initialResolved={initialResolved} initialUser={initialUser}>
            <Suspense fallback={null}>
              <NavigationProgress />
            </Suspense>
            <a className="skip-link" href="#main-content">
              Перейти к содержимому
            </a>
            <SiteHeader />
            <main id="main-content">{children}</main>
            <SiteFooter />
            <MobileNav />
            <ServiceWorkerRegistration />
          </CurrentUserProvider>
        </PreferencesProvider>
      </body>
    </html>
  );
}
