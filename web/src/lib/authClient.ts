"use client";

import {
  browserLocalPersistence,
  setPersistence,
  signInWithCustomToken,
  type UserCredential,
} from "firebase/auth";

import { firebaseAuth } from "./firebaseClient";

// Enkel helper rundt Firebase Auth for PIN-basert innlogging med custom token.
// - Sørger for at session lagres i localStorage (browserLocalPersistence).
// - Lagrer tidspunkt for siste vellykkede innlogging i localStorage slik at
//   vi kan gjøre en enkel "er brukeren nylig innlogget?"-sjekk på klientsiden.

const SESSION_KEY = "airliftas:lastSignInAt";

export async function signInWithCustomTokenAndRemember(
  token: string,
): Promise<UserCredential> {
  const auth = firebaseAuth();

  // Sørg for at innloggingen overlever refresh / nye faner.
  await setPersistence(auth, browserLocalPersistence);

  const cred = await signInWithCustomToken(auth, token);

  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SESSION_KEY, new Date().toISOString());
    }
  } catch {
    // Hvis localStorage ikke er tilgjengelig, ignorerer vi feilen.
  }

  return cred;
}

/**
 * Returnerer true hvis vi nylig har logget inn (standard: siste 24 timer).
 * Dette er kun et hint på klientsiden, og har ingen sikkerhetsbetydning
 * (den faktiske sessionen styres av Firebase Auth).
 */
export function isSessionFresh(maxHours = 24): boolean {
  if (typeof window === "undefined") return false;

  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return false;

  const last = new Date(raw).getTime();
  if (Number.isNaN(last)) return false;

  const ageMs = Date.now() - last;
  return ageMs < maxHours * 60 * 60 * 1000;
}

