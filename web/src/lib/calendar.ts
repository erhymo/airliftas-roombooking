// Shared calendar/date helper functions used across base pages and admin

export function startOfTodayLocal(): Date {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	return d;
}

export function addDays(d: Date, days: number): Date {
	const x = new Date(d);
	x.setDate(x.getDate() + days);
	return x;
}

export function startOfWeekMonday(d: Date): Date {
	const x = new Date(d);
	x.setHours(0, 0, 0, 0);
	const day = x.getDay(); // 0 = søndag, 1 = mandag, ...
	const diff = (day + 6) % 7; // antall dager tilbake til mandag
	return addDays(x, -diff);
}

export function formatWeekdayShort(d: Date): string {
	return new Intl.DateTimeFormat("nb-NO", { weekday: "short" })
		.format(d)
		.replace(".", "");
}

	export function formatMonthShort(d: Date): string {
		const short = new Intl.DateTimeFormat("nb-NO", { month: "short" })
			.format(d)
			.replace(".", "");
		return short.charAt(0).toUpperCase() + short.slice(1);
	}

export function getIsoWeek(date: Date): number {
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

export function clampMaxOneMonth(from: Date, to: Date): Date {
	// Tillat maks ca. 6 måneder bookinglengde fra startdato
	const max = new Date(from);
	max.setMonth(max.getMonth() + 6);
	return to > max ? max : to;
}

export function overlaps(aFrom: Date, aTo: Date, bFrom: Date, bTo: Date): boolean {
	return aFrom < bTo && aTo > bFrom;
}

