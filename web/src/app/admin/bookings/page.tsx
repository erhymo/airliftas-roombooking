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

	type BaseId = "bergen" | "bringeland" | "kinsarvik";

	const BASE_LABELS: Record<BaseId, string> = {
		bergen: "Bergen",
		bringeland: "Bringeland",
		kinsarvik: "Kinsarvik",
	};

	const BASE_ROOMS: Record<BaseId, { id: string; label: string }[]> = {
		bergen: [
			{ id: "R1", label: "Rom 1" },
			{ id: "R2", label: "Rom 2" },
			{ id: "R3", label: "Rom 3" },
			{ id: "R4", label: "Rom 4" },
			{ id: "R5", label: "Rom 5" },
			{ id: "R6", label: "Rom 6" },
		],
		bringeland: [
			{ id: "R1", label: "Rom 1" },
			{ id: "R2", label: "Rom 2" },
			{ id: "R3", label: "Rom 3" },
			{ id: "R4", label: "Rom 4" },
			{ id: "R5", label: "Rom 5" },
			{ id: "R6", label: "Rom 6" },
			{ id: "R7", label: "Rom 7" },
			{ id: "R8", label: "Rom 8" },
			{ id: "R9", label: "Rom 9" },
			{ id: "R10", label: "Rom 10" },
			{ id: "R11", label: "Rom 11" },
			{ id: "R12", label: "Rom 12" },
		],
		kinsarvik: [
			{ id: "R1", label: "Rom 1" },
			{ id: "R2", label: "Rom 2" },
			{ id: "R3", label: "Rom 3" },
			{ id: "R4", label: "Rom 4" },
			{ id: "R5", label: "Rom 5" },
			{ id: "R6", label: "Rom 6" },
		],
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

	function startOfTodayLocal() {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d;
	}

	function addDays(d: Date, days: number) {
		const x = new Date(d);
		x.setDate(x.getDate() + days);
		return x;
	}

	function startOfWeekMonday(d: Date) {
		const x = new Date(d);
		x.setHours(0, 0, 0, 0);
		const day = x.getDay(); // 0 = søndag, 1 = mandag, ...
		const diff = (day + 6) % 7; // antall dager tilbake til mandag
		return addDays(x, -diff);
	}

	function formatWeekdayShort(d: Date) {
		return new Intl.DateTimeFormat("nb-NO", { weekday: "short" })
			.format(d)
			.replace(".", "");
	}

	function getIsoWeek(date: Date): number {
		const d = new Date(
			Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
		);
		const dayNum = d.getUTCDay() || 7;
		// Sett dato til torsdag i denne uken
		d.setUTCDate(d.getUTCDate() + 4 - dayNum);
		const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
		const weekNo = Math.ceil(
			((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
		);
		return weekNo;
	}

	function overlaps(aFrom: Date, aTo: Date, bFrom: Date, bTo: Date) {
		return aFrom < bTo && aTo > bFrom;
	}

export default function AdminBookingsPage() {
	const router = useRouter();
	const auth = useMemo(() => firebaseAuth(), []);
	const db = useMemo(() => firebaseDb(), []);

	const [loading, setLoading] = useState(true);
	const [authUid, setAuthUid] = useState<string | null>(null);
	const [isAdmin, setIsAdmin] = useState(false);
	const [msg, setMsg] = useState<string | null>(null);

		const [selectedBase, setSelectedBase] = useState<BaseId>("bergen");
		const [bookings, setBookings] = useState<BookingRow[]>([]);
	const [refreshing, setRefreshing] = useState(false);

	const [editId, setEditId] = useState<string | null>(null);
	const [editName, setEditName] = useState("");
	const [editFromDate, setEditFromDate] = useState("");
	const [editFromTime, setEditFromTime] = useState("");
	const [editToDate, setEditToDate] = useState("");
	const [editToTime, setEditToTime] = useState("");

		const [cellRoomId, setCellRoomId] = useState<string | null>(null);
		const [cellDate, setCellDate] = useState<Date | null>(null);

		const [calendarStart, setCalendarStart] = useState<Date>(() =>
			startOfWeekMonday(startOfTodayLocal()),
		);
		const calendarDays = useMemo(
			() => Array.from({ length: 14 }, (_, idx) => addDays(calendarStart, idx)),
			[calendarStart],
		);

		const today = startOfTodayLocal();
		const firstWeekNumber =
			calendarDays.length > 0 ? getIsoWeek(calendarDays[0]) : null;
		const secondWeekNumber =
			calendarDays.length > 7 ? getIsoWeek(calendarDays[7]) : null;
		const weekLabel =
			firstWeekNumber !== null
				? secondWeekNumber !== null && secondWeekNumber !== firstWeekNumber
						? `Uke ${firstWeekNumber}-${secondWeekNumber}`
						: `Uke ${firstWeekNumber}`
				: "";

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
			} catch {
				setIsAdmin(false);
				setLoading(false);
			}
		});

		return () => unsub();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

		useEffect(() => {
			if (!authUid || !isAdmin) return;
			void loadBookings(selectedBase);
		}, [authUid, isAdmin, selectedBase]);
	
		async function loadBookings(base: BaseId) {
		setRefreshing(true);
		setMsg(null);
		try {
			const q = query(
				collection(db, "bookings"),
					where("baseId", "==", base),
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
				await loadBookings(selectedBase);
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
				await loadBookings(selectedBase);
		} catch {
			setMsg("Kunne ikke slette booking.");
		}
	}

	async function handleLogout() {
		await signOut(auth);
			router.push("/admin");
	}

		const cellBookings = useMemo(() => {
			if (!cellRoomId || !cellDate) return [] as BookingRow[];
			const dayStart = new Date(cellDate);
			dayStart.setHours(0, 0, 0, 0);
			const dayEnd = addDays(dayStart, 1);
			return bookings.filter(
				(b) =>
					b.roomId === cellRoomId && overlaps(b.from, b.to, dayStart, dayEnd),
			);
		}, [bookings, cellRoomId, cellDate]);

		function closeCellModal() {
			setCellRoomId(null);
			setCellDate(null);
		}

		const rooms = BASE_ROOMS[selectedBase] ?? [];
		const periodLabel =
			calendarDays.length > 0
				? `${calendarDays[0].toLocaleDateString("nb-NO")} – ${calendarDays[
						calendarDays.length - 1
				  ].toLocaleDateString("nb-NO")}`
				: "";

		function isRoomOccupiedOnDate(roomId: string, day: Date) {
			const dayStart = new Date(day);
			dayStart.setHours(0, 0, 0, 0);
			const dayEnd = addDays(dayStart, 1);
			return bookings.some(
				(b) =>
					b.roomId === roomId && overlaps(b.from, b.to, dayStart, dayEnd),
			);
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
									Alle bookinger for {BASE_LABELS[selectedBase]}-basen (kun admin).
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

						<section className="rounded-2xl border p-4 space-y-4">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div>
									<h2 className="text-lg font-semibold">Kalender (2 uker)</h2>
									<p className="text-xs text-zinc-700">
										{BASE_LABELS[selectedBase]}  {periodLabel}
									</p>
									{weekLabel && (
										<p className="text-[11px] text-zinc-500">{weekLabel}</p>
									)}
								</div>
								<div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
									<div className="inline-flex rounded-full border bg-zinc-50 p-1 text-xs">
										{(Object.keys(BASE_LABELS) as BaseId[]).map((base) => (
											<button
												key={base}
												onClick={() => setSelectedBase(base)}
												className={`px-3 py-1 rounded-full ${
													selectedBase === base
														? "bg-black text-white"
														: "text-zinc-800"
												}`}
											>
												{BASE_LABELS[base]}
											</button>
										))}
									</div>
									<div className="inline-flex justify-end gap-1 text-xs">
										<button
											className="rounded-full border px-2 py-1"
											onClick={() =>
												setCalendarStart((prev) => addDays(prev, -14))
											}
										>
											14 d
										</button>
										<button
											className="rounded-full border px-2 py-1"
											onClick={() =>
												setCalendarStart(startOfWeekMonday(startOfTodayLocal()))
											}
										>
											I dag
										</button>
										<button
											className="rounded-full border px-2 py-1"
											onClick={() =>
												setCalendarStart((prev) => addDays(prev, 14))
											}
										>
											+14 d
										</button>
									</div>
								</div>
							</div>

							<div className="relative overflow-auto rounded-lg border">
								<table className="min-w-full border-collapse text-xs">
									<thead>
										<tr>
											<th className="sticky left-0 top-0 z-20 bg-zinc-50 px-2 py-2 text-left text-xs font-medium text-zinc-800">
												Rom
											</th>
											{calendarDays.map((day) => {
												const isToday = day.getTime() === today.getTime();
												return (
													<th
														key={day.toISOString()}
														className={`sticky top-0 z-10 bg-zinc-50 px-2 py-2 text-center text-[11px] font-medium text-zinc-800${
															isToday ? " ring-2 ring-blue-500" : ""
														}`}
													>
														<div>{formatWeekdayShort(day)}</div>
														<div>{day.getDate()}</div>
													</th>
												);
											})}
										</tr>
									</thead>
									<tbody>
										{rooms.map((room) => (
											<tr key={room.id} className="border-t">
												<td className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1 text-sm font-medium text-zinc-900">
													{room.label}
												</td>
												{calendarDays.map((day) => {
													const occupied = isRoomOccupiedOnDate(room.id, day);
													return (
														<td
															key={`${room.id}-${day.toISOString()}`}
															className="px-1 py-1 text-center cursor-pointer"
															onClick={() => {
																setCellRoomId(room.id);
																setCellDate(day);
															}}
														>
															<div
																className={`mx-auto h-5 w-5 rounded-full ${
																	occupied ? "bg-red-300" : "bg-emerald-300"
																}`}
																title={`${room.label} – ${formatWeekdayShort(day)} ${day.toLocaleDateString(
																	"nb-NO",
																)}`}
															/>
														</td>
													);
												})}
											</tr>
										))}
									</tbody>
								</table>
							</div>
							<p className="text-xs text-zinc-700">
								Grønn = ingen booking dette døgnet. Rød = minst én booking som overlapper døgnet.
							</p>
						</section>

						<section className="rounded-2xl border p-4 space-y-3">
					<div className="flex items-center justify-between gap-3">
								<h2 className="text-lg font-semibold">
									Bookinger – {BASE_LABELS[selectedBase]}
								</h2>
						<button
									onClick={() => loadBookings(selectedBase)}
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

						{cellRoomId && cellDate && (
							<div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center p-4 z-50">
								<div className="w-full max-w-lg rounded-2xl bg-white p-4 space-y-3">
									<div className="flex items-start justify-between">
										<div>
											<div className="text-lg font-semibold">
												Bookinger for{" "}
												{BASE_ROOMS[selectedBase]?.find((r) => r.id === cellRoomId)?.label ??
													cellRoomId}
											</div>
											<div className="text-sm text-zinc-800">
												{BASE_LABELS[selectedBase]}  b7 {formatWeekdayShort(cellDate)}{" "}
												{cellDate.toLocaleDateString("nb-NO")}
											</div>
										</div>
										<button
											onClick={closeCellModal}
											className="rounded-xl border px-3 py-2 text-sm"
										>
											Lukk
										</button>
									</div>

									{cellBookings.length === 0 ? (
										<div className="text-sm text-zinc-800">
											Ingen bookinger for dette d f8gnet.
										</div>
									) : (
										<div className="space-y-2">
											{cellBookings.map((b) => (
												<div
													key={b.id}
													className="flex items-start justify-between gap-3 rounded-xl border p-3 text-sm"
												>
													<div>
														<div className="font-medium">{b.name}</div>
														<div className="text-xs text-zinc-800">
															{fmt(b.from)}  d7 {fmt(b.to)}
														</div>
														<div className="mt-1 text-[11px] text-zinc-700">
															Opprettet av {b.createdByName || " d7"}
														</div>
													</div>
													<button
														onClick={() => {
															openEdit(b);
															closeCellModal();
														}}
														className="rounded-xl border px-3 py-2 text-xs"
													>
													Endre
													</button>
												</div>
											))}
										</div>
									)}
								</div>
							</div>
						)}

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
