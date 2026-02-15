"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import AppShell from "@/components/AppShell";
import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	getDoc,
	onSnapshot,
	orderBy,
	query,
	serverTimestamp,
	Timestamp,
	updateDoc,
	where,
} from "firebase/firestore";

	import { firebaseAuth, firebaseDb } from "@/lib/firebaseClient";
		import { isSessionExpired } from "@/lib/session";
		import { useOnlineStatus } from "@/lib/useOnlineStatus";

type RoomId = "R1" | "R2" | "R3" | "R4" | "R5" | "R6";

type Booking = {
	id: string;
	baseId: "bergen";
	roomId: RoomId;
	roomName: string;
	name: string;
	from: Date;
	to: Date;
	createdByUid: string;
	createdByName: string;
};

type HotelStay = {
	id: string;
	baseId: "bergen";
	name: string;
	from: Date;
	to: Date;
	createdByUid: string;
};

const ROOMS: { id: RoomId; label: string }[] = [
	{ id: "R1", label: "Rom 1" },
	{ id: "R2", label: "Rom 2" },
	{ id: "R3", label: "Rom 3" },
	{ id: "R4", label: "Rom 4" },
	{ id: "R5", label: "Rom 5" },
	{ id: "R6", label: "Rom 6" },
];

function fmt(dt: Date) {
	return new Intl.DateTimeFormat("nb-NO", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	}).format(dt);
}

