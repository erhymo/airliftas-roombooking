"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, Timestamp } from "firebase/firestore";

import AppShell from "@/components/AppShell";
import { firebaseAuth, firebaseDb } from "@/lib/firebaseClient";
import { isSessionExpired } from "@/lib/session";

type UserScheduleDoc = {
  year?: number;
  byDate?: Record<string, string | null>;
  lastUpdatedAt?: Timestamp;
};

const YEAR = 2026;

const MONTH_LABELS = [
  "Januar",
  "Februar",
  "Mars",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Desember",
];

type CalendarCell = {
  day: number;
  code?: string;
};

function formatDateKey(year: number, monthIndex: number, day: number): string {
  const mm = String(monthIndex + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function buildMonthGrid(
  year: number,
  monthIndex: number,
  schedule: Record<string, string>,
): (CalendarCell | null)[][] {
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  // Gjør om til mandag = 0, søndag = 6
  const startWeekday = (first.getDay() + 6) % 7;
  const weeks: (CalendarCell | null)[][] = [];
  let current: (CalendarCell | null)[] = [];

  for (let i = 0; i < startWeekday; i++) {
    current.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const key = formatDateKey(year, monthIndex, day);
    const code = schedule[key];
    current.push({ day, code });
    if (current.length === 7) {
      weeks.push(current);
      current = [];
    }
  }

  if (current.length > 0) {
    while (current.length < 7) current.push(null);
    weeks.push(current);
  }

  return weeks;
}

export default function SchedulePage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [scheduleByDate, setScheduleByDate] = useState<Record<string, string>>(
    {},
  );
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return now.getFullYear() === YEAR ? now.getMonth() : 0;
  });

  useEffect(() => {
    const auth = firebaseAuth();
    const db = firebaseDb();
    const unsub = auth.onAuthStateChanged((user) => {
      (async () => {
        if (!user || isSessionExpired()) {
          setCheckingAuth(false);
          setLoadingSchedule(false);
          setScheduleByDate({});
          setLastUpdatedAt(null);
          setError(null);
          router.replace("/");
          return;
        }

        setCheckingAuth(false);
        setLoadingSchedule(true);
        setError(null);

        try {
          const ref = doc(db, "userSchedules", `${user.uid}_${YEAR}`);
          const snap = await getDoc(ref);
          if (!snap.exists()) {
            setScheduleByDate({});
            setLastUpdatedAt(null);
            setLoadingSchedule(false);
            return;
          }

          const data = snap.data() as UserScheduleDoc;
          const map: Record<string, string> = {};
          if (data.byDate) {
            for (const [k, v] of Object.entries(data.byDate)) {
              if (typeof v === "string" && v.trim() !== "") {
                map[k] = v;
              }
            }
          }
          setScheduleByDate(map);

          if (data.lastUpdatedAt instanceof Timestamp) {
            setLastUpdatedAt(data.lastUpdatedAt.toDate());
          } else {
            setLastUpdatedAt(null);
          }
        } catch (e) {
          console.error("Failed to load schedule", e);
          setError("Klarte ikke å hente schedule akkurat nå.");
        } finally {
          setLoadingSchedule(false);
        }
      })();
    });
    return () => unsub();
  }, [router]);

  if (checkingAuth) {
    return (
      <main className="min-h-screen bg-zinc-50 p-6 text-zinc-900">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm text-zinc-600">Laster…</p>
        </div>
      </main>
    );
  }

  const monthGrid = buildMonthGrid(YEAR, selectedMonth, scheduleByDate);
  const hasAnyDuty = Object.keys(scheduleByDate).length > 0;

  const formatter = new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <AppShell title="Din schedule" backHref="/home">
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-zinc-900">
          Her ser du din personlige schedule for {YEAR}. Dager der du har vakt,
          standby eller annen aktivitet vil være uthevet i kalenderen.
        </p>

        {loadingSchedule && (
          <p className="text-sm text-zinc-700">Henter schedule…</p>
        )}

        {error && !loadingSchedule && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        {!loadingSchedule && !error && !hasAnyDuty && (
          <p className="text-sm text-zinc-700">
            Vi har ikke funnet noen schedule for deg ennå. Dette blir fylt ut
            automatisk når integrasjonen mot SharePoint er på plass.
          </p>
        )}

        <div className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setSelectedMonth((m) => (m + 11) % 12)}
              className="inline-flex items-center rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Forrige måned
            </button>
            <div className="text-sm font-medium text-zinc-900">
              {MONTH_LABELS[selectedMonth]} {YEAR}
            </div>
            <button
              type="button"
              onClick={() => setSelectedMonth((m) => (m + 1) % 12)}
              className="inline-flex items-center rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Neste måned
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-[11px] font-medium text-zinc-500">
            {["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"].map((label) => (
              <div key={label} className="text-center">
                {label}
              </div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1 text-xs">
            {monthGrid.map((week, weekIdx) =>
              week.map((cell, dayIdx) => {
                if (!cell) {
                  return (
                    <div
                      key={`${weekIdx}-${dayIdx}`}
                      className="h-16 rounded-lg border border-transparent"
                    />
                  );
                }

                const hasDuty = !!cell.code;
                const baseClasses =
                  "flex h-16 flex-col rounded-lg border p-1";
                const visualClasses = hasDuty
                  ? " border-sky-300 bg-sky-50"
                  : " border-zinc-200 bg-white";

                return (
                  <div
                    key={`${weekIdx}-${dayIdx}`}
                    className={baseClasses + visualClasses}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-[11px] font-medium text-zinc-900">
                        {cell.day}
                      </span>
                    </div>
                    {hasDuty && (
                      <span className="mt-1 inline-flex w-fit rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800">
                        {cell.code}
                      </span>
                    )}
                  </div>
                );
              }),
            )}
          </div>
        </div>

        <div className="text-xs text-zinc-500">
          {lastUpdatedAt
            ? `Sist oppdatert: ${formatter.format(lastUpdatedAt)}`
            : "Schedule vil bli oppdatert automatisk to ganger i døgnet når integrasjonen mot SharePoint er klar."}
        </div>
      </div>
    </AppShell>
  );
}
