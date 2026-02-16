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
			<div className="sticky top-0 z-40 bg-sky-900 text-white shadow-sm">
				<div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
					<div className="flex items-center gap-3">
						{backHref && (
							<button
								type="button"
								onClick={() => router.push(backHref)}
								className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-white/10 text-sm font-medium text-white hover:bg-white/20"
								aria-label="Tilbake"
							>
								{"<"}
							</button>
						)}
						<img
							src="https://images.squarespace-cdn.com/content/v1/538c76b6e4b0766b4d3cb456/1459857868107-9IPO4KON0JG63MVNF6DG/Airlift_logo_rgb.png"
							alt="Airlift"
							className="h-6 w-auto"
						/>
						<div>
							<h1 className="text-base font-semibold sm:text-lg">{title}</h1>
							{subtitle && (
								<p className="text-xs text-sky-100 sm:text-sm">{subtitle}</p>
							)}
						</div>
					</div>

					<div className="flex items-center gap-2">
						{offline && (
							<span className="hidden rounded-full border border-white/40 bg-white/10 px-3 py-1 text-xs font-medium text-white sm:inline-flex">
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

