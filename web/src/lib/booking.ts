export function formatDateInput(d: Date): string {
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
}

export function formatTimeInput(d: Date): string {
	const hh = String(d.getHours()).padStart(2, "0");
	const mm = String(d.getMinutes()).padStart(2, "0");
	return `${hh}:${mm}`;
}

export function setTimeOnDate(date: Date, hhmm: string): Date {
	const [hh, mm] = hhmm.split(":").map(Number);
	const d = new Date(date);
	d.setHours(hh, mm, 0, 0);
	return d;
}

export function combineDateTime(
	dateStr: string,
	timeStr: string,
): Date | null {
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
	d.setMilliseconds(0);
	return d;
}

