"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import {
	fnCreateUserRequest,
	fnCheckRequestStatus,
	fnSetPinWithRequestKey,
	fnLoginWithPin,
	type RequestStatus,
} from "@/lib/functions";
import { signInWithCustomTokenAndRemember } from "@/lib/authClient";

// Enkelt UI for hele PIN-flyten:
// 1) Ny ansatt registrerer navn/telefon (createUserRequest)
// 2) Vi lagrer requestKey i localStorage og kan sjekke status / sette PIN
// 3) Bruker kan logge inn med PIN (loginWithPin + signInWithCustomToken)

const REQUEST_KEY_STORAGE = "airliftas:requestKey";

function onlyDigits4(v: string) {
	return v.replace(/\D/g, "").slice(0, 4);
}

export default function HomePage() {
	const router = useRouter();

	// Registrering
	const [name, setName] = useState("");
	const [phone, setPhone] = useState("");
	const [busyCreate, setBusyCreate] = useState(false);

	// Status / requestKey
	const [requestKey, setRequestKey] = useState<string | null>(null);
	const [status, setStatus] = useState<RequestStatus | null>(null);
	const [busyStatus, setBusyStatus] = useState(false);

	// PIN-setting for godkjent request
	const [setupPin, setSetupPin] = useState("");
	const [busySetPin, setBusySetPin] = useState(false);

	// PIN-login
	const [loginPin, setLoginPin] = useState("");
	const [busyLogin, setBusyLogin] = useState(false);

	const [msg, setMsg] = useState<string | null>(null);

		const refreshStatus = useCallback(
			async (key?: string) => {
				const effectiveKey = key ?? requestKey;
				if (!effectiveKey) return;

				setBusyStatus(true);
				setMsg(null);
				try {
					const res = await fnCheckRequestStatus(effectiveKey);
					setStatus(res);
					if (!res.found) {
						setMsg(
							"Fant ingen registreringsforespørsel for lagret nøkkel. Be evt. om å bli registrert på nytt.",
						);
					}
				} catch {
					setMsg("Kunne ikke hente status. Sjekk nettverk og Firebase Functions.");
				} finally {
					setBusyStatus(false);
				}
			},
			[requestKey],
		);

		// Les eventuell tidligere requestKey fra localStorage ved oppstart.
		useEffect(() => {
			if (typeof window === "undefined") return;
			const stored = window.localStorage.getItem(REQUEST_KEY_STORAGE);
			if (stored) {
				setRequestKey(stored);
				void refreshStatus(stored);
			}
		}, [refreshStatus]);

		async function handleCreateRequest(e: FormEvent) {
		e.preventDefault();
		setMsg(null);
		setBusyCreate(true);
		try {
			const trimmedName = name.trim();
			const trimmedPhone = phone.trim();
			if (!trimmedName || !trimmedPhone) {
				setMsg("Fyll inn navn og telefon.");
				return;
			}

				const { requestId, requestKey: rk } = await fnCreateUserRequest(
					trimmedName,
					trimmedPhone,
				);

			if (typeof window !== "undefined") {
				window.localStorage.setItem(REQUEST_KEY_STORAGE, rk);
			}

			setRequestKey(rk);
				setStatus({
					found: true,
					requestId,
					status: "pending",
					name: trimmedName,
					phone: trimmedPhone,
					pinSet: false,
				});
			setMsg(
				"Forespørsel sendt. En admin må godkjenne deg før du kan sette PIN.",
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

	async function handleSetPin(e: FormEvent) {
		e.preventDefault();
		setMsg(null);
		if (!requestKey) {
			setMsg("Mangler requestKey. Send registreringsskjema på nytt.");
			return;
		}

		const pin = onlyDigits4(setupPin);
		if (pin.length !== 4) {
			setMsg("PIN må være 4 siffer.");
			return;
		}

		setBusySetPin(true);
		try {
			await fnSetPinWithRequestKey(requestKey, pin);
			setSetupPin("");
			setMsg("PIN er lagret. Du kan nå logge inn med PIN under.");
			await refreshStatus(requestKey);
		} catch {
			// Backend lekker ikke detaljer, så vi viser samme generiske melding.
			setMsg("Pinkode ikke godkjent – prøv en ny.");
		} finally {
			setBusySetPin(false);
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
		<main className="min-h-screen bg-zinc-50 p-6">
			<div className="mx-auto flex max-w-4xl flex-col gap-8">
				<header className="space-y-2">
					<h1 className="text-2xl font-semibold">Airliftas – PIN-innlogging</h1>
						<p className="text-base text-zinc-800">
						Registrer deg som bruker, sett PIN når du er godkjent, og logg inn med
							PIN. Admin-grensesnittet finner du på <code>/admin</code>.
					</p>
				</header>

				{msg && (
					<div className="rounded-xl border border-zinc-200 bg-white p-3 text-sm">
						{msg}
					</div>
				)}

				<section className="grid gap-6 md:grid-cols-2">
					{/* Ny registreringsforespørsel */}
					<div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
						<h2 className="text-lg font-medium">1. Registrer deg</h2>
							<p className="text-sm text-zinc-800">
							Fyll inn navn og telefon. En admin godkjenner deg, og deretter kan du
								sette PIN.
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
							<button
								type="submit"
								disabled={busyCreate}
								className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
							>
								{busyCreate ? "Sender…" : "Send forespørsel"}
							</button>
						</form>
					</div>

					{/* Status + sett PIN */}
					<div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
						<h2 className="text-lg font-medium">2. Status &amp; PIN</h2>
							<p className="text-sm text-zinc-800">
							Vi bruker en hemmelig requestKey lagret i nettleseren din for å
								finne forespørselen din.
						</p>

							<div className="flex items-center gap-2 text-sm text-zinc-800">
							<span className="font-mono">
								{requestKey ? "RequestKey er lagret" : "Ingen requestKey lagret"}
							</span>
							<button
								type="button"
								onClick={() => refreshStatus()}
								disabled={!requestKey || busyStatus}
								className="rounded-xl border px-3 py-1"
							>
								{busyStatus ? "Oppdaterer…" : "Oppdater status"}
							</button>
						</div>

						{status?.found && (
							<div className="rounded-xl border border-dashed p-3 text-sm">
								<p>
									<b>Status:</b> {status.status}
								</p>
								{status.name && (
									<p>
										<b>Navn:</b> {status.name}
									</p>
								)}
								{status.phone && (
									<p>
										<b>Telefon:</b> {status.phone}
									</p>
								)}
								<p>
									<b>PIN satt:</b> {status.pinSet ? "Ja" : "Nei"}
								</p>
							</div>
						)}

						{status?.found && status.status === "approved" && !status.pinSet && (
							<form className="space-y-3" onSubmit={handleSetPin}>
								<div className="space-y-1">
									<label className="text-sm font-medium">Velg PIN (4 siffer)</label>
									<input
										inputMode="numeric"
										value={setupPin}
										onChange={(e) => setSetupPin(onlyDigits4(e.target.value))}
										className="w-32 rounded-xl border px-3 py-2 text-sm font-mono"
										placeholder="0000"
									/>
								</div>
								<button
									type="submit"
									disabled={busySetPin}
									className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
								>
									{busySetPin ? "Lagrer…" : "Sett PIN"}
								</button>
							</form>
						)}
					</div>
				</section>

				<section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 md:max-w-md">
					<h2 className="text-lg font-medium">3. Logg inn med PIN</h2>
						<p className="text-sm text-zinc-800">
						Når du har fått PIN, kan du logge inn her. Admin-grensesnittet krever at
							brukeren din har rollen <code>admin</code> i Firestore.
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
				</section>
			</div>
		</main>
	);
}
