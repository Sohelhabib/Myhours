import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  backupJson,
  csvReport,
  emptyState,
  getPeriod,
  gross,
  importBackup,
  monday,
  newId,
  paidMinutes,
  reduceAction,
  selectShifts,
  summary,
  today,
  validateShift,
  validDate,
} from "../src/lib/model.ts";
function fixture() {
  let state = emptyState();
  state.settings.timeZone = "Europe/London";
  for (const input of [
    { name: "Job A", role: "", rate: 1300, defaultBreak: 30, color: "mint" },
    { name: "Job B", role: "", rate: 2000, defaultBreak: 0, color: "violet" },
  ])
    state = reduceAction(state, { type: "job/save", input });
  const input = {
    jobId: state.jobs[0].id,
    date: "2026-10-19",
    start: "09:15",
    end: "17:45",
    nextDay: false,
    unpaidBreak: 30,
    rate: 1300,
    note: "",
  };
  return { state, input };
}
test("manual shift times, breaks and rate produce the expected 8 hours and 104.00", () => {
  const { state, input } = fixture();
  const s = reduceAction(state, { type: "shift/save", input });
  assert.equal(paidMinutes(s.shifts[0]), 480);
  assert.equal(gross(s.shifts[0]), 10400);
});
test("multiple-job daily and weekly totals sum the correct rates", () => {
  let { state, input } = fixture();
  state = reduceAction(state, {
    type: "shift/save",
    input: { ...input, start: "09:00", end: "17:00" },
  });
  state = reduceAction(state, {
    type: "shift/save",
    input: {
      ...input,
      jobId: state.jobs[1].id,
      start: "18:00",
      end: "22:00",
      unpaidBreak: 0,
      rate: 2000,
    },
  });
  state = reduceAction(state, {
    type: "shift/save",
    input: {
      ...input,
      date: "2026-10-20",
      start: "09:00",
      end: "10:00",
      unpaidBreak: 0,
    },
  });
  const weekly = summary(selectShifts(state, getPeriod("week", "2026-10-19")));
  assert.equal(weekly.minutes, 750);
  assert.equal(weekly.gross, 19050);
  const daily = summary(
    selectShifts(state, { start: "2026-10-19", end: "2026-10-19" }),
  );
  assert.equal(daily.minutes, 690);
  assert.equal(daily.gross, 17750);
  const one = summary(
    selectShifts(state, getPeriod("week", "2026-10-19"), state.jobs[0].id),
  );
  assert.equal(one.minutes, 510);
  assert.equal(one.gross, 11050);
});
test("saved shifts keep their rate when a job default rate changes", () => {
  let { state, input } = fixture();
  state = reduceAction(state, { type: "shift/save", input });
  const original = state.shifts[0];
  state = reduceAction(state, {
    type: "job/save",
    id: state.jobs[0].id,
    input: { ...state.jobs[0], rate: 1800 },
  });
  assert.equal(state.jobs.find((j) => j.id === original.jobId).rate, 1800);
  assert.equal(state.shifts[0].rate, 1300);
  assert.equal(gross(state.shifts[0]), 10400);
  state = reduceAction(state, {
    type: "shift/save",
    id: original.id,
    input: { ...original, rate: 1500 },
  });
  assert.equal(gross(state.shifts[0]), 12000);
  assert.equal(state.history[0].before.rate, 1300);
  assert.equal(state.history[0].after.rate, 1500);
});
test("overnight shifts and per-shift penny rounding are correct", () => {
  const { state, input } = fixture();
  const s = validateShift(
    { ...input, start: "22:00", end: "06:00", nextDay: true, rate: 1271 },
    state.jobs,
  );
  assert.equal(paidMinutes(s), 450);
  assert.equal(gross(s), 9533);
  assert.equal(
    gross({
      ...s,
      start: "09:00",
      end: "09:01",
      nextDay: false,
      unpaidBreak: 0,
    }),
    21,
  );
  assert.equal(gross({ ...s, rate: 0 }), 0);
});
test("invalid times, dates, rates and breaks are rejected", () => {
  const { state, input } = fixture();
  for (const change of [
    { date: "2026-02-30" },
    { start: "24:00" },
    { end: "09:00" },
    { end: "09:15" },
    { end: "18:00", nextDay: true },
    { unpaidBreak: 510 },
    { unpaidBreak: -1 },
    { unpaidBreak: 1.5 },
    { rate: -1 },
    { rate: 3.5 },
    { rate: Infinity },
    { jobId: "missing" },
    { note: "a".repeat(501) },
  ])
    assert.throws(() => validateShift({ ...input, ...change }, state.jobs));
  assert.equal(validDate("2028-02-29"), true);
  assert.equal(validDate("2026-02-29"), false);
});
test("overlap prevention includes overnight boundaries and permits parallel jobs", () => {
  let { state, input } = fixture();
  state = reduceAction(state, {
    type: "shift/save",
    input: { ...input, start: "22:00", end: "06:00", nextDay: true },
  });
  assert.throws(
    () =>
      reduceAction(state, {
        type: "shift/save",
        input: { ...input, date: "2026-10-20", start: "05:00", end: "07:00" },
      }),
    /overlaps/,
  );
  const next = reduceAction(state, {
    type: "shift/save",
    input: {
      ...input,
      date: "2026-10-20",
      start: "06:00",
      end: "07:00",
      unpaidBreak: 0,
    },
  });
  assert.equal(next.shifts.length, 2);
  assert.doesNotThrow(() =>
    reduceAction(state, {
      type: "shift/save",
      input: {
        ...input,
        jobId: state.jobs[1].id,
        start: "23:00",
        end: "02:00",
        nextDay: true,
      },
    }),
  );
});
test("open shifts save, can finish manually and do not inflate earnings or PDF selections", () => {
  let { state, input } = fixture();
  state = reduceAction(state, {
    type: "shift/save",
    input: { ...input, end: null },
  });
  const shift = state.shifts[0];
  assert.deepEqual(summary(state.shifts), {
    minutes: 0,
    gross: 0,
    breaks: 0,
    count: 0,
    open: 1,
  });
  assert.equal(selectShifts(state, getPeriod("week", input.date)).length, 0);
  assert.throws(
    () =>
      reduceAction(state, {
        type: "job/archive",
        id: shift.jobId,
        archived: true,
      }),
    /Finish/,
  );
  assert.throws(
    () =>
      reduceAction(state, {
        type: "shift/save",
        input: { ...input, end: null },
      }),
    /in progress/,
  );
  state = reduceAction(state, {
    type: "shift/save",
    id: shift.id,
    input: { ...shift, end: "17:45" },
  });
  assert.equal(summary(state.shifts).gross, 10400);
});
test("deletion retains the original, supports undo, and archiving retains report history", () => {
  let { state, input } = fixture();
  state = reduceAction(state, { type: "shift/save", input });
  const shift = state.shifts[0];
  state = reduceAction(state, { type: "shift/delete", id: shift.id });
  assert.equal(state.shifts.length, 0);
  assert.deepEqual(state.history[0].before, shift);
  assert.equal(state.history[0].after, null);
  state = reduceAction(state, { type: "shift/restore", shift });
  assert.equal(state.shifts.length, 1);
  assert.equal(gross(state.shifts[0]), 10400);
  assert.throws(
    () => reduceAction(state, { type: "job/delete", id: shift.jobId }),
    /Archive/,
  );
  state = reduceAction(state, {
    type: "job/archive",
    id: shift.jobId,
    archived: true,
  });
  assert.equal(selectShifts(state, getPeriod("week", input.date)).length, 1);
});
test("backup restores every job, shift and saved rate; malformed backups are rejected", () => {
  let { state, input } = fixture();
  state = reduceAction(state, { type: "shift/save", input });
  const restored = importBackup(backupJson(state));
  assert.deepEqual(restored.jobs, state.jobs);
  assert.deepEqual(restored.shifts, state.shifts);
  assert.equal(restored.settings.timeZone, "Europe/London");
  assert.throws(() => importBackup("not json"));
  const corrupt = JSON.parse(backupJson(state));
  corrupt.state.shifts[0].jobId = "missing";
  assert.throws(() => importBackup(JSON.stringify(corrupt)));
  const duplicate = JSON.parse(backupJson(state));
  duplicate.state.jobs.push(duplicate.state.jobs[0]);
  assert.throws(() => importBackup(JSON.stringify(duplicate)), /duplicate/);
});
test("CSV is precise and neutralises formula-like job names and notes", () => {
  let { state, input } = fixture();
  state.jobs[0].name = "=JOB()";
  state = reduceAction(state, {
    type: "shift/save",
    input: { ...input, note: "@SUM(1,2)" },
  });
  const csv = csvReport(state, state.shifts);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"8.0000"'));
  assert.ok(csv.includes('"104.00"'));
  assert.ok(csv.includes('"\'=JOB()"'));
  assert.ok(csv.includes('"\'@SUM(1,2)"'));
});
test("weekly and monthly selections handle year ends, leap years, London midnight and DST", () => {
  assert.equal(monday("2027-01-01"), "2026-12-28");
  assert.equal(getPeriod("month", "2028-02-12").end, "2028-02-29");
  assert.equal(getPeriod("month", "2026-02-12").end, "2026-02-28");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(
    today("Europe/London", new Date("2026-06-01T23:30:00Z")),
    "2026-06-02",
  );
  assert.equal(
    today("Europe/London", new Date("2026-12-01T23:30:00Z")),
    "2026-12-01",
  );
});
test("saving an outdated edit cannot overwrite another tab’s newer shift", () => {
  let { state, input } = fixture();
  state = reduceAction(state, { type: "shift/save", input });
  const original = state.shifts[0];
  state = {
    ...state,
    shifts: [
      { ...original, rate: 1700, updatedAt: "2099-01-01T00:00:00.000Z" },
    ],
  };
  assert.throws(
    () =>
      reduceAction(state, {
        type: "shift/save",
        id: original.id,
        input: original,
        expectedUpdatedAt: original.updatedAt,
      }),
    /another tab/,
  );
  assert.equal(state.shifts[0].rate, 1700);
});
test("new records also work when a browser omits crypto.randomUUID", () => {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, "randomUUID");
  Object.defineProperty(crypto, "randomUUID", {
    value: undefined,
    configurable: true,
  });
  try {
    const first = newId(),
      second = newId();
    assert.match(
      first,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    assert.notEqual(first, second);
  } finally {
    if (descriptor) Object.defineProperty(crypto, "randomUUID", descriptor);
    else delete crypto.randomUUID;
  }
});
