"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import { firebaseAuth } from "@/lib/firebaseClient";
import { isSessionExpired } from "@/lib/session";

export default function SchedulePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const auth = firebaseAuth();
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user || isSessionExpired()) {
        router.replace("/");
      } else {
        setChecking(false);
      }
    });
    return () => unsub();
  }, [router]);

  if (checking) {
    return (
      <main className="min-h-screen bg-zinc-50 p-6 text-zinc-900">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm text-zinc-600">Laster…</p>
        </div>
      </main>
    );
  }

  return (
    <AppShell title="Din schedule" backHref="/home">
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-zinc-900">
          Her kommer en oppdatert oversikt over din personlige schedule. Siden
          vil hente data fra SharePoint to ganger i døgnet og bare vise
          informasjon som gjelder deg.
        </p>
        <p className="text-sm text-zinc-700">
          Foreløpig er dette bare en plassholder-side mens integrasjonen mot
          SharePoint settes opp.
        </p>
      </div>
    </AppShell>
  );
}

