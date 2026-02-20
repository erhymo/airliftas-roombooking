"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { firebaseAuth, firebaseDb } from "@/lib/firebaseClient";
import { isSessionExpired } from "@/lib/session";

const BASES: { id: string; name: string }[] = [
	{ id: "bergen", name: "Bergen" },
	{ id: "bringeland", name: "Bringeland" },
	{ id: "kinsarvik", name: "Kinsarvik" },
];

	const HARD_CODED_ADMIN_EMAIL = "oyvind.myhre@airlift.no";

export default function BasesPage() {
	const router = useRouter();
	const auth = useMemo(() => firebaseAuth(), []);
		const db = useMemo(() => firebaseDb(), []);
	const [loading, setLoading] = useState(true);
	const [uid, setUid] = useState<string | null>(null);
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

	if (loading) {
		return (
			<main className="min-h-screen p-6">
				<div className="mx-auto max-w-md">Laster…</div>
			</main>
		);
	}

	if (!uid) {
		return (
			<main className="min-h-screen p-6">
				<div className="mx-auto max-w-md space-y-3">
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
		<main className="min-h-screen bg-zinc-50 p-6 text-zinc-900">
				<div className="mx-auto flex max-w-3xl flex-col gap-6">
					<div className="flex justify-center">
						<img
							src="https://images.squarespace-cdn.com/content/v1/538c76b6e4b0766b4d3cb456/1459857868107-9IPO4KON0JG63MVNF6DG/Airlift_logo_rgb.png"
							alt="Airlift"
							className="h-8 w-auto"
						/>
					</div>
					<header className="space-y-1">
					<h1 className="text-2xl font-semibold">Velg base</h1>
					<p className="text-sm text-zinc-800">
						Velg hvilken base du vil se rombooking for.
					</p>
				</header>

					<div className="grid gap-3 sm:grid-cols-3">
						{BASES.map((b) => (
							<button
								key={b.id}
									onClick={() => router.push(`/base/${b.id}`)}
								className="rounded-xl border border-sky-200 bg-white px-4 py-3 text-sm font-medium text-sky-900 hover:bg-sky-50"
							>
								{b.name}
							</button>
						))}
					</div>

							<div className="flex items-center justify-between">
								<button
									onClick={() => router.push("/home")}
									className="rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-900 hover:bg-sky-50"
								>
									Tilbake til forside
								</button>
								{isAdmin && (
									<button
										onClick={() => router.push("/admin")}
										className="rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-900 hover:bg-sky-50"
									>
										Til admin
									</button>
								)}
							</div>
			</div>
		</main>
	);
}
