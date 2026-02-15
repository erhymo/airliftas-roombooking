const assert = require("node:assert/strict");

function addDays(d, days) {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + days);
  return x;
}

function startOfWeekMonday(d) {
  const x = new Date(d.getTime());
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0 = søndag, 1 = mandag, ...
  const diff = (day + 6) % 7; // antall dager tilbake til mandag
  return addDays(x, -diff);
}

function getIsoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return weekNo;
}

function overlaps(aFrom, aTo, bFrom, bTo) {
  return aFrom < bTo && aTo > bFrom;
}

function isRoomOccupiedOnDate(roomId, day, bookings) {
  const dayStart = new Date(day.getTime());
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = addDays(dayStart, 1);
  return bookings.some((b) => {
    if (b.roomId !== roomId) return false;
    return overlaps(b.from, b.to, dayStart, dayEnd);
  });
}

function testStartOfWeekMonday() {
  const wed = new Date(2024, 0, 3); // onsdag 3. jan 2024
  const mon = new Date(2024, 0, 1); // mandag samme uke
  assert.equal(startOfWeekMonday(wed).toDateString(), mon.toDateString());

  const fri = new Date(2024, 0, 5); // fredag 5. jan 2024
  assert.equal(startOfWeekMonday(fri).toDateString(), mon.toDateString());
}

function testGetIsoWeek() {
  // ISO-uke 1 i 2024 starter mandag 1. januar
  assert.equal(getIsoWeek(new Date(2024, 0, 1)), 1);
  // Søndag i samme uke er fortsatt uke 1
  assert.equal(getIsoWeek(new Date(2024, 0, 7)), 1);
  // Mandag uken etter er uke 2
  assert.equal(getIsoWeek(new Date(2024, 0, 8)), 2);
}

function testOverlaps() {
  const aFrom = new Date(2024, 0, 1, 14);
  const aTo = new Date(2024, 0, 2, 14);

  // Fullt overlapp
  const bFrom = new Date(2024, 0, 1, 16);
  const bTo = new Date(2024, 0, 2, 10);
  assert.equal(overlaps(aFrom, aTo, bFrom, bTo), true);

  // Rett før
  const cFrom = new Date(2024, 0, 1, 10);
  const cTo = new Date(2024, 0, 1, 14);
  assert.equal(overlaps(aFrom, aTo, cFrom, cTo), false);

  // Rett etter
  const dFrom = new Date(2024, 0, 2, 14);
  const dTo = new Date(2024, 0, 2, 18);
  assert.equal(overlaps(aFrom, aTo, dFrom, dTo), false);
}

function testIsRoomOccupiedOnDate() {
  const roomA = "R1";
  const roomB = "R2";

  const bookings = [
    {
      roomId: roomA,
      from: new Date(2024, 0, 10, 18),
      to: new Date(2024, 0, 11, 18),
    },
    {
      roomId: roomA,
      from: new Date(2024, 0, 12, 12),
      to: new Date(2024, 0, 12, 20),
    },
    {
      roomId: roomB,
      from: new Date(2024, 0, 10, 18),
      to: new Date(2024, 0, 11, 18),
    },
  ];

  const day10 = new Date(2024, 0, 10);
  const day11 = new Date(2024, 0, 11);
  const day12 = new Date(2024, 0, 12);
  const day13 = new Date(2024, 0, 13);

  assert.equal(isRoomOccupiedOnDate(roomA, day10, bookings), true);
  assert.equal(isRoomOccupiedOnDate(roomA, day11, bookings), true);
  assert.equal(isRoomOccupiedOnDate(roomA, day12, bookings), true);
  assert.equal(isRoomOccupiedOnDate(roomA, day13, bookings), false);

  // R2 har egen booking, så resultatet skal ikke blande rom
  assert.equal(isRoomOccupiedOnDate(roomB, day10, bookings), true);
  assert.equal(isRoomOccupiedOnDate(roomB, day12, bookings), false);
}

function run() {
  testStartOfWeekMonday();
  testGetIsoWeek();
  testOverlaps();
  testIsRoomOccupiedOnDate();
  console.log("calendar-logic.test.js: alle tester passerte");
}

run();

