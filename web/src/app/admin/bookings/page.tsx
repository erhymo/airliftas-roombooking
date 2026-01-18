"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
	collection,
	deleteDoc,
	doc,
	getDocs,
	orderBy,
	query,
	serverTimestamp,
	Timestamp,
	updateDoc,
	where,
} from "firebase/firestore";

import { firebaseAuth, firebaseDb } from "@/lib/firebaseClient";
import { isSessionExpired } from "@/lib/session";

type UserDoc = {
	name?: string;
	phone?: string;
	role?: "user" | "admin" | (string & {});
	status?: string;
};

type BookingDoc = {
	baseId?: string;
	roomId?: string;
	roomName?: string;
	name?: string;
	from?: Timestamp | null;
	to?: Timestamp | null;
	createdByUid?: string;
	createdByName?: string;
};

type BookingRow = {
	id: string;
	baseId: string;
	roomId: string;
	roomName: string;
	name: string;
	from: Date;
	to: Date;
	createdByUid: string;
	createdByName: string;
};

function fmt(d: Date) {
	return new Intl.DateTimeFormat("nb-NO", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	}).format(d);
}

function formatDateInput(d: Date): string {
	return d.toISOString().slice(0, 10);
}

function formatTimeInput(d: Date): string {
	return d.toISOString().slice(11, 16);
}

function combineDateTime(dateStr: string, timeStr: string): Date | null {
	if (!dateStr) return null;
	const [yearStr, monthStr, dayStr] = dateStr.split("-");
	const [hourStr, minuteStr] = (timeStr || "").split(":");
	const year = Number(yearStr);
	const month = Number(monthStr);
	const day = Number(dayStr);
	const hour = Number(hourStr || "0");
	const minute = Number(minuteStr || "0");
	if (!year || !month || !day) return null;
	const d = new Date();
	d.setFullYear(year, month - 1, day);
	d.setHours(hour, minute, 0, 0);
	return d;
}

