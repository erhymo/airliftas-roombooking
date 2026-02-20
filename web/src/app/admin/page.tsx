"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
	import { onAuthStateChanged, signOut } from "firebase/auth";
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

import AppShell from "@/components/AppShell";
	import { firebaseAuth, firebaseDb } from "@/lib/firebaseClient";
import {
			fnApproveUser,
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

	const [msg, setMsg] = useState<string | null>(null);

		const [pending, setPending] = useState<PendingRequest[]>([]);
				const [users, setUsers] = useState<AdminUserRow[]>([]);

			const [refreshingPending, setRefreshingPending] = useState(false);
			const [refreshingUsers, setRefreshingUsers] = useState(false);

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

			// --------------- load users + PIN-status via function ---------------
				async function loadUsersWithPins() {
			setRefreshingUsers(true);
			setMsg(null);
				try {
					if (typeof window !== "undefined" && users.length === 0) {
						try {
							const cachedRaw = window.localStorage.getItem("admin_users_cache_v1");
							if (cachedRaw) {
								const cached = JSON.parse(cachedRaw) as AdminUserRow[];
								if (Array.isArray(cached) && cached.length > 0) {
									setUsers(cached);
								}
							}
						} catch {
							// Ignorer corrupt cache.
						}
					}
					const res = await fnAdminListUsersWithPins();
					setUsers(res.users);
					if (typeof window !== "undefined") {
						try {
							window.localStorage.setItem(
					"admin_users_cache_v1",
						JSON.stringify(res.users),
					);
					} catch {
						// Ignorer hvis localStorage ikke er tilgjengelig/full.
					}
					}
				} catch {
					setMsg(
						"Kunne ikke hente brukere/PIN-status. Sjekk at Functions er deployet og at du er admin.",
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
				} catch (error: unknown) {
					// Vis faktisk feilmelding fra backend der det er mulig (f.eks. PIN-kollisjon eller manglende admin).
					if (error instanceof Error && error.message) {
						// Firebase Functions-feil har ofte prefix som "functions/permission-denied: ".
						const cleaned = error.message.replace(/^.*?:\s*/, "");
						setMsg(cleaned || "Kunne ikke godkjenne forespørselen.");
					} else {
						setMsg("Kunne ikke godkjenne forespørselen. Sjekk admin-rettigheter.");
					}
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

	async function handleLogout() {
		await signOut(auth);
			router.push("/admin");
	}

				// --------------- UI ---------------
					if (loading) {
					return (
						<main className="min-h-screen bg-zinc-50 p-6 text-zinc-900">
							<div className="max-w-5xl mx-auto">Laster…</div>
						</main>
					);
				}
			
					if (!authUid) {
					return (
						<main className="min-h-screen bg-zinc-50 p-6 text-zinc-900">
							<div className="max-w-2xl mx-auto space-y-3">
								<h1 className="text-2xl font-semibold">Admin</h1>
								<p>Du må være innlogget med PIN for å bruke adminpanelet.</p>
								<button
									onClick={() => router.push("/")}
									className="rounded-xl border px-4 py-2"
								>
									Til forsiden
								</button>
							</div>
						</main>
					);
			}
	
					if (!isAdmin) {
				return (
					<main className="min-h-screen bg-zinc-50 p-6 text-zinc-900">
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
				<AppShell
					title="Adminpanel"
					subtitle="Godkjenn brukere og administrer pinkoder (uten å se selve PIN-kodene)"
					rightSlot={
						<div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
							<button
									onClick={() => router.push("/admin/bookings")}
									className="rounded-xl border px-4 py-2 text-sm font-medium bg-white/0 text-white hover:bg-white/10"
							>
								Administrer bookinger
							</button>
								<button
										onClick={() => router.push("/home")}
										className="rounded-xl border px-4 py-2 text-sm font-medium bg-white/0 text-white hover:bg-white/10"
									>
										Forside
									</button>
							<button
									onClick={handleLogout}
									className="rounded-xl border border-white/60 px-4 py-2 text-sm font-medium bg-white/0 text-white hover:bg-white/10"
							>
								Logg ut
							</button>
						</div>
					}
				>
					<div className="space-y-6">
						{msg && (
							<div className="rounded-xl border bg-white p-3 text-sm">{msg}</div>
						)}

						{/* Pending requests */}
						<section className="space-y-3 rounded-2xl border bg-white p-4">
							<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
											<th className="py-2 hidden sm:table-cell">Opprettet</th>
										<th className="py-2"></th>
									</tr>
								</thead>
								<tbody>
									{pending.map((r) => (
										<tr key={r.id} className="border-t">
											<td className="py-2">{r.name}</td>
											<td className="py-2">{r.phone}</td>
											<td className="py-2 hidden sm:table-cell">{fmtDate(r.createdAt)}</td>
										<td className="py-2 text-right">
									<button
										onClick={() => handleApprove(r.id)}
										disabled={busyApproveId === r.id || busyDeleteId === r.id}
										className="rounded-xl bg-sky-900 text-white px-3 py-2 text-sm hover:bg-sky-800"
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

					{/* Users */}
						<section className="space-y-3 rounded-2xl border bg-white p-4">
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<h2 className="text-lg font-semibold">Brukere</h2>
						<button
							onClick={loadUsersWithPins}
							disabled={refreshingUsers}
							className="rounded-xl border px-3 py-2 text-sm"
						>
							{refreshingUsers ? "Oppdaterer…" : "Refresh"}
						</button>
					</div>

							{users.length === 0 ? (
								<div className="text-sm text-zinc-800">
									{refreshingUsers ? "Laster brukere…" : "Ingen brukere funnet."}
								</div>
							) : (
						<div className="overflow-x-auto">
									<table className="w-full text-sm">
										<thead className="text-left text-zinc-800">
										<tr>
												<th className="py-2">Navn</th>
										</tr>
										</thead>
								<tbody>
									{users.map((u) => (
										<tr key={u.uid} className="border-t align-top">
										<td className="py-2">
											<button
													onClick={() => router.push(`/admin/users/${u.uid}`)}
													className="w-full text-left text-sm font-medium text-zinc-900 hover:underline"
											>
												{u.name || "(uten navn)"}
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
			</AppShell>
		);
}

