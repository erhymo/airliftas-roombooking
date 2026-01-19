"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
	browserLocalPersistence,
	setPersistence,
	signInWithEmailAndPassword,
} from "firebase/auth";

import { fnLoginWithPin } from "@/lib/functions";
import { signInWithCustomTokenAndRemember } from "@/lib/authClient";
import { firebaseAuth } from "@/lib/firebaseClient";
import { markSessionStart } from "@/lib/session";

	// Enkelt UI for PIN-flyten:
	// 1) Ansatt kan logge inn direkte med PIN.
	// 2) Hvis man ikke har bruker, kan man opprette ny bruker med navn/telefon/PIN.

function onlyDigits4(v: string) {
	return v.replace(/\D/g, "").slice(0, 4);
}

export default function HomePage() {
	const router = useRouter();

	// PIN-login
	const [loginPin, setLoginPin] = useState("");
	const [busyLogin, setBusyLogin] = useState(false);
	const [msg, setMsg] = useState<string | null>(null);

	async function handleLogin(e: FormEvent) {
		e.preventDefault();
		setMsg(null);

		const pin = onlyDigits4(loginPin);
		if (pin.length !== 4) {
			setMsg("PIN må være 4 siffer.");
			return;
		}

		setBusyLogin(true);
		try {
			if (pin === "5545") {
				// Midlertidig: hardkodet admin-PIN som logger inn med e-post/passord,
				// men sender deg til rombooking, ikke admin-panelet.
				const auth = firebaseAuth();
				await setPersistence(auth, browserLocalPersistence);
				await signInWithEmailAndPassword(
					auth,
					"oyvind.myhre@airlift.no",
					"Mayeren123",
				);
				markSessionStart();
				setMsg("Innlogging vellykket. Sender deg til rombooking…");
					router.push("/home");
				return;
			}

			const { token } = await fnLoginWithPin(pin);
			await signInWithCustomTokenAndRemember(token);
			setMsg("Innlogging vellykket. Sender deg til rombooking…");
				router.push("/home");
		} catch {
			setMsg("Pinkode ikke godkjent – prøv en ny.");
		} finally {
			setBusyLogin(false);
		}
	}

	return (
		<main className="min-h-screen bg-zinc-50 p-6 text-zinc-900">
			<div className="mx-auto flex max-w-4xl flex-col gap-8">
				<header className="space-y-2">
					<h1 className="text-2xl font-semibold">Airliftas – PIN-innlogging</h1>
					<p className="text-base font-normal leading-relaxed text-zinc-900">
						Logg inn med PIN. Har du ikke bruker ennå, kan du opprette ny bruker via
						lenken under.
						 Admin-grensesnittet finner du på <code>/admin</code>.
					</p>
				</header>

				{msg && (
					<div className="rounded-xl border border-zinc-200 bg-white p-3 text-sm">
						{msg}
					</div>
				)}

				<section className="max-w-md">
					{/* Logg inn med PIN */}
					<div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4">
						<h2 className="text-lg font-medium">Logg inn med PIN</h2>
						<p className="text-sm leading-relaxed text-zinc-900">
							Har du allerede fått PIN, kan du logge inn her.
						</p>
						<form className="flex items-end gap-3" onSubmit={handleLogin}>
							<div className="space-y-1">
								<label className="text-sm font-medium">PIN</label>
								<input
									inputMode="numeric"
									value={loginPin}
									onChange={(e) => setLoginPin(onlyDigits4(e.target.value))}
									className="w-32 rounded-xl border px-3 py-2 text-sm font-mono"
									placeholder="0000"
								/>
							</div>
							<button
								className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
								type="submit"
								disabled={busyLogin}
							>
								{busyLogin ? "Logger inn…" : "Logg inn"}
							</button>
						</form>

						<button
							type="button"
							onClick={() => router.push("/signup")}
							className="text-xs font-medium text-blue-600 underline"
						>
							Opprett ny bruker
						</button>
					</div>
				</section>
			</div>
		</main>
	);
}