export default function AdminBookingsPage() {
	const router = useRouter();
	const auth = useMemo(() => firebaseAuth(), []);
	const db = useMemo(() => firebaseDb(), []);

	const [loading, setLoading] = useState(true);
	const [authUid, setAuthUid] = useState<string | null>(null);
	const [isAdmin, setIsAdmin] = useState(false);
	const [msg, setMsg] = useState<string | null>(null);

	const [bookings, setBookings] = useState<BookingRow[]>([]);
	const [refreshing, setRefreshing] = useState(false);

	const [editId, setEditId] = useState<string | null>(null);
	const [editName, setEditName] = useState("");
	const [editFromDate, setEditFromDate] = useState("");
	const [editFromTime, setEditFromTime] = useState("");
	const [editToDate, setEditToDate] = useState("");
	const [editToTime, setEditToTime] = useState("");

	// --------------- auth gate + admin check ---------------
	useEffect(() => {
		const unsub = onAuthStateChanged(auth, async (u) => {
			if (!u?.uid || isSessionExpired()) {
				setAuthUid(null);
				setIsAdmin(false);
				setLoading(false);
				router.replace("/");
				return;
			}

			setAuthUid(u.uid);

			try {
				const meSnap = await getDocs(
					query(collection(db, "users"), where("__name__", "==", u.uid)),
				);
				const me = meSnap.docs[0]?.data() as UserDoc | undefined;
				const ok = me?.status === "active" && me?.role === "admin";
				setIsAdmin(!!ok);
				setLoading(false);

				if (ok) {
					await loadBookings();
				}
			} catch {
				setIsAdmin(false);
				setLoading(false);
			}
		});

		return () => unsub();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	async function loadBookings() {
		setRefreshing(true);
		setMsg(null);
		try {
			const q = query(
				collection(db, "bookings"),
				where("baseId", "==", "bergen"),
				orderBy("from", "asc"),
			);
			const snap = await getDocs(q);
			const rows: BookingRow[] = snap.docs
				.map((d) => {
					const data = d.data() as BookingDoc;
					const from =
						data.from instanceof Timestamp ? data.from.toDate() : null;
					const to = data.to instanceof Timestamp ? data.to.toDate() : null;
					if (!from || !to) return null;
					return {
						id: d.id,
						baseId: data.baseId ?? "",
						roomId: String(data.roomId ?? ""),
						roomName: String(data.roomName ?? ""),
						name: String(data.name ?? ""),
						from,
						to,
						createdByUid: String(data.createdByUid ?? ""),
						createdByName: String(data.createdByName ?? ""),
					};
				})
				.filter((b): b is BookingRow => b !== null)
				.sort((a, b) => a.from.getTime() - b.from.getTime());
			setBookings(rows);
		} catch {
			setMsg("Kunne ikke hente bookinger (sjekk Firestore Rules/indeks).");
		} finally {
			setRefreshing(false);
		}
	}

	function openEdit(b: BookingRow) {
		setMsg(null);
		setEditId(b.id);
		setEditName(b.name);
		setEditFromDate(formatDateInput(b.from));
		setEditFromTime(formatTimeInput(b.from));
		setEditToDate(formatDateInput(b.to));
		setEditToTime(formatTimeInput(b.to));
	}

	function closeEdit() {
		setEditId(null);
		setEditName("");
		setEditFromDate("");
		setEditFromTime("");
		setEditToDate("");
		setEditToTime("");
	}

	async function saveEdit() {
		if (!editId) return;
		setMsg(null);
		const from = combineDateTime(editFromDate, editFromTime || "00:00");
		const to = combineDateTime(editToDate, editToTime || "00:00");
		if (!from || !to || to <= from) {
			setMsg("Til må være etter fra.");
			return;
		}

		try {
			await updateDoc(doc(db, "bookings", editId), {
				name: editName,
				from: Timestamp.fromDate(from),
				to: Timestamp.fromDate(to),
				updatedAt: serverTimestamp(),
			});
			setMsg("Booking oppdatert.");
			closeEdit();
			await loadBookings();
		} catch {
			setMsg("Kunne ikke oppdatere booking.");
		}
	}

	async function deleteBooking(id: string) {
		setMsg(null);
		try {
			await deleteDoc(doc(db, "bookings", id));
			setMsg("Booking slettet.");
			if (editId === id) {
				closeEdit();
			}
			await loadBookings();
		} catch {
			setMsg("Kunne ikke slette booking.");
		}
	}

	async function handleLogout() {
		await signOut(auth);
		router.push("/");
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
			<main className="min-h-screen p-6">
				<div className="max-w-2xl mx-auto space-y-3">
					<h1 className="text-2xl font-semibold">Admin – bookinger</h1>
					<p>Du må være innlogget for å se booking-admin.</p>
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
			<main className="min-h-screen p-6">
				<div className="max-w-2xl mx-auto space-y-3">
					<h1 className="text-2xl font-semibold">Admin – bookinger</h1>
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
				<div className="max-w-5xl mx-auto space-y-6">
					<header className="flex items-center justify-between gap-4">
						<div>
							<h1 className="text-2xl font-semibold">Administrer bookinger</h1>
							<p className="text-sm text-zinc-800">
								Alle bookinger for Bergen-basen (kun admin).
							</p>
						</div>

					<div className="flex gap-2">
						<button
							onClick={() => router.push("/admin")}
							className="rounded-xl border px-4 py-2"
						>
							Til adminpanel
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

						<section className="rounded-2xl border p-4 space-y-3">
					<div className="flex items-center justify-between gap-3">
						<h2 className="text-lg font-semibold">Bookinger – Bergen</h2>
						<button
							onClick={loadBookings}
							disabled={refreshing}
							className="rounded-xl border px-3 py-2 text-sm"
						>
							{refreshing ? "Oppdaterer…" : "Refresh"}
						</button>
					</div>

							{bookings.length === 0 ? (
								<div className="text-sm text-zinc-800">Ingen bookinger funnet.</div>
					) : (
						<div className="overflow-x-auto">
									<table className="w-full text-sm">
										<thead className="text-left text-zinc-800">
									<tr>
										<th className="py-2">Rom</th>
										<th className="py-2">Navn</th>
										<th className="py-2">Fra</th>
										<th className="py-2">Til</th>
										<th className="py-2">Opprettet av</th>
										<th className="py-2"></th>
									</tr>
								</thead>
								<tbody>
									{bookings.map((b) => (
										<tr key={b.id} className="border-t align-top">
											<td className="py-2">{b.roomName}</td>
											<td className="py-2">{b.name}</td>
											<td className="py-2">{fmt(b.from)}</td>
											<td className="py-2">{fmt(b.to)}</td>
										<td className="py-2">
											<div className="text-xs text-zinc-800">
												<div>{b.createdByName || "—"}</div>
												<div className="text-zinc-700">{b.createdByUid}</div>
											</div>
											</td>
											<td className="py-2 text-right">
												<button
													onClick={() => openEdit(b)}
													className="rounded-xl border px-3 py-2 text-sm"
												>
													Endre
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</section>

						{editId && (
					<div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center p-4 z-50">
						<div className="w-full max-w-lg rounded-2xl bg-white p-4 space-y-3">
							<div className="flex items-start justify-between">
								<div>
									<div className="text-lg font-semibold">
										Rediger booking
									</div>
									<div className="text-sm text-zinc-800">
										Endre navn og tidsrom. Overlapp-sjekk gjør du manuelt.
									</div>
								</div>
								<button
									onClick={closeEdit}
									className="rounded-xl border px-3 py-2 text-sm"
								>
									Lukk
								</button>
							</div>

							<label className="block text-sm">
								Navn
								<input
									value={editName}
									onChange={(e) => setEditName(e.target.value)}
									className="mt-1 w-full rounded-xl border p-3"
								/>
							</label>

							<div className="grid grid-cols-2 gap-2">
								<label className="block text-sm">
									Fra dato
									<input
										type="date"
										value={editFromDate}
										onChange={(e) => setEditFromDate(e.target.value)}
										className="mt-1 w-full rounded-xl border p-3"
									/>
								</label>
								<label className="block text-sm">
									Til dato
									<input
										type="date"
										value={editToDate}
										onChange={(e) => setEditToDate(e.target.value)}
										className="mt-1 w-full rounded-xl border p-3"
									/>
								</label>
							</div>

							<div className="grid grid-cols-2 gap-2">
								<label className="block text-sm">
									Fra tid
									<input
										type="time"
										value={editFromTime}
										onChange={(e) => setEditFromTime(e.target.value)}
										className="mt-1 w-full rounded-xl border p-3"
									/>
								</label>
								<label className="block text-sm">
									Til tid
									<input
										type="time"
										value={editToTime}
										onChange={(e) => setEditToTime(e.target.value)}
										className="mt-1 w-full rounded-xl border p-3"
									/>
								</label>
							</div>

							<div className="flex gap-2">
								<button
									onClick={saveEdit}
									className="flex-1 rounded-xl bg-black text-white py-3 font-medium"
								>
									Lagre endringer
								</button>
								<button
									onClick={() => editId && deleteBooking(editId)}
									className="flex-1 rounded-xl border py-3 font-medium"
								>
									Slett booking
								</button>
							</div>

							{msg && (
								<div className="rounded-xl border p-3 text-sm">{msg}</div>
							)}
						</div>
					</div>
				)}
			</div>
		</main>
	);
}
