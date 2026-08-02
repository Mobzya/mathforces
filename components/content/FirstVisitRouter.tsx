"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const VISITED_KEY = "mathforces:welcome-seen:v1";
const VISITED_COOKIE = "mathforces_welcome_seen";

export function FirstVisitRouter() {
  const router = useRouter();
  useEffect(() => {
    try {
      const alreadyVisited = Boolean(window.localStorage.getItem(VISITED_KEY));
      document.cookie = `${VISITED_COOKIE}=1; Path=/; Max-Age=31536000; SameSite=Lax`;
      if (alreadyVisited) router.replace("/feed");
      else window.localStorage.setItem(VISITED_KEY, new Date().toISOString());
    } catch {
      // Private mode may deny storage; in that case the landing stays usable.
    }
  }, [router]);
  return null;
}
