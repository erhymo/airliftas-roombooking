"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
	onAuthStateChanged,
	signOut,
	signInWithEmailAndPassword,
	setPersistence,
	browserLocalPersistence,
} from "firebase/auth";
import {
		collection,
		getDocs,
		orderBy,
		query,
		where,
		Timestamp,
		deleteDoc,
		doc,
	} from "firebase/firestore";

import { firebaseAuth, firebaseDb } from "@/lib/firebaseClient";
import { markSessionStart } from "@/lib/session";
import {
		fnApproveUser,
		fnAdminChangePin,
			fnAdminListUsersWithPins,
			type AdminUserWithPin,
	} from "@/lib/functions";

const HARD_CODED_ADMIN_EMAIL = "oyvind.myhre@airlift.no";

	type PendingRequest = {
	id: string;
	name: string;
	phone: string;
	createdAt?: Date | null;
};

	type AdminUserRow = AdminUserWithPin;

	type UserDoc = {
		name?: string;
		phone?: string;
		role?: "user" | "admin" | (string & {});
		status?: string;
	};

	type PendingRequestDoc = {
		name?: string;
		phone?: string;
		createdAt?: Timestamp | null;
	};

function onlyDigits4(v: string) {
	return v.replace(/\D/g, "").slice(0, 4);
}

function fmtDate(d?: Date | null) {
	if (!d) return "";
	return new Intl.DateTimeFormat("nb-NO", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	}).format(d);
}

