import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  dateLabel,
  gross,
  money,
  paidMinutes,
  summary,
  type AppState,
  type Period,
  type Shift,
} from "./model.ts";

const W = 841.89,
  H = 595.28,
  M = 36;
const palette = {
  ink: rgb(0.16, 0.25, 0.21),
  muted: rgb(0.39, 0.46, 0.41),
  line: rgb(0.84, 0.88, 0.84),
  pale: rgb(0.94, 0.97, 0.93),
  accent: rgb(0.19, 0.36, 0.27),
  paper: rgb(0.98, 0.985, 0.975),
};
export type ReportRequest = {
  state: AppState;
  shifts: Shift[];
  period: Period;
  jobName: string;
};
export async function createTimesheetPdf(
  request: ReportRequest,
  regularBytes: Uint8Array,
  boldBytes: Uint8Array,
): Promise<Uint8Array> {
  const { state, period, jobName } = request,
    shifts = request.shifts
      .filter((s) => s.end !== null)
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
      );
  const totals = summary(request.shifts),
    currency = state.settings.currency;
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [regular, bold] = await Promise.all([
    doc.embedFont(regularBytes, { subset: false }),
    doc.embedFont(boldBytes, { subset: false }),
  ]);
  doc.setTitle(
    `MyHours - ${period.kind === "week" ? "Weekly" : "Monthly"} timesheet - ${period.label}`,
  );
  doc.setAuthor("Md Sohel Habib");
  doc.setCreator("MyHours - created by Md Sohel Habib (@sohel_habib)");
  doc.setSubject(`${jobName} - saved shift times and estimated gross earnings`);
  const characterSets = new Map<PDFFont, Set<number>>([
    [regular, new Set(regular.getCharacterSet())],
    [bold, new Set(bold.getCharacterSet())],
  ]);
  const safe = (value: string, font = regular) =>
    Array.from(value)
      .map((c) => {
        const cp = c.codePointAt(0)!;
        return cp < 32 ? " " : characterSets.get(font)!.has(cp) ? c : "?";
      })
      .join("");
  function text(
    page: PDFPage,
    value: string,
    x: number,
    top: number,
    size = 9,
    strong = false,
    color = palette.ink,
    right = false,
  ) {
    const font = strong ? bold : regular,
      str = safe(value, font);
    page.drawText(str, {
      x: right ? x - font.widthOfTextAtSize(str, size) : x,
      y: H - top - size,
      size,
      font,
      color,
    });
  }
  function box(
    page: PDFPage,
    x: number,
    top: number,
    width: number,
    height: number,
    color = palette.pale,
  ) {
    page.drawRectangle({ x, y: H - top - height, width, height, color });
  }
  function line(page: PDFPage, top: number) {
    page.drawLine({
      start: { x: M, y: H - top },
      end: { x: W - M, y: H - top },
      thickness: 0.6,
      color: palette.line,
    });
  }
  function wrap(
    value: string,
    width: number,
    size = 8.5,
    font = regular,
  ): string[] {
    const words = safe(value, font).split(/\s+/),
      lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? current + " " + word : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        current = candidate;
        continue;
      }
      if (current) {
        lines.push(current);
        current = "";
      }
      let piece = "";
      for (const char of word) {
        if (piece && font.widthOfTextAtSize(piece + char, size) > width) {
          lines.push(piece);
          piece = char;
        } else piece += char;
      }
      current = piece;
    }
    if (current || !lines.length) lines.push(current);
    return lines;
  }
  let page = doc.addPage([W, H]),
    y = 0;
  const reportName = `${period.kind === "week" ? "Weekly" : "Monthly"} timesheet`;
  function newPage(first = false) {
    if (!first) page = doc.addPage([W, H]);
    text(page, "MyHours", M, 25, 19, true, palette.accent);
    text(
      page,
      reportName.toUpperCase(),
      W - M,
      29,
      9,
      true,
      palette.muted,
      true,
    );
    if (first) {
      text(page, period.label, M, 65, 23, true);
      const prepared = state.settings.displayName
        ? `${state.settings.displayName}  |  ${jobName}`
        : jobName;
      text(page, prepared, M, 99, 10, false, palette.muted);
      box(page, M, 125, W - M * 2, 57);
      const blocks = [
        {
          label: "PAID TIME",
          value: `${(totals.minutes / 60).toFixed(2)} hours`,
        },
        { label: "ESTIMATED GROSS PAY", value: money(totals.gross, currency) },
        { label: "COMPLETED SHIFTS", value: String(totals.count) },
        { label: "UNPAID BREAKS", value: `${totals.breaks} minutes` },
      ];
      blocks.forEach((block, i) => {
        const x = M + 16 + i * ((W - M * 2) / 4);
        text(page, block.label, x, 136, 7.4, true, palette.muted);
        text(page, block.value, x, 150, 15, true, palette.accent);
      });
      y = 202;
    } else {
      text(
        page,
        `${period.label}  |  ${jobName}`,
        M,
        59,
        10,
        false,
        palette.muted,
      );
      y = 88;
    }
    return page;
  }
  const widths = [82, 158, 50, 62, 55, 67, 95, 100],
    columns = [
      "Shift date",
      "Job",
      "Start",
      "Finish",
      "Break",
      "Paid hours",
      "Rate / hour",
      "Gross pay",
    ];
  const lefts: number[] = [];
  widths.reduce((x, width) => {
    lefts.push(x);
    return x + width;
  }, M);
  function tableHeader() {
    box(page, M, y, W - M * 2, 26, palette.accent);
    columns.forEach((label, i) =>
      text(
        page,
        label,
        i >= 5 ? lefts[i] + widths[i] - 9 : lefts[i] + 9,
        y + 8,
        8,
        true,
        rgb(1, 1, 1),
        i >= 5,
      ),
    );
    y += 26;
  }
  function space(height: number, withTable = false) {
    if (y + height > H - 51) {
      newPage();
      if (withTable) tableHeader();
    }
  }
  newPage(true);
  tableHeader();
  if (!shifts.length) {
    text(
      page,
      "No completed shifts were recorded for this period.",
      M + 12,
      y + 18,
      11,
      false,
      palette.muted,
    );
    y += 57;
  }
  shifts.forEach((s, index) => {
    const job = state.jobs.find((j) => j.id === s.jobId),
      jobLines = wrap(job?.name || "Job", widths[1] - 18, 8.5);
    const noteLines = s.note ? wrap(`Note: ${s.note}`, W - M * 2 - 24, 8) : [];
    const rowHeight =
      Math.max(30, jobLines.length * 11 + 16) +
      (noteLines.length ? noteLines.length * 10 + 9 : 0);
    space(rowHeight, true);
    if (index % 2 === 0) box(page, M, y, W - M * 2, rowHeight, palette.paper);
    const values = [
      dateLabel(s.date, { day: "2-digit", month: "short", year: "numeric" }),
      "",
      s.start,
      `${s.end}${s.nextDay ? " (+1d)" : ""}`,
      `${s.unpaidBreak} min`,
      (paidMinutes(s) / 60).toFixed(2),
      money(s.rate, currency),
      money(gross(s), currency),
    ];
    values.forEach((value, i) => {
      if (i !== 1)
        text(
          page,
          value,
          i >= 5 ? lefts[i] + widths[i] - 9 : lefts[i] + 9,
          y + 10,
          i === 7 ? 9 : 8.3,
          i === 7,
          i === 7 ? palette.accent : palette.ink,
          i >= 5,
        );
    });
    jobLines.forEach((value, i) =>
      text(page, value, lefts[1] + 9, y + 10 + i * 11, 8.5),
    );
    const notesTop = y + Math.max(30, jobLines.length * 11 + 16) + 1;
    noteLines.forEach((value, i) =>
      text(page, value, M + 12, notesTop + i * 10, 8, false, palette.muted),
    );
    y += rowHeight;
    line(page, y);
  });
  const byJob = state.jobs
    .map((job) => ({
      job,
      value: summary(shifts.filter((s) => s.jobId === job.id)),
    }))
    .filter((row) => row.value.count > 0);
  const summaryHeight =
    26 +
    byJob.reduce(
      (height, row) =>
        height + Math.max(24, wrap(row.job.name, 380, 9).length * 12 + 8),
      0,
    ) +
    9 +
    47 +
    45 +
    (totals.open ? 15 : 0);
  y += 22;
  // Keep an ordinary job breakdown and its grand total together. Very large
  // breakdowns may still continue across pages using the row checks below.
  space(Math.min(summaryHeight, H - 51 - 88));
  text(page, "Totals by job", M, y, 13, true);
  y += 26;
  for (const row of byJob) {
    const names = wrap(row.job.name, 380, 9),
      rowHeight = Math.max(24, names.length * 12 + 8);
    space(rowHeight);
    names.forEach((name, i) => text(page, name, M, y + i * 12, 9));
    text(
      page,
      `${row.value.count} shift${row.value.count === 1 ? "" : "s"}`,
      W - 310,
      y,
      9,
      false,
      palette.muted,
    );
    text(
      page,
      `${(row.value.minutes / 60).toFixed(2)} h`,
      W - 180,
      y,
      9,
      false,
      palette.muted,
      true,
    );
    text(
      page,
      money(row.value.gross, currency),
      W - M,
      y,
      10,
      true,
      palette.accent,
      true,
    );
    y += rowHeight;
  }
  y += 9;
  space(66);
  box(page, M, y, W - M * 2, 35);
  text(
    page,
    "TOTAL ESTIMATED GROSS PAY",
    M + 12,
    y + 12,
    9,
    true,
    palette.accent,
  );
  text(
    page,
    money(totals.gross, currency),
    W - M - 12,
    y + 8,
    15,
    true,
    palette.accent,
    true,
  );
  y += 47;
  space(45);
  text(
    page,
    "Gross estimates are before tax, National Insurance, pension and other deductions. No overtime premiums are applied automatically.",
    M,
    y,
    8,
    false,
    palette.muted,
  );
  y += 13;
  text(
    page,
    `Times use ${state.settings.timeZone}. Overnight shifts belong to their start date. (+1d) means the following day.`,
    M,
    y,
    8,
    false,
    palette.muted,
  );
  y += 13;
  if (totals.open) {
    space(15);
    text(
      page,
      `${totals.open} unfinished shift(s) are excluded from hours and pay.`,
      M,
      y,
      8,
      false,
      palette.muted,
    );
  }
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    line(p, H - 34);
    text(
      p,
      "Created by Md Sohel Habib | Instagram: @sohel_habib",
      M,
      H - 26,
      7.5,
      false,
      palette.muted,
    );
    text(
      p,
      `${i + 1} / ${pages.length}`,
      W - M,
      H - 26,
      7.5,
      false,
      palette.muted,
      true,
    );
  });
  return doc.save();
}
