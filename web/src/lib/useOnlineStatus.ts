"use client";

import { useEffect, useState } from "react";

/**
 * Hook som eksponerer nettverksstatus basert på window.navigator.onLine
 * og "online"/"offline"-events i nettleseren.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      // Antar online under server-rendering / build.
      return true;
    }
    return window.navigator.onLine;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

