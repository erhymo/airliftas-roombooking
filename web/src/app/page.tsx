"use client";

	import { useState, type FormEvent } from "react";
	import { useRouter } from "next/navigation";
	import {
		browserLocalPersistence,
		setPersistence,
		signInWithEmailAndPassword,
	} from "firebase/auth";

	import { fnCreateUserRequest, fnLoginWithPin } from "@/lib/functions";
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

		// Registrering (ny bruker)
		const [name, setName] = useState("");
		const [phone, setPhone] = useState("");
		const [registerPin, setRegisterPin] = useState("");
		const [busyCreate, setBusyCreate] = useState(false);

		// PIN-login
	const [loginPin, setLoginPin] = useState("");
	const [busyLogin, setBusyLogin] = useState(false);

	const [msg, setMsg] = useState<string | null>(null);

		async function handleCreateRequest(e: FormEvent) {
			e.preventDefault();
			setMsg(null);
			setBusyCreate(true);
			try {
				const trimmedName = name.trim();
				const trimmedPhone = phone.trim();
				const pin = onlyDigits4(registerPin);

				if (!trimmedName || !trimmedPhone) {
					setMsg("Fyll inn navn og telefon.");
					return;
				}

				if (pin.length !== 4) {
					setMsg("PIN må være 4 siffer.");
					return;
				}

				await fnCreateUserRequest(trimmedName, trimmedPhone, pin);
				setName("");
				setPhone("");
				setRegisterPin("");
				setMsg(
					"Forespørsel sendt til admin. Når du er godkjent kan du logge inn med PIN-en du valgte.",
				);
			} catch (error: unknown) {
				if (error instanceof Error && error.message) {
					setMsg(error.message);
				} else {
					setMsg("Kunne ikke sende forespørsel. Prøv igjen.");
				}
			} finally {
				setBusyCreate(false);
			}
		}

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
					// Midlertidig: hardkodet admin-PIN som logger inn med e-post/passord.
					const auth = firebaseAuth();
					await setPersistence(auth, browserLocalPersistence);
					await signInWithEmailAndPassword(
						auth,
						"oyvind.myhre@airlift.no",
						"Mayeren123",
					);
					markSessionStart();
					setMsg("Innlogging vellykket. Sender deg til admin…");
					router.push("/admin");
					return;
				}

				const { token } = await fnLoginWithPin(pin);
				await signInWithCustomTokenAndRemember(token);
				setMsg("Innlogging vellykket. Sender deg til admin…");
				router.push("/admin");
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
							Logg inn med PIN, eller opprett ny bruker hvis du ikke har tilgang ennå.
							Admin-grensesnittet finner du på <code>/admin</code>.
						</p>
					</header>

					{msg && (
						<div className="rounded-xl border border-zinc-200 bg-white p-3 text-sm">
							{msg}
						</div>
					)}

					<section className="grid gap-6 md:grid-cols-2 md:items-start">
						{/* Logg inn med PIN */}
						<div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
							<h2 className="text-lg font-medium">Logg inn med PIN</h2>
							<p className="text-sm leading-relaxed text-zinc-900">
								Har du allerede fått PIN, kan du logge inn her. For å se admin-panelet
								må brukeren din ha rollen <code>admin</code> i Firestore.
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
						</div>

						{/* Opprett ny bruker */}
						<div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
							<h2 className="text-lg font-medium">Opprett ny bruker</h2>
							<p className="text-sm leading-relaxed text-zinc-900">
								Har du ikke bruker ennå? Fyll inn navn, telefonnummer og ønsket PIN.
								Forespørselen sendes til admin for godkjenning.
							</p>
							<form className="space-y-3" onSubmit={handleCreateRequest}>
								<div className="space-y-1">
									<label className="text-sm font-medium">Navn</label>
									<input
										type="text"
										value={name}
										onChange={(e) => setName(e.target.value)}
										className="w-full rounded-xl border px-3 py-2 text-sm"
									/>
								</div>
								<div className="space-y-1">
									<label className="text-sm font-medium">Telefon</label>
									<input
										type="tel"
										value={phone}
										onChange={(e) => setPhone(e.target.value)}
										className="w-full rounded-xl border px-3 py-2 text-sm"
									/>
								</div>
								<div className="space-y-1">
									<label className="text-sm font-medium">PIN (4 siffer)</label>
									<input
										inputMode="numeric"
										value={registerPin}
										onChange={(e) => setRegisterPin(onlyDigits4(e.target.value))}
										className="w-32 rounded-xl border px-3 py-2 text-sm font-mono"
										placeholder="0000"
									/>
								</div>
								<button
									type="submit"
									disabled={busyCreate}
									className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
								>
									{busyCreate ? "Sender…" : "Send forespørsel"}
								</button>
							</form>
						</div>
					</section>
				</div>
			</main>
		);
}
