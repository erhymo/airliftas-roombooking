"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";

import { firebaseAuth } from "@/lib/firebaseClient";
import { isSessionExpired } from "@/lib/session";
import BergenBase from "@/app/base/[baseId]/BergenBase";

export default function BasePage() {
	const router = useRouter();
	const params = useParams<{ baseId: string }>();
	const baseId = params?.baseId ?? "";

	const auth = useMemo(() => firebaseAuth(), []);
	const [loading, setLoading] = useState(true);
	const [uid, setUid] = useState<string | null>(null);

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

	// Bergen MVP (Etappe 4)
	if (baseId === "bergen") {
		return (
			<main className="min-h-screen p-6">
				<div className="max-w-3xl mx-auto">
					<BergenBase />
				</div>
			</main>
		);
	}

	const title =
		baseId === "bringeland"
			? "Bringeland"
			: baseId === "kinsarvik"
				? "Kinsarvik"
				: baseId;

	return (
		<main className="min-h-screen p-6">
			<div className="max-w-md mx-auto space-y-4">
				<h1 className="text-2xl font-semibold">{title}</h1>
				<div className="rounded-2xl border p-4 text-sm opacity-80">
					Placeholder. Neste etapper: SVG + booking for denne basen.
				</div>
				<button
					onClick={() => router.push("/bases")}
					className="w-full rounded-xl border py-3 font-medium"
				>
					Tilbake
				</button>
			</div>
		</main>
	);
}