function toTimestamp(d: Date) {
	return Timestamp.fromDate(d);
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

function clampMaxOneMonth(from: Date, to: Date) {
	const max = new Date(from);
	max.setMonth(max.getMonth() + 1);
	return to > max ? max : to;
}

function overlaps(aFrom: Date, aTo: Date, bFrom: Date, bTo: Date) {
	return aFrom < bTo && aTo > bFrom;
}

function defaultBergenFrom(dateStr: string) {
	const [y, m, d] = dateStr.split("-").map(Number);
	const dt = new Date(y, m - 1, d, 14, 0, 0, 0);
	return dt;
}

function defaultBergenTo(dateStr: string) {
	const from = defaultBergenFrom(dateStr);
	const to = addDays(from, 1);
	return to;
}

function formatDateInput(d: Date) {
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
}

function formatTimeInput(d: Date) {
	const hh = String(d.getHours()).padStart(2, "0");
	const mm = String(d.getMinutes()).padStart(2, "0");
	return `${hh}:${mm}`;
}

function setTimeOnDate(date: Date, hhmm: string) {
	const [hh, mm] = hhmm.split(":").map(Number);
	const d = new Date(date);
	d.setHours(hh, mm, 0, 0);
	return d;
}

export default function BergenBase() {
	const router = useRouter();
	const auth = useMemo(() => firebaseAuth(), []);
	const db = useMemo(() => firebaseDb(), []);
	const isOnline = useOnlineStatus();

	const [uid, setUid] = useState<string | null>(null);
	const [myName, setMyName] = useState<string>("");

	const [bookings, setBookings] = useState<Booking[]>([]);
	const [hotel, setHotel] = useState<HotelStay[]>([]);

	const [msg, setMsg] = useState<string | null>(null);

	const [openRoom, setOpenRoom] = useState<RoomId | null>(null);
	const [editBookingId, setEditBookingId] = useState<string | null>(null);

	const [step, setStep] = useState<"date" | "time">("date");

	const [fromDate, setFromDate] = useState<string>(
		formatDateInput(startOfTodayLocal()),
	);
	const [toDate, setToDate] = useState<string>(
		formatDateInput(addDays(startOfTodayLocal(), 1)),
	);
	const [fromTime, setFromTime] = useState<string>("14:00");
	const [toTime, setToTime] = useState<string>("14:00");

	const [hotelOpen, setHotelOpen] = useState(false);
	const [hotelName, setHotelName] = useState("");
	const [hotelFromDate, setHotelFromDate] = useState<string>(
		formatDateInput(startOfTodayLocal()),
	);
	const [hotelToDate, setHotelToDate] = useState<string>(
		formatDateInput(addDays(startOfTodayLocal(), 1)),
	);
	const [hotelFromTime, setHotelFromTime] = useState<string>("14:00");
	const [hotelToTime, setHotelToTime] = useState<string>("14:00");
		const [showOverview, setShowOverview] = useState(false);

	useEffect(() => {
		const unsub = onAuthStateChanged(auth, async (u) => {
			if (!u?.uid || isSessionExpired()) {
				router.replace("/");
				return;
			}
			setUid(u.uid);

			const snap = await getDoc(doc(db, "users", u.uid));
			const data = snap.data() as { name?: string } | undefined;
			setMyName(String(data?.name ?? ""));
		});
		return () => unsub();
	}, [auth, db, router]);

	useEffect(() => {
		if (!uid) return;

		const now = new Date();
		const start = addDays(now, -2);
		const end = addDays(now, 40);

		const q = query(
			collection(db, "bookings"),
			where("baseId", "==", "bergen"),
			where("to", ">", toTimestamp(start)),
			where("from", "<", toTimestamp(end)),
			orderBy("to", "asc"),
		);

		const unsub = onSnapshot(
			q,
			(snap) => {
				const rows: Booking[] = snap.docs.map((d) => {
					const data = d.data() as {
						roomId?: RoomId;
						roomName?: string;
						name?: string;
						from?: Timestamp;
						to?: Timestamp;
						createdByUid?: string;
						createdByName?: string;
					};
					return {
						id: d.id,
						baseId: "bergen",
						roomId: (data.roomId ?? "R1") as RoomId,
						roomName: String(data.roomName ?? ""),
						name: String(data.name ?? ""),
						from: (data.from as Timestamp).toDate(),
						to: (data.to as Timestamp).toDate(),
						createdByUid: String(data.createdByUid ?? ""),
						createdByName: String(data.createdByName ?? ""),
					};
				});
				setBookings(rows);
			},
			() => setMsg("Kunne ikke hente bookinger (sjekk Firestore Rules/indeks)."),
		);

		return () => unsub();
	}, [db, uid]);

	useEffect(() => {
		if (!uid) return;

		const q = query(
			collection(db, "hotelStays"),
			where("baseId", "==", "bergen"),
			orderBy("from", "asc"),
		);

		const unsub = onSnapshot(
			q,
			(snap) => {
				const rows: HotelStay[] = snap.docs.map((d) => {
					const data = d.data() as {
						name?: string;
						from?: Timestamp;
						to?: Timestamp;
						createdByUid?: string;
					};
					return {
						id: d.id,
						baseId: "bergen",
						name: String(data.name ?? ""),
						from: (data.from as Timestamp).toDate(),
						to: (data.to as Timestamp).toDate(),
						createdByUid: String(data.createdByUid ?? ""),
					};
				});
				setHotel(rows);
			},
			() => setMsg("Kunne ikke hente hotelliste (sjekk Firestore Rules/indeks)."),
		);

		return () => unsub();
	}, [db, uid]);

	function roomCurrentBooking(roomId: RoomId) {
		const now = new Date();
		return (
			bookings.find((b) => b.roomId === roomId && b.from <= now && b.to >= now) ||
			null
		);
	}

	function roomNextBooking(roomId: RoomId) {
		const now = new Date();
		return (
			bookings
				.filter((b) => b.roomId === roomId && b.from > now)
				.sort((a, b) => a.from.getTime() - b.from.getTime())[0] || null
		);
	}

		function roomStatus(roomId: RoomId) {
			const current = roomCurrentBooking(roomId);
			const next = roomNextBooking(roomId);
			const now = new Date();
			const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

			let kind: "occupied" | "soon" | "free";
			if (current) {
				kind = "occupied";
			} else if (next && next.from.getTime() - now.getTime() <= TWELVE_HOURS_MS) {
				kind = "soon";
			} else {
				kind = "free";
			}

			return { kind, current, next };
		}

	function setQuick(days: 7 | 14) {
		const from = defaultBergenFrom(fromDate);
		const to = addDays(from, days);
		const toClamped = clampMaxOneMonth(from, to);
		setToDate(formatDateInput(toClamped));
		setFromTime("14:00");
		setToTime("14:00");
	}

	function openBooking(roomId: RoomId) {
		setMsg(null);
		setEditBookingId(null);
		setOpenRoom(roomId);
		setStep("date");

		const todayStr = formatDateInput(startOfTodayLocal());
		setFromDate(todayStr);
		setToDate(formatDateInput(addDays(startOfTodayLocal(), 1)));
		setFromTime("14:00");
		setToTime("14:00");
	}

	function openEdit(booking: Booking) {
		setMsg(null);
		setOpenRoom(booking.roomId);
		setEditBookingId(booking.id);
		setStep("date");

		setFromDate(formatDateInput(booking.from));
		setToDate(formatDateInput(booking.to));
		setFromTime(formatTimeInput(booking.from));
		setToTime(formatTimeInput(booking.to));
	}

	function closeModal() {
		setOpenRoom(null);
		setEditBookingId(null);
		setStep("date");
	}

	async function deleteBooking(id: string) {
		if (!uid) return;
		setMsg(null);
		try {
			await deleteDoc(doc(db, "bookings", id));
			closeModal();
		} catch {
			setMsg("Kunne ikke slette booking.");
		}
	}

	async function saveBooking() {
		if (!uid || !openRoom) return;
		setMsg(null);

		const fromBase = defaultBergenFrom(fromDate);
		const toBase = defaultBergenFrom(toDate);

		const from = setTimeOnDate(fromBase, fromTime);
		const to = setTimeOnDate(toBase, toTime);

		if (to <= from) {
			setMsg("Til må være etter fra.");
			return;
		}

		const maxTo = clampMaxOneMonth(from, to);
		if (maxTo.getTime() !== to.getTime()) {
			setMsg("Maks bookinglengde er 1 måned.");
			return;
		}

		const roomBookings = bookings.filter(
			(b) => b.roomId === openRoom && b.id !== editBookingId,
		);
		const collision = roomBookings.some((b) => overlaps(from, to, b.from, b.to));
		if (collision) {
			setMsg("Tidsrommet er opptatt. Velg et annet tidsrom.");
			return;
		}

		const roomLabel = ROOMS.find((r) => r.id === openRoom)?.label ?? openRoom;

		try {
			if (editBookingId) {
				await updateDoc(doc(db, "bookings", editBookingId), {
					from: toTimestamp(from),
					to: toTimestamp(to),
					name: myName || "Ukjent",
					updatedAt: serverTimestamp(),
				});
			} else {
				await addDoc(collection(db, "bookings"), {
					baseId: "bergen",
					roomId: openRoom,
					roomName: roomLabel,
					name: myName || "Ukjent",
					from: toTimestamp(from),
					to: toTimestamp(to),
					createdByUid: uid,
					createdByName: myName || "Ukjent",
					createdAt: serverTimestamp(),
					updatedAt: serverTimestamp(),
				});
			}
			closeModal();
		} catch {
			setMsg("Kunne ikke lagre booking (sjekk Rules/indeks).");
		}
	}

	async function addHotelStay() {
		if (!uid) return;
		setMsg(null);

		const fromBase = defaultBergenFrom(hotelFromDate);
		const toBase = defaultBergenFrom(hotelToDate);
		const from = setTimeOnDate(fromBase, hotelFromTime);
		const to = setTimeOnDate(toBase, hotelToTime);

		if (!hotelName.trim()) {
			setMsg("Skriv inn navn for hotell.");
			return;
		}
		if (to <= from) {
			setMsg("Til må være etter fra.");
			return;
		}

		const maxTo = clampMaxOneMonth(from, to);
		if (maxTo.getTime() !== to.getTime()) {
			setMsg("Maks varighet er 1 måned.");
			return;
		}

		try {
			await addDoc(collection(db, "hotelStays"), {
				baseId: "bergen",
				name: hotelName.trim(),
				from: toTimestamp(from),
				to: toTimestamp(to),
				createdByUid: uid,
				createdAt: serverTimestamp(),
			});
			setHotelOpen(false);
			setHotelName("");
		} catch {
			setMsg("Kunne ikke lagre hotelloppføring.");
		}
	}

	async function deleteHotelStay(id: string) {
		if (!uid) return;
		setMsg(null);
		try {
			await deleteDoc(doc(db, "hotelStays", id));
		} catch {
			setMsg("Kunne ikke slette hotelloppføring.");
		}
	}

	const planRoom = (roomId: RoomId) => {
		const current = roomCurrentBooking(roomId);
		const next = roomNextBooking(roomId);

		return (
			<div className="text-[11px] leading-tight text-zinc-900">
				{current ? (
					<>
						<div className="font-semibold">{current.name}</div>
						<div>{fmt(current.from)} – {fmt(current.to)}</div>
					</>
				) : next ? (
					<>
						<div className="font-semibold">Ledig</div>
						<div>Neste: {next.name}</div>
						<div>{fmt(next.from)} – {fmt(next.to)}</div>
					</>
				) : (
					<div>Ledig</div>
				)}
			</div>
		);
	};

	function getRoomOverview(roomId: RoomId) {
		return roomStatus(roomId);
	}

		return (
			<AppShell
				title="Bergen"
				subtitle="Brakke: 6 rom (3 + gang + 3). Booking: dato -> tid (default 14:00-14:00)."
				backHref="/bases"
				offline={!isOnline}
			>
				<div className="max-w-3xl mx-auto space-y-3 sm:space-y-4">
						<header className="sr-only">
						<div>
							<h1 className="text-2xl font-semibold">Bergen</h1>
							<p className="text-sm leading-relaxed text-zinc-900">
								Brakke: 6 rom (3 + gang + 3). Booking: dato → tid (default 14:00–14:00).
							</p>
						</div>
						<div className="hidden flex-col items-end gap-2">
							{!isOnline && (
								<span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
								Offline  synker ne5r online
								</span>
							)}
							<button
								onClick={() => router.push("/bases")}
								className="hidden rounded-xl border px-4 py-2"
							>
								Tilbake
							</button>
						</div>
					</header>

				{msg && <div className="rounded-xl border p-3 text-sm">{msg}</div>}

					<section className="rounded-2xl border p-4 space-y-3">
						<div className="font-semibold">Plantegning</div>
					
						<div className="w-full">
							<svg
								viewBox="0 0 900 360"
								preserveAspectRatio="xMidYMid meet"
								className="h-auto w-full"
							>
							<rect
								x="10"
								y="10"
								width="880"
								height="340"
								rx="16"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							/>

							<rect
								x="410"
								y="30"
								width="80"
								height="300"
								rx="12"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							/>
							<text x="450" y="60" textAnchor="middle" fontSize="14">
								Gang
							</text>

							{(["R1", "R2", "R3"] as RoomId[]).map((rid, i) => {
								const y = 30 + i * 100;
								const status = roomStatus(rid);
								const fillColor =
									status.kind === "occupied"
										? "rgba(239, 68, 68, 0.12)"
										: status.kind === "soon"
											? "rgba(245, 158, 11, 0.12)"
											: "rgba(34, 197, 94, 0.08)";
								return (
									<g key={rid}>
										<rect
											x="40"
											y={y}
											width="350"
											height="90"
											rx="14"
											fill={fillColor}
											stroke="currentColor"
											strokeWidth="2"
											onClick={() => openBooking(rid)}
											style={{ cursor: "pointer" }}
										/>
										<text x="60" y={y + 28} fontSize="16" fontWeight="600">
											{ROOMS.find((r) => r.id === rid)?.label}
										</text>
											<foreignObject x="60" y={y + 34} width="320" height="52">
												<div>
													{planRoom(rid)}
												</div>
											</foreignObject>
									</g>
								);
							})}

							{(["R4", "R5", "R6"] as RoomId[]).map((rid, i) => {
								const y = 30 + i * 100;
								const status = roomStatus(rid);
								const fillColor =
									status.kind === "occupied"
										? "rgba(239, 68, 68, 0.12)"
										: status.kind === "soon"
											? "rgba(245, 158, 11, 0.12)"
											: "rgba(34, 197, 94, 0.08)";
								return (
									<g key={rid}>
										<rect
											x="510"
											y={y}
											width="350"
											height="90"
											rx="14"
											fill={fillColor}
											stroke="currentColor"
											strokeWidth="2"
											onClick={() => openBooking(rid)}
											style={{ cursor: "pointer" }}
										/>
										<text x="530" y={y + 28} fontSize="16" fontWeight="600">
											{ROOMS.find((r) => r.id === rid)?.label}
										</text>
											<foreignObject x="530" y={y + 34} width="320" height="52">
												<div>
													{planRoom(rid)}
												</div>
											</foreignObject>
									</g>
								);
							})}
						</svg>
					</div>
					
					<div className="text-xs text-zinc-900">
						Farger: Rød=opptatt nå, Gul=opptatt innen 12 timer, Grønn=ledig.
					</div>
					<div className="text-xs text-zinc-900">
						Tips: klikk et rom for å booke. Klikk en booking i listen under for å
						redigere (kun egne).
					</div>
				</section>

					<section className="rounded-2xl border p-4 space-y-3">
						<div className="flex items-center justify-between">
							<div className="font-semibold">Oversikt per rom</div>
							<button
								type="button"
								onClick={() => setShowOverview((v) => !v)}
								className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium text-zinc-700 sm:hidden"
							>
								{showOverview ? "Skjul oversikt" : "Vis oversikt"}
							</button>
						</div>
						<div
							className={`divide-y rounded-xl border text-sm ${
								showOverview ? "block" : "hidden sm:block"
							}`}
						>
						{ROOMS.map((room) => {
							const { kind, current, next } = getRoomOverview(room.id);

							const statusLabel =
								kind === "occupied"
									? "Opptatt nå"
									: kind === "soon"
										? "Opptatt innen 12 timer"
										: "Ledig";

							const statusClassName =
								kind === "occupied"
									? "text-red-800 border-red-200"
									: kind === "soon"
										? "text-amber-800 border-amber-200"
										: "text-emerald-800 border-emerald-200";

							const statusBg =
								kind === "occupied"
									? "rgba(239, 68, 68, 0.12)"
									: kind === "soon"
										? "rgba(245, 158, 11, 0.12)"
										: "rgba(34, 197, 94, 0.08)";

							return (
								<div
									key={room.id}
									className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
								>
									<div className="font-medium">{room.label}</div>
									<div className="flex flex-col items-start gap-1 text-xs sm:items-end sm:text-sm">
										<span
											className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClassName}`}
											style={{ backgroundColor: statusBg }}
										>
											{statusLabel}
										</span>
							{current && (
								<div className="text-xs sm:text-sm text-zinc-900">
									<span>Nå: </span>
									<span className="font-medium">{current.name}</span>
									<span>
										{" "}
										{fmt(current.from)} – {fmt(current.to)}
									</span>
								</div>
							)}
							{!current && next && (
								<div className="text-xs sm:text-sm text-zinc-900">
									<span>Neste: </span>
									<span className="font-medium">{next.name}</span>
									<span>
										{" "}
										{fmt(next.from)} – {fmt(next.to)}
									</span>
								</div>
							)}
									</div>
								</div>
							);
						})}
					</div>
				</section>

				<section className="rounded-2xl border p-4 space-y-3">
					<div className="font-semibold">Bookinger</div>

						{bookings.length === 0 ? (
							<div className="text-sm text-zinc-900">Ingen bookinger funnet.</div>
						) : (
						<div className="space-y-2">
							{bookings
									.slice()
									.sort((a, b) => a.from.getTime() - b.from.getTime())
									.map((b) => (
										<button
											key={b.id}
											onClick={() => openEdit(b)}
											className="w-full text-left rounded-xl border p-3 hover:bg-black/5"
										>
											<div className="flex items-center justify-between gap-2">
												<div className="font-medium">
													{b.roomName} – {b.name}
												</div>
								<div className="text-xs text-zinc-900">
									{b.createdByUid === uid ? "Din" : "Annen"}
								</div>
											</div>
							<div className="text-sm text-zinc-900">
								{fmt(b.from)} – {fmt(b.to)}
							</div>
										</button>
									))}
						</div>
					)}
				</section>

				<section className="rounded-2xl border p-4 space-y-3">
					<div className="flex items-center justify-between">
						<div className="font-semibold">Hotell (kun info)</div>
						<button
							onClick={() => setHotelOpen(true)}
							className="rounded-xl border px-3 py-2 text-sm"
						>
							Legg til
						</button>
					</div>

						{hotel.length === 0 ? (
							<div className="text-sm text-zinc-900">Ingen hotelloppføringer.</div>
						) : (
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
							<thead className="text-left text-zinc-900">
									<tr>
										<th className="py-2">Navn</th>
										<th className="py-2">Fra</th>
										<th className="py-2">Til</th>
										<th className="py-2"></th>
									</tr>
								</thead>
								<tbody>
									{hotel.map((h) => (
										<tr key={h.id} className="border-t">
											<td className="py-2">{h.name}</td>
											<td className="py-2">{fmt(h.from)}</td>
											<td className="py-2">{fmt(h.to)}</td>
											<td className="py-2 text-right">
									{h.createdByUid === uid ? (
										<button
											onClick={() => deleteHotelStay(h.id)}
											className="rounded-lg border px-2 py-1 text-xs"
										>
											Slett
										</button>
									) : (
										<span className="text-xs text-zinc-900">—</span>
									)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</section>

				{/* BOOKING MODAL */}
				{openRoom && (
					<div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center p-4 z-50">
						<div className="w-full max-w-lg rounded-2xl bg-white p-4 space-y-3">
							<div className="flex items-start justify-between">
								<div>
									<div className="text-lg font-semibold">
										{ROOMS.find((r) => r.id === openRoom)?.label}
									</div>
								<div className="text-sm text-zinc-900">
										{editBookingId
												? "Rediger booking (kun egne)"
												: "Ny booking"}
									</div>
								</div>
								<button
									onClick={closeModal}
									className="rounded-xl border px-3 py-2 text-sm"
								>
									Lukk
								</button>
							</div>

							<div className="rounded-xl border p-3 text-sm leading-relaxed text-zinc-900">
								Bergen: default er 14:00  14:00. Du velger først dato, så tid i neste
								steg.
							</div>

							{step === "date" ? (
								<div className="space-y-3">
									<label className="block text-sm">
										Fra dato
										<input
											type="date"
											value={fromDate}
											onChange={(e) => {
												const v = e.target.value;
												setFromDate(v);
												const to = defaultBergenTo(v);
												setToDate(formatDateInput(to));
												setFromTime("14:00");
												setToTime("14:00");
											}}
											className="mt-1 w-full rounded-xl border p-3"
										/>
									</label>

									<label className="block text-sm">
										Til dato
										<input
											type="date"
											value={toDate}
											onChange={(e) => setToDate(e.target.value)}
											className="mt-1 w-full rounded-xl border p-3"
										/>
									</label>

									<div className="flex gap-2">
										<button
												onClick={() => setQuick(7)}
												className="flex-1 rounded-xl border py-3 font-medium"
											>
												+7 dager
											</button>
											<button
												onClick={() => setQuick(14)}
												className="flex-1 rounded-xl border py-3 font-medium"
											>
												+14 dager
											</button>
									</div>

									<button
										onClick={() => setStep("time")}
										className="w-full rounded-xl bg-black text-white py-3 font-medium"
									>
										Neste: tid
									</button>

									{editBookingId && (
										<button
											onClick={() => deleteBooking(editBookingId)}
											className="w-full rounded-xl border py-3 font-medium"
										>
											Slett booking
										</button>
									)}
								</div>
							) : (
								<div className="space-y-3">
									<label className="block text-sm">
										Fra tid
										<input
											type="time"
											value={fromTime}
											onChange={(e) => setFromTime(e.target.value)}
											className="mt-1 w-full rounded-xl border p-3"
										/>
									</label>

									<label className="block text-sm">
										Til tid
										<input
											type="time"
											value={toTime}
											onChange={(e) => setToTime(e.target.value)}
											className="mt-1 w-full rounded-xl border p-3"
										/>
									</label>

									<div className="flex gap-2">
										<button
												onClick={() => setStep("date")}
												className="flex-1 rounded-xl border py-3 font-medium"
											>
												Tilbake
											</button>
											<button
												onClick={saveBooking}
												className="flex-1 rounded-xl bg-black text-white py-3 font-medium"
											>
												Lagre
											</button>
									</div>
								</div>
							)}

							{msg && <div className="rounded-xl border p-3 text-sm">{msg}</div>}
						</div>
					</div>
				)}
					{/* HOTEL MODAL */}
					{hotelOpen && (
						<div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center p-4 z-50">
							<div className="w-full max-w-lg rounded-2xl bg-white p-4 space-y-3">
								<div className="flex items-start justify-between">
									<div>
										<div className="text-lg font-semibold">Legg til hotell</div>
										<div className="text-sm text-zinc-900">Kun info til andre</div>
									</div>
									<button
										onClick={() => setHotelOpen(false)}
										className="rounded-xl border px-3 py-2 text-sm"
									>
										Lukk
									</button>
								</div>
								
								<label className="block text-sm">
									Navn
									<input
										value={hotelName}
										onChange={(e) => setHotelName(e.target.value)}
										className="mt-1 w-full rounded-xl border p-3"
										placeholder="Fornavn Etternavn"
									/>
								</label>
								
								<div className="grid grid-cols-2 gap-2">
									<label className="block text-sm">
										Fra dato
										<input
											type="date"
											value={hotelFromDate}
											onChange={(e) => setHotelFromDate(e.target.value)}
											className="mt-1 w-full rounded-xl border p-3"
										/>
									</label>
									<label className="block text-sm">
										Til dato
										<input
											type="date"
											value={hotelToDate}
											onChange={(e) => setHotelToDate(e.target.value)}
											className="mt-1 w-full rounded-xl border p-3"
										/>
									</label>
								</div>
								
								<div className="grid grid-cols-2 gap-2">
									<label className="block text-sm">
										Fra tid
										<input
											type="time"
											value={hotelFromTime}
											onChange={(e) => setHotelFromTime(e.target.value)}
											className="mt-1 w-full rounded-xl border p-3"
										/>
									</label>
									<label className="block text-sm">
										Til tid
										<input
											type="time"
											value={hotelToTime}
											onChange={(e) => setHotelToTime(e.target.value)}
											className="mt-1 w-full rounded-xl border p-3"
										/>
									</label>
								</div>
								
								<button
									onClick={addHotelStay}
									className="w-full rounded-xl bg-black text-white py-3 font-medium"
								>
									Lagre
								</button>
								
								{msg && <div className="rounded-xl border p-3 text-sm">{msg}</div>}
							</div>
						</div>
					)}
				</div>
			</AppShell>
	);
}
