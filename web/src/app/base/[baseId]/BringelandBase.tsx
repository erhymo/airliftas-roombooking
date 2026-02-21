"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
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
import AppShell from "@/components/AppShell";
import {
	startOfTodayLocal,
	addDays,
	startOfWeekMonday,
	formatWeekdayShort,
		formatMonthShort,
	getIsoWeek,
	clampMaxOneMonth,
	overlaps,
} from "@/lib/calendar";
import { formatDateInput, formatTimeInput, setTimeOnDate } from "@/lib/booking";
import type { BookingBase, BringelandRoomId } from "@/lib/types";

type RoomId = BringelandRoomId;

type Booking = BookingBase<"bringeland", RoomId>;

const ROOMS: { id: RoomId; label: string }[] = [
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
function defaultBringelandFrom(dateStr: string) {
	const [y, m, d] = dateStr.split("-").map(Number);
	const dt = new Date(y, m - 1, d, 18, 0, 0, 0);
	return dt;
}

function defaultBringelandTo(dateStr: string) {
	const from = defaultBringelandFrom(dateStr);
	const to = addDays(from, 1);
	return to;
}

export default function BringelandBase() {
	const router = useRouter();
	const auth = useMemo(() => firebaseAuth(), []);
	const db = useMemo(() => firebaseDb(), []);
	const isOnline = useOnlineStatus();

	const [uid, setUid] = useState<string | null>(null);
	const [myName, setMyName] = useState<string>("");
	const [floor, setFloor] = useState<1 | 2>(1);

	const [bookings, setBookings] = useState<Booking[]>([]);
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
	const [fromTime, setFromTime] = useState<string>("18:00");
	const [toTime, setToTime] = useState<string>("18:00");
	const [showOverview, setShowOverview] = useState(false);
		const [longRoom, setLongRoom] = useState<RoomId | null>(null);
		const [calendarStart] = useState<Date>(() =>
			startOfWeekMonday(startOfTodayLocal()),
		);

		const calendarDays = useMemo(() => {
			return Array.from({ length: 14 }, (_, idx) => addDays(calendarStart, idx));
		}, [calendarStart]);

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

		const sixMonthWeeks = useMemo(() => {
			const WEEKS = 26; // ca. 6 måneder
			const start = calendarStart;
			return Array.from({ length: WEEKS }, (_, weekIndex) => {
				const weekStart = addDays(start, weekIndex * 7);
				const days = Array.from({ length: 7 }, (_, dayIndex) =>
					addDays(weekStart, dayIndex),
				);
				return { weekStart, days };
			});
		}, [calendarStart]);

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
			// Hent bookinger for Bringeland ca. 6 måneder tilbake og frem i tid
			const start = addDays(now, -190);
			const end = addDays(now, 190);

			const q = query(
				collection(db, "bookings"),
				where("baseId", "==", "bringeland"),
				where("from", ">", toTimestamp(start)),
				where("from", "<", toTimestamp(end)),
				orderBy("from", "asc"),
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
							baseId: "bringeland",
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
					setMsg(null);
				},
				() => setMsg("Kunne ikke hente bookinger (sjekk Firestore Rules/indeks)."),
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

		function isRoomOccupiedOnDate(roomId: RoomId, day: Date) {
			const dayStart = new Date(day);
			dayStart.setHours(0, 0, 0, 0);
			const dayEnd = addDays(dayStart, 1);
			return bookings.some(
				(b) =>
					b.roomId === roomId && overlaps(b.from, b.to, dayStart, dayEnd),
			);
		}

			function getLastNameFromFullName(fullName: string): string {
				const trimmed = fullName.trim();
				if (!trimmed) return "";
				const parts = trimmed.split(" ");
				return parts[parts.length - 1];
			}

				function myLastNameOnDate(roomId: RoomId, day: Date): string {
					if (!uid) return "";
					const dayStart = new Date(day);
					dayStart.setHours(0, 0, 0, 0);
					const dayEnd = addDays(dayStart, 1);
					const booking = bookings.find(
						(b) =>
							b.roomId === roomId &&
							overlaps(b.from, b.to, dayStart, dayEnd),
					);
					if (!booking) return "";
					const sourceName =
						booking.name || booking.createdByName || myName || "Ukjent";
					return getLastNameFromFullName(sourceName);
				}

		function openBooking(roomId: RoomId, day?: Date) {
			setMsg(null);
			setEditBookingId(null);
			setOpenRoom(roomId);
			setStep("date");

			const base = day ? new Date(day) : startOfTodayLocal();
			base.setHours(0, 0, 0, 0);
			const fromD = base;
			const toD = addDays(fromD, 1);

			setFromDate(formatDateInput(fromD));
			setToDate(formatDateInput(toD));
			setFromTime("18:00");
			setToTime("18:00");
		}

	function openEdit(booking: Booking) {
		if (booking.createdByUid !== uid) return;
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

		const fromBase = defaultBringelandFrom(fromDate);
		const toBase = defaultBringelandFrom(toDate);

		const from = setTimeOnDate(fromBase, fromTime);
		const to = setTimeOnDate(toBase, toTime);

		if (to <= from) {
			setMsg("Til må være etter fra.");
			return;
		}

			const maxTo = clampMaxOneMonth(from, to);
			if (maxTo.getTime() !== to.getTime()) {
				setMsg("Maks bookinglengde er 6 måneder.");
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

					// Optimistisk oppdatering av lokal state slik at UI endres med en gang
					setBookings((prev) =>
						prev
							.map((b) =>
								b.id === editBookingId
									? {
										...b,
										from,
										to,
										name: myName || "Ukjent",
									}
								: b,
							)
							.sort((a, b) => a.from.getTime() - b.from.getTime()),
					);
				} else {
					const docRef = await addDoc(collection(db, "bookings"), {
						baseId: "bringeland",
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

					const newBooking: Booking = {
						id: docRef.id,
						baseId: "bringeland",
						roomId: openRoom,
						roomName: roomLabel,
						name: myName || "Ukjent",
						from,
						to,
						createdByUid: uid,
						createdByName: myName || "Ukjent",
					};

					setBookings((prev) =>
						[...prev, newBooking].sort(
							(a, b) => a.from.getTime() - b.from.getTime(),
						),
					);
				}
				closeModal();
			} catch {
				setMsg("Kunne ikke lagre booking (sjekk Rules/indeks).");
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

	const leftRooms: RoomId[] =
		floor === 1 ? ["R1", "R2", "R3"] : ["R7", "R8", "R9"];
	const rightRooms: RoomId[] =
		floor === 1 ? ["R4", "R5", "R6"] : ["R10", "R11", "R12"];

	return (
		<AppShell
			title="Bringeland"
			subtitle="Brakke: 12 rom over 2 etasjer. Booking: dato -> tid (default 18:00-18:00)."
			backHref="/bases"
			offline={!isOnline}
			>
				<div className="max-w-3xl mx-auto space-y-3 sm:space-y-4">
						<header className="sr-only">
					<div>
						<h1 className="text-2xl font-semibold">Bringeland</h1>
						<p className="text-sm leading-relaxed text-zinc-900">
							Brakke: 12 rom over 2 etasjer. Booking: dato → tid (default 18:00–18:00).
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
							<div className="flex items-center justify-between gap-4">
								<div className="font-semibold">Kalender</div>
								<div className="text-[11px] text-zinc-700 text-right">
									<div>
										Starter på mandag denne uken og viser 14 dager frem.
									</div>
									{weekLabel && (
										<div className="text-[11px] text-zinc-500">{weekLabel}</div>
									)}
								</div>
							</div>
						<div className="space-y-2 text-xs">
							{ROOMS.map((room) => {
								const firstWeek = calendarDays.slice(0, 7);
								const secondWeek = calendarDays.slice(7, 14);
									return (
										<div
											key={room.id}
											className="space-y-1 rounded-xl border px-2 py-1"
										>
											<div className="flex items-center justify-between gap-2">
												<button
														type="button"
														onClick={() => setLongRoom(room.id)}
														className="inline-flex items-center rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-900 hover:bg-sky-100 transition-colors"
												>
													{room.label}
												</button>
											</div>
										<div className="space-y-1">
											<div className="grid grid-cols-7 gap-1">
												{firstWeek.map((day) => {
													const occupied = isRoomOccupiedOnDate(room.id, day);
													const isToday = day.getTime() === today.getTime();
															const myLastName = myLastNameOnDate(room.id, day);
													return (
														<div
															key={day.toISOString()}
																	className={
																		"flex h-12 flex-col items-center justify-center rounded text-[10px] cursor-pointer " +
																(occupied
																	? "bg-red-100 text-red-800"
																	: "bg-emerald-100 text-emerald-800") +
											(isToday ? " ring-2 ring-sky-900" : "")
															}
															onClick={() => openBooking(room.id, day)}
																	title={`${formatWeekdayShort(day)} ${day.toLocaleDateString("nb-NO")}`}
																>
																	<div className="leading-tight text-center">
																		<div>{formatWeekdayShort(day)}</div>
																		<div>{day.getDate()}</div>
																		<div>{formatMonthShort(day)}</div>
																		{myLastName && (
																			<div className="text-[9px] font-semibold truncate max-w-full">
																				{myLastName}
																			</div>
																		)}
																	</div>
														</div>
													);
												})}
											</div>
											<div className="grid grid-cols-7 gap-1">
												{secondWeek.map((day) => {
													const occupied = isRoomOccupiedOnDate(room.id, day);
													const isToday = day.getTime() === today.getTime();
															const myLastName = myLastNameOnDate(room.id, day);
													return (
														<div
															key={day.toISOString()}
																	className={
																		"flex h-12 flex-col items-center justify-center rounded text-[10px] cursor-pointer " +
																(occupied
																	? "bg-red-100 text-red-800"
																	: "bg-emerald-100 text-emerald-800") +
											(isToday ? " ring-2 ring-sky-900" : "")
															}
															onClick={() => openBooking(room.id, day)}
																	title={`${formatWeekdayShort(day)} ${day.toLocaleDateString("nb-NO")}`}
																>
																	<div className="leading-tight text-center">
																		<div>{formatWeekdayShort(day)}</div>
																		<div>{day.getDate()}</div>
																		<div>{formatMonthShort(day)}</div>
																		{myLastName && (
																			<div className="text-[9px] font-semibold truncate max-w-full">
																				{myLastName}
																			</div>
																		)}
																	</div>
														</div>
													);
												})}
											</div>
										</div>
									</div>
								);
							})}
						</div>
						<div className="text-[11px] text-zinc-700">
							Grønn = ledig hele døgnet, rød = opptatt minst en del av døgnet.
						</div>
					</section>

				<section className="rounded-2xl border p-4 space-y-3">
					<div className="flex items-center justify-between gap-4">
						<div className="font-semibold">Plantegning</div>
					<div className="inline-flex rounded-xl border p-1 text-xs sm:text-sm">
							<button
								onClick={() => setFloor(1)}
								className={`px-3 py-1 rounded-lg ${
									floor === 1
										? "bg-black text-white"
										: "bg-transparent text-black"
								}`}
							>
								1. etasje
							</button>
							<button
								onClick={() => setFloor(2)}
								className={`px-3 py-1 rounded-lg ${
									floor === 2
										? "bg-black text-white"
										: "bg-transparent text-black"
								}`}
							>
								2. etasje
							</button>
					</div>
				</div>
				
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

							{leftRooms.map((rid, i) => {
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

							{rightRooms.map((rid, i) => {
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
						className={`divide-y rounded-xl border text-sm ${showOverview ? "block" : "hidden sm:block"}`}
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
								<button
									type="button"
									onClick={() => setLongRoom(room.id)}
									className="inline-flex items-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-900 hover:bg-sky-100 transition-colors"
								>
									{room.label}
								</button>
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
									.map((b) => {
										const mine = b.createdByUid === uid;
										return (
											<button
												key={b.id}
												onClick={mine ? () => openEdit(b) : undefined}
												disabled={!mine}
									className={`w-full text-left rounded-xl border p-3 ${
										mine ? "hover:bg-black/5" : "cursor-not-allowed"
									}`}
											>
												<div className="flex items-center justify-between gap-2">
													<div className="font-medium">
														{b.roomName} – {b.name}
													</div>
								<div className="text-xs text-zinc-900">
									{mine ? "Din" : "Annen"}
								</div>
							</div>
							<div className="text-sm text-zinc-900">
								{fmt(b.from)} – {fmt(b.to)}
							</div>
											</button>
										);
									})}
						</div>
					)}
					</section>

					{/* LANGTIDSKALENDER PER ROM */}
					{longRoom && (
						<div className="fixed inset-0 z-50 bg-white overflow-y-auto">
							<div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between">
								<div>
									<div className="text-lg font-semibold">
										{ROOMS.find((r) => r.id === longRoom)?.label} – 6 måneder
									</div>
									<div className="text-xs text-zinc-600">
										Uke for uke, klikk en dag for å starte booking.
									</div>
								</div>
								<button
									type="button"
									onClick={() => setLongRoom(null)}
									className="rounded-xl border px-3 py-1.5 text-sm"
								>
									Lukk
								</button>
							</div>

							<div className="p-4 space-y-3">
								{sixMonthWeeks.map(({ weekStart, days }, weekIndex) => {
									const weekNum = getIsoWeek(weekStart);
									return (
										<div
											key={weekIndex}
											className="rounded-2xl border px-3 py-2"
										>
											<div className="text-xs font-medium text-zinc-600 mb-2">
												Uke {weekNum}
											</div>
											<div className="grid grid-cols-7 gap-1">
												{days.map((day, dayIndex) => {
													const occupied = isRoomOccupiedOnDate(longRoom, day);
													const isToday =
																	day.toDateString() === today.toDateString();
																const myLastName = myLastNameOnDate(longRoom, day);
													return (
													<button
														key={dayIndex}
														type="button"
														onClick={() => {
															openBooking(longRoom, day);
														}}
																		className={`aspect-square rounded text-[11px] flex flex-col items-center justify-center ${
																			occupied
																				? "bg-red-100 text-red-800"
																				: "bg-emerald-100 text-emerald-800"
																		} ${
																			isToday ? "ring-2 ring-sky-900" : ""
																		} hover:opacity-80 transition`}
																	>
																		<div className="leading-tight text-center">
																			<div className="text-[10px]">
																				{formatWeekdayShort(day)}
																			</div>
																			<div className="font-semibold">
																				{day.getDate()}
																			</div>
																			<div>{formatMonthShort(day)}</div>
																			{myLastName && (
																				<div className="text-[9px] font-semibold truncate max-w-full">
																					{myLastName}
																				</div>
																			)}
																		</div>
														</button>
													);
											})}
										</div>
									</div>
									);
								})}
							</div>
						</div>
					)}

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
							Bringeland: default er 18:00 → 18:00. Du velger først dato, så tid i
							neste steg.
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
												const to = defaultBringelandTo(v);
												setToDate(formatDateInput(to));
												setFromTime("18:00");
												setToTime("18:00");
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
									className="flex-1 rounded-xl bg-sky-900 text-white py-3 font-medium hover:bg-sky-800"
											>
												Lagre
											</button>
									</div>
								</div>
							)}

							{msg && (
								<div className="rounded-xl border p-3 text-sm">{msg}</div>
							)}
						</div>
					</div>
				)}
		</div>
		</AppShell>
	);
}
