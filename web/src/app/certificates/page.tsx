"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import { firebaseAuth } from "@/lib/firebaseClient";
import { isSessionExpired } from "@/lib/session";

export default function CertificatesPage() {
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
    <AppShell title="Sertifikater og utsjekker" backHref="/home">
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-zinc-900">
          Her kommer en samlet oversikt over sertifikater og utsjekker for
          piloter og lastemenn i Airlift. Siden skal gjøre det enkelt å se hva
          som er gyldig, hva som snart utløper og hva som mangler.
        </p>
        <p className="text-sm text-zinc-700">
          Foreløpig er dette bare en plassholder-side mens vi bestemmer
          struktur og datakilder for sertifikater og utsjekker.
        </p>
      </div>
    </AppShell>
  );
}

