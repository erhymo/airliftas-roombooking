"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";

import { firebaseAuth, firebaseDb } from "@/lib/firebaseClient";
import { isSessionExpired } from "@/lib/session";

const HARD_CODED_ADMIN_EMAIL = "oyvind.myhre@airlift.no";

export default function HomeAppPage() {
	const router = useRouter();
	const [checking, setChecking] = useState(true);
	const [isAdmin, setIsAdmin] = useState(false);

	useEffect(() => {
		const auth = firebaseAuth();
		const db = firebaseDb();
		const unsub = auth.onAuthStateChanged((user) => {
			(void (async () => {
				if (!user || isSessionExpired()) {
					setIsAdmin(false);
					setChecking(false);
					router.replace("/");
					return;
				}

				// Logged in – check admin status
				if (user.email === HARD_CODED_ADMIN_EMAIL) {
					setIsAdmin(true);
					setChecking(false);
					return;
				}

				try {
					const snap = await getDoc(doc(db, "users", user.uid));
					const data = snap.data() as { role?: string; status?: string } | undefined;
					const ok = data?.status === "active" && data?.role === "admin";
					setIsAdmin(!!ok);
				} catch {
					setIsAdmin(false);
				} finally {
					setChecking(false);
				}
			})());
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
		<main className="min-h-screen bg-zinc-50 p-6 text-zinc-900">
			<div className="mx-auto flex max-w-4xl flex-col gap-8">
				<div className="flex justify-center">
					<img
						src="https://images.squarespace-cdn.com/content/v1/538c76b6e4b0766b4d3cb456/1459857868107-9IPO4KON0JG63MVNF6DG/Airlift_logo_rgb.png"
						alt="Airlift"
						className="h-8 w-auto"
					/>
				</div>
				<header className="space-y-2">
					<h1 className="text-2xl font-semibold">Velg hva du vil gjøre</h1>
				</header>

				<section className="grid gap-6 md:grid-cols-2 md:items-start">
					<button
						type="button"
						onClick={() => router.push("/bases")}
						className="flex flex-col items-start gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
					>
						<div className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
							Rombooking
						</div>
						<div className="space-y-1">
							<div className="text-base font-semibold text-zinc-900">
								Gå til rombooking
							</div>
							<p className="text-sm text-zinc-700">
								Se tilgjengelige rom på basene og opprett / endre bookinger.
							</p>
						</div>
					</button>

					<button
						type="button"
						onClick={() => router.push("/schedule")}
						className="flex flex-col items-start gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
					>
						<div className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
							Din schedule
						</div>
						<div className="space-y-1">
							<div className="text-base font-semibold text-zinc-900">
								Se din schedule
							</div>
							<p className="text-sm text-zinc-700">
								Her kommer en enkel oversikt over din personlige schedule.
							</p>
						</div>
					</button>

					<button
						type="button"
						onClick={() => router.push("/certificates")}
						className="flex flex-col items-start gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
					>
						<div className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
							Sertifikater og utsjekker
						</div>
						<div className="space-y-1">
							<div className="text-base font-semibold text-zinc-900">
								Oversikt over dine sertifikater
							</div>
							<p className="text-sm text-zinc-700">
								Her kommer en samlet oversikt over sertifikater og utsjekker for
								piloter og lastemenn.
							</p>
						</div>
					</button>

					{isAdmin && (
						<button
							type="button"
							onClick={() => router.push("/admin")}
							className="flex flex-col items-start gap-2 rounded-xl border border-sky-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
						>
							<div className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-800">
								Admin
							</div>
							<div className="space-y-1">
								<div className="text-base font-semibold text-zinc-900">
									Gå til adminpanel
								</div>
								<p className="text-sm text-zinc-700">
									Administrer brukere og bookinger (kun for admin).
								</p>
							</div>
						</button>
					)}
				</section>
			</div>
		</main>
	);
}

