import { readFile, writeFile, mkdir } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import assert from "node:assert/strict";
import { createTimesheetPdf } from "../src/lib/pdf.ts";
import {
  emptyState,
  reduceAction,
  getPeriod,
  selectShifts,
  summary,
} from "../src/lib/model.ts";
let state = emptyState();
state.settings = {
  displayName: "José Example",
  currency: "GBP",
  timeZone: "Europe/London",
};
for (const input of [
  {
    name: "Weekend café",
    role: "Barista",
    rate: 1350,
    defaultBreak: 30,
    color: "mint",
  },
  {
    name: "Independent design studio - an intentionally longer job name for wrapping",
    role: "Freelance",
    rate: 2200,
    defaultBreak: 0,
    color: "violet",
  },
])
  state = reduceAction(state, { type: "job/save", input });
for (let d = 1; d <= 31; d++)
  for (let j = 0; j < 2; j++)
    state = reduceAction(state, {
      type: "shift/save",
      input: {
        jobId: state.jobs[j].id,
        date: `2026-10-${String(d).padStart(2, "0")}`,
        start: j ? "18:00" : "09:00",
        end: j ? "22:00" : "17:00",
        nextDay: false,
        unpaidBreak: j ? 0 : 30,
        rate: state.jobs[j].rate,
        note:
          d % 4 === 0
            ? "A detailed note to verify wrapping and page breaks. This entry records agreed hours, with an unpaid break already deducted from paid time. ".repeat(
                2,
              )
            : "",
      },
    });
const regular = new Uint8Array(
    await readFile(new URL("../public/fonts/DejaVuSans.ttf", import.meta.url)),
  ),
  bold = new Uint8Array(
    await readFile(
      new URL("../public/fonts/DejaVuSans-Bold.ttf", import.meta.url),
    ),
  );
await mkdir(new URL("../qa/", import.meta.url), { recursive: true });
for (const kind of ["week", "month"]) {
  const period = getPeriod(kind, "2026-10-19"),
    shifts = selectShifts(state, period),
    bytes = await createTimesheetPdf(
      { state, shifts, period, jobName: "All jobs / QA sample data" },
      regular,
      bold,
    );
  const path = new URL(`../qa/${kind}-timesheet.pdf`, import.meta.url);
  await writeFile(path, bytes);
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() >= 1);
  assert.equal(pdf.getAuthor(), "Md Sohel Habib");
  const total = summary(shifts);
  console.log(
    JSON.stringify({
      kind,
      pages: pdf.getPageCount(),
      shifts: shifts.length,
      paidMinutes: total.minutes,
      grossCents: total.gross,
      bytes: bytes.length,
    }),
  );
}
