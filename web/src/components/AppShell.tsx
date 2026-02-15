"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

export type AppShellProps = {
  title: string;
  subtitle?: string;
  backHref?: string;
  /**
   * When true, shows a small offline badge in the header.
   * Used på basesidene der vi har lokal cache og synk mot Firestore.
   */
  offline?: boolean;
  offlineLabel?: string;
  /**
   * Optional area i høyre del av headeren (f.eks. admin-knapper).
   */
  rightSlot?: ReactNode;
  children: ReactNode;
};

export default function AppShell({
  title,
  subtitle,
  backHref,
  offline,
  offlineLabel,
  rightSlot,
  children,
}: AppShellProps) {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Sticky header */}
      <div className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            {backHref && (
              <button
                type="button"
                onClick={() => router.push(backHref)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                aria-label="Tilbake"
              >
                {"<"}
              </button>
            )}
            <div>
              <h1 className="text-base font-semibold sm:text-lg">{title}</h1>
              {subtitle && (
                <p className="text-xs text-zinc-700 sm:text-sm">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {offline && (
              <span className="hidden rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 sm:inline-flex">
                {offlineLabel ?? "Offline – synker når online"}
              </span>
            )}
            {rightSlot}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-6">
        {children}
      </div>
    </main>
  );
}

