"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { fnCreateUserRequest } from "@/lib/functions";

function onlyDigits4(v: string) {
	return v.replace(/\D/g, "").slice(0, 4);
}

export default function SignupPage() {
	const router = useRouter();

	const [name, setName] = useState("");
	const [phone, setPhone] = useState("");
		const [role, setRole] = useState("");
	const [registerPin, setRegisterPin] = useState("");
	const [busyCreate, setBusyCreate] = useState(false);
	const [msg, setMsg] = useState<string | null>(null);

	async function handleCreateRequest(e: FormEvent) {
		e.preventDefault();
		setMsg(null);
		setBusyCreate(true);
		try {
			const trimmedName = name.trim();
			const trimmedPhone = phone.trim();
			const pin = onlyDigits4(registerPin);
				const crewRole = role.trim();

			if (!trimmedName || !trimmedPhone) {
				setMsg("Fyll inn navn og telefon.");
				return;
			}

				if (!crewRole) {
					setMsg("Velg hvilken rolle du har.");
					return;
				}

			if (pin.length !== 4) {
				setMsg("PIN må være 4 siffer.");
				return;
			}

				await fnCreateUserRequest(trimmedName, trimmedPhone, pin, crewRole);
			setName("");
			setPhone("");
				setRole("");
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

	return (
		<main className="min-h-screen bg-zinc-50 p-6 text-zinc-900">
			<div className="mx-auto flex max-w-md flex-col gap-6">
				<header className="space-y-2">
					<h1 className="text-2xl font-semibold">Opprett ny bruker</h1>
					<p className="text-sm leading-relaxed text-zinc-900">
						Fyll inn navn, telefonnummer og ønsket PIN. Forespørselen sendes til admin
						for godkjenning.
					</p>
				</header>

				{msg && (
					<div className="rounded-xl border border-zinc-200 bg-white p-3 text-sm">
						{msg}
					</div>
				)}

				<section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
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
								<label className="text-sm font-medium">Rolle</label>
								<select
									value={role}
									onChange={(e) => setRole(e.target.value)}
									className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
								>
									<option value="">Velg rolle</option>
									<option value="pilot_los">Pilot LOS</option>
									<option value="pilot_innland">Pilot innland</option>
									<option value="lastemann">Lastemann</option>
									<option value="tekniker">Tekniker</option>
									<option value="admin">Admin</option>
								</select>
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
							className="rounded-xl bg-sky-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 hover:bg-sky-800"
						>
							{busyCreate ? "Sender…" : "Send forespørsel"}
						</button>
					</form>
				</section>

				<button
					type="button"
					onClick={() => router.push("/")}
					className="w-full rounded-xl border border-zinc-200 bg-white py-3 text-sm font-medium"
				>
					Tilbake til innlogging
				</button>
			</div>
		</main>
	);
}

