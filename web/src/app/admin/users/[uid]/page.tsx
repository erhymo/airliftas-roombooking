"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";

import AppShell from "@/components/AppShell";
import { firebaseAuth } from "@/lib/firebaseClient";
import { isSessionExpired } from "@/lib/session";
import {
	fnAdminListUsersWithPins,
	fnAdminChangePin,
	fnAdminDeleteUser,
	type AdminUserWithPin,
} from "@/lib/functions";

function onlyDigits4(v: string) {
	return v.replace(/\D/g, "").slice(0, 4);
}

export default function AdminUserDetailPage() {
	const router = useRouter();
	const params = useParams<{ uid: string }>();
	const targetUid = params?.uid ?? "";
	const auth = useMemo(() => firebaseAuth(), []);

	const [loading, setLoading] = useState(true);
	const [isAdmin, setIsAdmin] = useState(false);
	const [user, setUser] = useState<AdminUserWithPin | null>(null);
	const [newPin, setNewPin] = useState("");
	const [busyChangePin, setBusyChangePin] = useState(false);
	const [busyDelete, setBusyDelete] = useState(false);
	const [msg, setMsg] = useState<string | null>(null);

	useEffect(() => {
		if (!targetUid) {
			setLoading(false);
			setUser(null);
			return;
		}

		let cancelled = false;

		const unsub = onAuthStateChanged(auth, async (u) => {
			if (!u || isSessionExpired()) {
				if (!cancelled) {
					setIsAdmin(false);
					setLoading(false);
					router.replace("/");
				}
				return;
			}

			setLoading(true);
			setMsg(null);

			try {
				const res = await fnAdminListUsersWithPins();
				if (cancelled) return;

				setIsAdmin(true);
				const found = res.users.find((usr) => usr.uid === targetUid) ?? null;
				setUser(found);
				if (!found) {
					setMsg("Fant ikke denne brukeren.");
				}
			} catch (err) {
				if (cancelled) return;
				setIsAdmin(false);
				setMsg("Du har ikke admin-tilgang.");
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		});

		return () => {
			cancelled = true;
			unsub();
		};
	}, [auth, router, targetUid]);

	async function handleLogout() {
		try {
			await signOut(auth);
		} finally {
			router.push("/admin");
		}
	}

	async function handleChangePin(e: FormEvent) {
		e.preventDefault();
		if (!user) return;

		setMsg(null);
		if (newPin.length !== 4) {
			setMsg("Pinkode må være 4 siffer.");
			return;
		}

		setBusyChangePin(true);
		try {
			await fnAdminChangePin(user.uid, newPin);
			setMsg("Pinkode er oppdatert.");
			setNewPin("");

			// Oppdater lokal brukerinfo (hasPin = true)
			setUser((prev) => (prev ? { ...prev, hasPin: true } : prev));
		} catch (error: unknown) {
			if (error instanceof Error && error.message) {
				const cleaned = error.message.replace(/^.*?:\s*/, "");
				setMsg(cleaned || "Kunne ikke oppdatere PIN.");
			} else {
				setMsg("Kunne ikke oppdatere PIN.");
			}
		} finally {
			setBusyChangePin(false);
		}
	}

	async function handleDeleteUser() {
		if (!user) return;
		// Enkel bekreftelse i nettleseren
		// eslint-disable-next-line no-alert
		const ok = window.confirm(
			"Er du sikker på at du vil slette denne brukeren? Dette kan ikke angres.",
		);
		if (!ok) return;

		setMsg(null);
		setBusyDelete(true);
		try {
			await fnAdminDeleteUser(user.uid);
			setMsg("Bruker er slettet.");
			router.push("/admin");
		} catch {
			setMsg("Kunne ikke slette bruker. Sjekk admin-tilgang og prøv igjen.");
		} finally {
			setBusyDelete(false);
		}
	}

	if (loading) {
		return (
			<main className="min-h-screen bg-zinc-50 p-6 text-zinc-900">
				<div className="mx-auto max-w-4xl text-sm text-zinc-700">Laster…</div>
			</main>
		);
	}

	if (!isAdmin) {
		return (
			<main className="min-h-screen bg-zinc-50 p-6 text-zinc-900">
				<div className="mx-auto max-w-md space-y-4">
					<h1 className="text-xl font-semibold">Ingen admin-tilgang</h1>
					<p className="text-sm text-zinc-800">
						Du må være admin for å se denne siden. Hvis du mener dette er
							feil, ta kontakt med systemansvarlig.
					</p>
					<button
						type="button"
						onClick={() => router.push("/")}
						className="w-full rounded-xl border border-zinc-300 bg-white py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
					>
						Til innlogging
					</button>
				</div>
			</main>
		);
	}

	const title = user?.name ? `Admin – ${user.name}` : "Admin – bruker";
	const hasPinText = user?.hasPin
		? "Brukeren har en registrert pinkode."
		: "Brukeren mangler pinkode.";

	return (
		<AppShell
			title={title}
			subtitle="Administrer bruker, pinkode og tilganger"
			backHref="/admin"
			rightSlot={
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => router.push("/home")}
						className="rounded-xl border border-white/40 bg-white/10 px-3 py-1 text-xs font-medium text-white hover:bg-white/20"
					>
						Forside
					</button>
					<button
						type="button"
						onClick={handleLogout}
						className="rounded-xl border border-white/40 bg-white/10 px-3 py-1 text-xs font-medium text-white hover:bg-white/20"
					>
						Logg ut
					</button>
				</div>
			}
		>
			<div className="space-y-6">
				{msg && (
					<div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
						{msg}
					</div>
				)}

				<section className="space-y-3 rounded-2xl border bg-white p-4">
					<h2 className="text-lg font-semibold">Brukerinfo</h2>
					{user ? (
						<dl className="grid gap-2 text-sm text-zinc-900 sm:grid-cols-2">
							<div>
								<dt className="text-xs font-medium uppercase text-zinc-500">
									Navn
								</dt>
								<dd>{user.name || "(uten navn)"}</dd>
							</div>
							<div>
								<dt className="text-xs font-medium uppercase text-zinc-500">
									Telefon
								</dt>
								<dd>{user.phone || "–"}</dd>
							</div>
							<div>
								<dt className="text-xs font-medium uppercase text-zinc-500">
									Rolle
								</dt>
								<dd>{user.role}</dd>
							</div>
							<div>
								<dt className="text-xs font-medium uppercase text-zinc-500">
									Status
								</dt>
								<dd>{user.status}</dd>
							</div>
						</dl>
					) : (
						<p className="text-sm text-zinc-800">Fant ikke bruker.</p>
					)}
				</section>

				{user && (
					<section className="space-y-3 rounded-2xl border bg-white p-4">
						<h2 className="text-lg font-semibold">Pinkode</h2>
						<p className="text-sm text-zinc-800">{hasPinText}</p>

						<form onSubmit={handleChangePin} className="mt-2 space-y-3">
							<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
								<label className="flex-1 text-sm">
									<span className="mb-1 block text-xs font-medium uppercase text-zinc-500">
										Ny PIN (4 siffer)
									</span>
									<input
										type="text"
										inputMode="numeric"
										value={newPin}
										onChange={(e) => setNewPin(onlyDigits4(e.target.value))}
										className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm font-mono"
										placeholder="0000"
									/>
								</label>
								<button
									type="submit"
									disabled={busyChangePin || !newPin}
									className="rounded-xl border border-sky-200 bg-sky-900 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60"
								>
									{busyChangePin ? "Lagrer…" : "Lagre ny PIN"}
								</button>
							</div>
							<p className="text-xs text-zinc-800">
								Merk: Ved kollisjon/ugyldig PIN vises alltid samme melding (
									"Pinkode ikke godkjent – prøv en ny."
								) for å ikke lekke info.
							</p>
						</form>
					</section>
				)}

				{user && (
					<section className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-4">
						<h2 className="text-lg font-semibold text-red-800">Slett bruker</h2>
						<p className="text-sm text-red-900">
							Sletting av bruker er permanent og vil fjerne bruker, tilknyttede
							pinkoder og tilganger. Denne handlingen kan ikke angres.
						</p>
						<button
							type="button"
							onClick={handleDeleteUser}
							disabled={busyDelete}
							className="rounded-xl border border-red-300 bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
						>
							{busyDelete ? "Sletter…" : "Slett bruker"}
						</button>
					</section>
				)}
			</div>
		</AppShell>
	);
}