export default function AdminPage() {
	const router = useRouter();
	const auth = useMemo(() => firebaseAuth(), []);
	const db = useMemo(() => firebaseDb(), []);

	const [loading, setLoading] = useState(true);
	const [authUid, setAuthUid] = useState<string | null>(null);
		const [isAdmin, setIsAdmin] = useState(false);
	const [adminLoginEmail, setAdminLoginEmail] = useState("");
	const [adminLoginPassword, setAdminLoginPassword] = useState("");
	const [adminLoginError, setAdminLoginError] = useState<string | null>(null);

	const [msg, setMsg] = useState<string | null>(null);

		const [pending, setPending] = useState<PendingRequest[]>([]);
			const [users, setUsers] = useState<AdminUserRow[]>([]);

		const [refreshingPending, setRefreshingPending] = useState(false);
		const [refreshingUsers, setRefreshingUsers] = useState(false);

		const [pinEdits, setPinEdits] = useState<Record<string, string>>({}); // uid -> newPin
		const [busyPinUid, setBusyPinUid] = useState<string | null>(null);
		const [busyApproveId, setBusyApproveId] = useState<string | null>(null);
		const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);

			// --------------- auth gate + admin check ---------------
		// TODO (manuelt steg i Firebase Console/Firestore):
		// Sørg for at minst én bruker har et dokument users/{uid} med
		//   { role: "admin", status: "active" }
		// ellers vil ingen komme forbi denne sjekken.
			useEffect(() => {
				const unsub = onAuthStateChanged(auth, async (u) => {
					setAuthUid(u?.uid ?? null);

					if (!u?.uid) {
						setIsAdmin(false);
						setLoading(false);
						return;
					}

					// Hardkodet admin: e-post gir umiddelbart admin-tilgang.
					if (u.email === HARD_CODED_ADMIN_EMAIL) {
						setIsAdmin(true);
						setLoading(false);
						await refreshAll();
						return;
					}

					// Ellers: sjekk rolle i users/{uid}.
					try {
						const meSnap = await getDocs(
							query(collection(db, "users"), where("__name__", "==", u.uid)),
						);

						const me = meSnap.docs[0]?.data() as UserDoc | undefined;
						const ok = me?.status === "active" && me?.role === "admin";
						setIsAdmin(!!ok);

						setLoading(false);

						if (ok) {
							await refreshAll();
						}
					} catch {
						setIsAdmin(false);
						setLoading(false);
					}
				});

				return () => unsub();
				// eslint-disable-next-line react-hooks/exhaustive-deps
			}, []);

			// --------------- forsøk å bootstrap admin via backend hvis e-post er hardkodet admin ---------------
			useEffect(() => {
				if (!authUid || isAdmin) return;

				let cancelled = false;

				(async () => {
					try {
						// Vil lykkes bare dersom backend (requireAdmin) anser brukeren som admin.
						await fnAdminListUsersWithPins();
						if (!cancelled) {
							setIsAdmin(true);
							setLoading(false);
							await refreshAll();
						}
					} catch {
						// Ikke admin – la isAdmin forbli false.
					}
				})();

				return () => {
					cancelled = true;
				};
			}, [authUid, isAdmin]);

			// --------------- admin-innlogging (e-post/passord via Firebase Auth) ---------------
			async function handleLocalAdminLogin(e: FormEvent) {
				e.preventDefault();
				setAdminLoginError(null);

				const email = adminLoginEmail.trim();
				const password = adminLoginPassword;
				if (!email || !password) {
					setAdminLoginError("Fyll inn både e-post og passord.");
					return;
				}

				try {
					// Sørg for at session overlever refresh / nye faner, lik PIN-innloggingen.
					await setPersistence(auth, browserLocalPersistence);
					await signInWithEmailAndPassword(auth, email, password);
					setAdminLoginPassword("");
					// Marker fresh session slik at /admin/bookings ikke kaster deg ut pga. isSessionExpired().
					markSessionStart();
				} catch (err: unknown) {
					// Ikke lekke tekniske feilmeldinger til sluttbruker.
					setAdminLoginError("Feil brukernavn eller passord.");
				}
			}

	async function refreshAll() {
		await Promise.all([loadPending(), loadUsersWithPins()]);
	}

	// --------------- load pending requests ---------------
		async function loadPending() {
		setRefreshingPending(true);
		setMsg(null);
			try {
				// Kun filter på status for å unngå behov for egen Firestore-indeks.
				const q = query(
					collection(db, "userRequests"),
					where("status", "==", "pending"),
				);
				const snap = await getDocs(q);

				const rows: PendingRequest[] = snap.docs.map((d) => {
					const data = d.data() as PendingRequestDoc;
				const createdAt: Date | null =
					data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null;

				return {
					id: d.id,
					name: data.name ?? "",
					phone: data.phone ?? "",
					createdAt,
				};
			});

				setPending(rows);
			} catch {
			setMsg("Kunne ikke hente ventende forespørsler. Sjekk at du er admin.");
		} finally {
			setRefreshingPending(false);
		}
	}

	// --------------- load users + decrypted pins via function ---------------
		async function loadUsersWithPins() {
		setRefreshingUsers(true);
		setMsg(null);
			try {
				const res = await fnAdminListUsersWithPins();
				setUsers(res.users);
			} catch {
			setMsg(
				"Kunne ikke hente brukere/PIN. Sjekk at Functions er deployet og at du er admin.",
			);
		} finally {
			setRefreshingUsers(false);
		}
	}

	// --------------- actions ---------------
		async function handleApprove(requestId: string) {
			setMsg(null);
			setBusyApproveId(requestId);
			try {
				await fnApproveUser(requestId);
				setMsg("Bruker godkjent.");
				await loadPending();
				// Brukerlista endres (ny user), så refresh den også:
				await loadUsersWithPins();
			} catch {
				setMsg("Kunne ikke godkjenne. Sjekk admin-rettigheter.");
			} finally {
				setBusyApproveId(null);
			}
		}

		async function handleDeleteRequest(requestId: string) {
			setMsg(null);
			setBusyDeleteId(requestId);
			try {
				await deleteDoc(doc(db, "userRequests", requestId));
				setMsg("Forespørsel slettet.");
				await loadPending();
			} catch {
				setMsg("Kunne ikke slette forespørsel. Sjekk admin-rettigheter.");
			} finally {
				setBusyDeleteId(null);
			}
		}

	async function handleChangePin(uid: string) {
		setMsg(null);
		const newPin = onlyDigits4(pinEdits[uid] || "");
		if (newPin.length !== 4) {
			setMsg("PIN må være 4 siffer.");
			return;
		}

		setBusyPinUid(uid);
		try {
			await fnAdminChangePin(uid, newPin);
			setMsg("PIN oppdatert.");
			setPinEdits((prev) => ({ ...prev, [uid]: "" }));
			await loadUsersWithPins();
		} catch {
			// Viktig: ikke lekke info om kollisjon
			setMsg("Pinkode ikke godkjent – prøv en ny.");
		} finally {
			setBusyPinUid(null);
		}
	}

	async function handleLogout() {
		await signOut(auth);
			router.push("/admin");
	}

			// --------------- UI ---------------
			if (loading) {
			return (
				<main className="min-h-screen p-6">
					<div className="max-w-5xl mx-auto">Laster…</div>
				</main>
			);
		}
	
				if (!authUid) {
				return (
					<main className="min-h-screen p-6 text-zinc-900">
						<div className="max-w-md mx-auto space-y-4">
							<h1 className="text-2xl font-semibold">Admin</h1>
							<p className="text-sm leading-relaxed">
								Logg inn som admin med brukernavn og passord.
							</p>

						{adminLoginError && (
							<div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
								{adminLoginError}
							</div>
						)}

						<form className="space-y-3" onSubmit={handleLocalAdminLogin}>
							<div className="space-y-1">
								<label className="text-sm font-medium">Brukernavn (e-post)</label>
								<input
									type="email"
									value={adminLoginEmail}
									onChange={(e) => setAdminLoginEmail(e.target.value)}
									className="w-full rounded-xl border px-3 py-2 text-sm"
								/>
							</div>
							<div className="space-y-1">
								<label className="text-sm font-medium">Passord</label>
								<input
									type="password"
									value={adminLoginPassword}
									onChange={(e) => setAdminLoginPassword(e.target.value)}
									className="w-full rounded-xl border px-3 py-2 text-sm"
								/>
							</div>
							<button
								type="submit"
								className="w-full rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
							>
								Logg inn
							</button>
						</form>

							<p className="text-xs text-zinc-900">
							Alternativt kan du logge inn med PIN via forsiden.
						</p>
					</div>
				</main>
			);
		}
	
			if (!isAdmin) {
		return (
			<main className="min-h-screen p-6 text-zinc-900">
				<div className="max-w-2xl mx-auto space-y-3">
					<h1 className="text-2xl font-semibold">Admin</h1>
					<p>Du har ikke admin-tilgang.</p>
					<div className="flex gap-2">
						<button
							onClick={() => router.push("/")}
							className="rounded-xl border px-4 py-2"
						>
							Til forsiden
						</button>
						<button
							onClick={handleLogout}
							className="rounded-xl border px-4 py-2"
						>
							Logg ut
						</button>
					</div>
				</div>
			</main>
		);
	}

		return (
			<main className="min-h-screen p-6">
				<div className="max-w-6xl mx-auto space-y-6">
					<header className="flex items-center justify-between gap-4">
						<div>
							<h1 className="text-2xl font-semibold">Adminpanel</h1>
							<p className="text-sm leading-relaxed">
								Godkjenn brukere, se/endre pinkoder
							</p>
						</div>

						<div className="flex gap-2">
							<button
								onClick={() => router.push("/admin/bookings")}
								className="rounded-xl border px-4 py-2"
							>
								Administrer bookinger
							</button>
						<button
							onClick={() => router.push("/")}
							className="rounded-xl border px-4 py-2"
						>
							Forside
						</button>
						<button
							onClick={handleLogout}
							className="rounded-xl border px-4 py-2"
						>
							Logg ut
						</button>
					</div>
				</header>

				{msg && <div className="rounded-xl border p-3 text-sm">{msg}</div>}

				{/* Pending requests */}
						<section className="rounded-2xl border p-4 space-y-3">
							<div className="flex items-center justify-between gap-3">
								<h2 className="text-lg font-semibold">Ventende forespørsler</h2>
						<button
							onClick={loadPending}
							disabled={refreshingPending}
							className="rounded-xl border px-3 py-2 text-sm"
						>
							{refreshingPending ? "Oppdaterer…" : "Refresh"}
						</button>
					</div>

							{pending.length === 0 ? (
								<div className="text-sm text-zinc-800">
							Ingen ventende forespørsler.
						</div>
					) : (
						<div className="overflow-x-auto">
									<table className="w-full text-sm">
										<thead className="text-left text-zinc-800">
									<tr>
										<th className="py-2">Navn</th>
										<th className="py-2">Telefon</th>
										<th className="py-2">Opprettet</th>
										<th className="py-2"></th>
									</tr>
								</thead>
								<tbody>
									{pending.map((r) => (
										<tr key={r.id} className="border-t">
											<td className="py-2">{r.name}</td>
											<td className="py-2">{r.phone}</td>
											<td className="py-2">{fmtDate(r.createdAt)}</td>
								<td className="py-2 text-right space-x-2">
									<button
										onClick={() => handleApprove(r.id)}
										disabled={busyApproveId === r.id || busyDeleteId === r.id}
										className="rounded-xl bg-black text-white px-3 py-2 text-sm"
									>
										{busyApproveId === r.id
													? "Godkjenner…"
													: "Godkjenn"}
									</button>
									<button
										onClick={() => handleDeleteRequest(r.id)}
										disabled={busyDeleteId === r.id || busyApproveId === r.id}
										className="rounded-xl border border-red-300 px-3 py-2 text-sm text-red-700"
									>
										{busyDeleteId === r.id ? "Sletter…" : "Slett"}
									</button>
								</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</section>

				{/* Users + pins */}
						<section className="rounded-2xl border p-4 space-y-3">
					<div className="flex items-center justify-between gap-3">
						<h2 className="text-lg font-semibold">Brukere og pinkoder</h2>
						<button
							onClick={loadUsersWithPins}
							disabled={refreshingUsers}
							className="rounded-xl border px-3 py-2 text-sm"
						>
							{refreshingUsers ? "Oppdaterer…" : "Refresh"}
						</button>
					</div>

							{users.length === 0 ? (
								<div className="text-sm text-zinc-800">Ingen brukere funnet.</div>
					) : (
						<div className="overflow-x-auto">
									<table className="w-full text-sm">
										<thead className="text-left text-zinc-800">
									<tr>
										<th className="py-2">Navn</th>
										<th className="py-2">Telefon</th>
										<th className="py-2">Rolle</th>
										<th className="py-2">Status</th>
										<th className="py-2">PIN</th>
										<th className="py-2">Ny PIN</th>
										<th className="py-2"></th>
									</tr>
								</thead>
								<tbody>
									{users.map((u) => (
										<tr key={u.uid} className="border-t align-top">
											<td className="py-2">{u.name}</td>
											<td className="py-2">{u.phone}</td>
											<td className="py-2">{u.role}</td>
											<td className="py-2">{u.status}</td>
											<td className="py-2 font-mono">{u.pin ?? "—"}</td>
											<td className="py-2">
												<input
													inputMode="numeric"
													value={pinEdits[u.uid] ?? ""}
													onChange={(e) =>
														setPinEdits((prev) => ({
															...prev,
															[u.uid]: onlyDigits4(e.target.value),
														}))
													}
													className="w-28 rounded-xl border p-2 font-mono"
													placeholder="0000"
												/>
											</td>
											<td className="py-2 text-right">
												<button
													onClick={() => handleChangePin(u.uid)}
													disabled={busyPinUid === u.uid}
													className="rounded-xl border px-3 py-2 text-sm"
												>
													{busyPinUid === u.uid ? "Lagrer…" : "Endre"}
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>

									<div className="text-xs text-zinc-800 mt-3">
								Merk: Ved kollisjon/ugyldig PIN vises alltid samme melding (
									“Pinkode ikke godkjent – prøv en ny.”
								) for å ikke lekke info.
							</div>
						</div>
					)}
				</section>
			</div>
		</main>
	);
}

