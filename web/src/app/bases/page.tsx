"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";

import { firebaseAuth } from "@/lib/firebaseClient";
import { isSessionExpired } from "@/lib/session";

const BASES: { id: string; name: string }[] = [
	{ id: "bergen", name: "Bergen" },
	{ id: "bringeland", name: "Bringeland" },
	{ id: "kinsarvik", name: "Kinsarvik" },
];

export default function BasesPage() {
	const router = useRouter();
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
							onClick={() => router.push(`/bases/${b.id}`)}
							className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium hover:bg-zinc-50"
						>
							{b.name}
						</button>
					))}
				</div>

				<div className="flex justify-end">
					<button
						onClick={() => router.push("/admin")}
						className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
					>
						Til admin
					</button>
				</div>
			</div>
		</main>
	);
}
