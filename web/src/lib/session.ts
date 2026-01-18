"use client";

// Enkle helpers for å markere/start/rydde en klientside-"session" i localStorage.
// Brukes kun som et hint på klientsiden (ingen sikkerhetsbetydning).

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const KEY = "sessionStart";

export function markSessionStart() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, String(Date.now()));
}

export function clearSessionStart() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

export function isSessionExpired(): boolean {
  if (typeof window === "undefined") return true;

  const v = window.localStorage.getItem(KEY);
  if (!v) return true;

  const t = Number(v);
  return !Number.isFinite(t) || Date.now() - t > TWO_DAYS_MS;
}

