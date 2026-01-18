"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";

import { firebaseAuth } from "@/lib/firebaseClient";
import { isSessionExpired } from "@/lib/session";
import { useOnlineStatus } from "@/lib/useOnlineStatus";

export default function BasePage() {
	const router = useRouter();
	const params = useParams<{ baseId: string }>();
	const baseId = params?.baseId ?? "";

	const auth = useMemo(() => firebaseAuth(), []);
	const [loading, setLoading] = useState(true);
	const [uid, setUid] = useState<string | null>(null);
	const isOnline = useOnlineStatus();

	useEffect(() => {
		const unsub = onAuthStateChanged(auth, (u) => {
			setUid(u?.uid ?? null);
			setLoading(false);
			if (!u?.uid || isSessionExpired()) {
				router.replace("/");
			}
		});
		return () => unsub();
	}, [auth, router]);

	const title =
		baseId === "bergen"
			? "Bergen"
			: baseId === "bringeland"
				? "Bringeland"
				: baseId === "kinsarvik"
					? "Kinsarvik"
					: baseId;

	if (loading) {
		return (
			<main className="min-h-screen p-6">
				<div className="max-w-md mx-auto">Laster…</div>
			</main>
		);
	}

	if (!uid) {
		return (
			<main className="min-h-screen p-6">
				<div className="max-w-md mx-auto space-y-3">
					<h1 className="text-2xl font-semibold">{title}</h1>
					<p>Du må være innlogget.</p>
					<button
						onClick={() => router.push("/")}
						className="rounded-xl border px-4 py-2"
					>
						Til innlogging
					</button>
				</div>
			</main>
		);
	}

	return (
		<main className="min-h-screen p-6">
			<div className="max-w-md mx-auto space-y-4">
					<header className="space-y-1">
						<div className="flex items-start justify-between gap-4">
							<div>
								<h1 className="text-2xl font-semibold">{title}</h1>
								<p className="text-sm opacity-80">
									Neste etappe: plantegning (SVG) + romklikk + booking
								</p>
							</div>
							{!isOnline && (
								<span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
									Offline – synker når online
								</span>
							)}
						</div>
					</header>

				<div className="rounded-2xl border p-4 space-y-3">
					<div className="font-medium">Status</div>
					<div className="text-sm opacity-80">
						Denne siden er en placeholder. I neste etappe legger vi inn SVG
						for rom, klikking, og booking-logikk.
					</div>
				</div>

				<div className="flex gap-2">
					<button
						onClick={() => router.push("/bases")}
						className="flex-1 rounded-xl border py-3 font-medium"
					>
						Tilbake
					</button>
					<button
						onClick={() => router.push("/admin")}
						className="flex-1 rounded-xl border py-3 font-medium"
					>
						Admin
					</button>
				</div>
			</div>
		</main>
	);
}
