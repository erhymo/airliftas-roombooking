"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { firebaseAuth, firebaseDb } from "@/lib/firebaseClient";
import { isSessionExpired } from "@/lib/session";
import { useOnlineStatus } from "@/lib/useOnlineStatus";

	const HARD_CODED_ADMIN_EMAIL = "oyvind.myhre@airlift.no";

export default function BasePage() {
	const router = useRouter();
	const params = useParams<{ baseId: string }>();
	const baseId = params?.baseId ?? "";

		const auth = useMemo(() => firebaseAuth(), []);
		const db = useMemo(() => firebaseDb(), []);
	const [loading, setLoading] = useState(true);
	const [uid, setUid] = useState<string | null>(null);
	const isOnline = useOnlineStatus();
		const [isAdmin, setIsAdmin] = useState(false);

		useEffect(() => {
			const unsub = onAuthStateChanged(auth, (u) => {
				(void (async () => {
					setUid(u?.uid ?? null);
					if (!u?.uid || isSessionExpired()) {
						setIsAdmin(false);
						setLoading(false);
						router.replace("/");
						return;
					}

					setLoading(false);

					if (u.email === HARD_CODED_ADMIN_EMAIL) {
						setIsAdmin(true);
						return;
					}

					try {
						const snap = await getDoc(doc(db, "users", u.uid));
						const data = snap.data() as { role?: string; status?: string } | undefined;
						const ok = data?.status === "active" && data?.role === "admin";
						setIsAdmin(!!ok);
					} catch {
						setIsAdmin(false);
					}
				})());
			});
			return () => unsub();
		}, [auth, db, router]);

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
									<p className="text-sm text-zinc-800">
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
							<div className="text-sm text-zinc-800">
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
						{isAdmin && (
							<button
								onClick={() => router.push("/admin")}
								className="flex-1 rounded-xl border py-3 font-medium"
							>
								Admin
							</button>
						)}
				</div>
			</div>
		</main>
	);
}
