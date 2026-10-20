import {
  PDFDocument,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
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

export type ReportRequest = {
  state: AppState;
  shifts: Shift[];
  period: Period;
  jobName: string;
  includePay?: boolean;
};

export async function createTimesheetPdf(
  request: ReportRequest,
  regularBytes: Uint8Array,
  boldBytes: Uint8Array,
): Promise<Uint8Array> {
  const { state, period, jobName, includePay = true } = request;

  const shifts = request.shifts
    .filter((s) => s.end !== null)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.start.localeCompare(b.start),
    );

  const total = summary(request.shifts);
  const currency = state.settings.currency;
  const name = state.settings.displayName.trim();

  const W = 841.89;
  const H = 595.28;
  const M = 36;
  const inner = W - M * 2;

  const ink = rgb(.16, .25, .21);
  const muted = rgb(.39, .46, .41);
  const green = rgb(.19, .36, .27);
  const pale = rgb(.94, .97, .93);
  const rule = rgb(.84, .88, .84);
  const white = rgb(1, 1, 1);

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const regular = await doc.embedFont(
    regularBytes,
    { subset: false },
  );
  const bold = await doc.embedFont(
    boldBytes,
    { subset: false },
  );

  doc.setTitle(
    `MyHours - ${period.label} - ${
      includePay ? "Hours and pay" : "Hours only"
    }`,
  );
  doc.setAuthor(name || "MyHours user");
  doc.setCreator("MyHours - Developed by Md Sohel Habib");
  doc.setSubject(
    `${jobName} - ${
      includePay
        ? "shift times and estimated gross pay"
        : "shift times and paid hours"
    }`,
  );

  const sets = new Map<PDFFont, Set<number>>([
    [regular, new Set(regular.getCharacterSet())],
    [bold, new Set(bold.getCharacterSet())],
  ]);

  const safe = (value: string, font = regular) =>
    Array.from(value)
      .map((c) => {
        const cp = c.codePointAt(0)!;
        return cp < 32
          ? " "
          : sets.get(font)!.has(cp)
            ? c
            : "?";
      })
      .join("");

  function text(
    p: PDFPage,
    value: string,
    x: number,
    top: number,
    size = 9,
    strong = false,
    right = false,
    color = ink,
  ) {
    const font = strong ? bold : regular;
    const str = safe(value, font);
    p.drawText(str, {
      x: right ? x - font.widthOfTextAtSize(str, size) : x,
      y: H - top - size,
      size,
      font,
      color,
    });
  }

  function wrap(
    value: string,
    width: number,
    size = 9,
  ): string[] {
    const lines: string[] = [];
    let current = "";

    for (const word of safe(value).split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;

      if (regular.widthOfTextAtSize(candidate, size) <= width) {
        current = candidate;
        continue;
      }

      if (current) lines.push(current);
      current = "";

      for (const c of word) {
        if (
          current &&
          regular.widthOfTextAtSize(current + c, size) > width
        ) {
          lines.push(current);
          current = "";
        }
        current += c;
      }
    }

    if (current || !lines.length) lines.push(current);
    return lines;
  }

  function box(
    p: PDFPage,
    top: number,
    height: number,
    color = pale,
  ) {
    p.drawRectangle({
      x: M,
      y: H - top - height,
      width: inner,
      height,
      color,
    });
  }

  function line(p: PDFPage, top: number) {
    p.drawLine({
      start: { x: M, y: H - top },
      end: { x: W - M, y: H - top },
      thickness: .6,
      color: rule,
    });
  }

  let page = doc.addPage([W, H]);
  let y = 0;

  function header(first = false) {
    if (!first) page = doc.addPage([W, H]);

    text(page, "MyHours", M, 25, 19, true, false, green);
    text(
      page,
      `${period.kind === "week" ? "WEEKLY" : "MONTHLY"} TIMESHEET`,
      W - M, 29, 9, true, true, muted,
    );
    text(
      page, period.label, M,
      first ? 65 : 59,
      first ? 22 : 11,
      first,
    );

    y = first ? 98 : 78;

    for (const value of [
      name ? `Name: ${name}` : "",
      jobName,
    ].filter(Boolean)) {
      for (const row of wrap(value, inner, 10)) {
        text(page, row, M, y, 10, false, false, muted);
        y += 14;
      }
    }

    y += 10;

    if (first) {
      const blocks = [
        {
          label: "PAID HOURS",
          value: (total.minutes / 60).toFixed(2),
        },
        ...(includePay
          ? [{
              label: "ESTIMATED GROSS PAY",
              value: money(total.gross, currency),
            }]
          : []),
        {
          label: "COMPLETED SHIFTS",
          value: String(total.count),
        },
        {
          label: "UNPAID BREAKS",
          value: `${total.breaks} minutes`,
        },
      ];

      box(page, y, 55);

      blocks.forEach((block, i) => {
        const x = M + 14 + i * inner / blocks.length;
        text(
          page, block.label, x, y + 10,
          7.5, true, false, muted,
        );
        text(
          page, block.value, x, y + 25,
          15, true, false, green,
        );
      });

      y += 73;
    }
  }

  const widths = includePay
    ? [88, 204, 54, 78, 62, 78, 95, inner - 659]
    : [100, 290, 70, 95, 90, inner - 645];

  const labels = [
    "Shift date", "Job", "Start", "Finish", "Break", "Paid hours",
    ...(includePay ? ["Rate / hour", "Gross pay"] : []),
  ];

  const lefts: number[] = [];
  widths.reduce((x, width) => {
    lefts.push(x);
    return x + width;
  }, M);

  function tableHeader() {
    box(page, y, 26, green);

    labels.forEach((label, i) =>
      text(
        page,
        label,
        i >= 5 ? lefts[i] + widths[i] - 9 : lefts[i] + 9,
        y + 8,
        8,
        true,
        i >= 5,
        white,
      ),
    );
    y += 26;
  }

  function space(height: number, withTable = false) {
    if (y + height > H - 51) {
      header();
      if (withTable) tableHeader();
    }
  }

  header(true);
  tableHeader();

  if (!shifts.length) {
    text(
      page,
      "No completed shifts were recorded for this period.",
      M + 10,
      y + 16,
    );
    y += 45;
  }

  shifts.forEach((s, index) => {
    const job = state.jobs.find((j) => j.id === s.jobId);
    const names = wrap(job?.name || "Job", widths[1] - 18, 8.5);
    const notes = s.note
      ? wrap(`Note: ${s.note}`, inner - 24, 8)
      : [];

    const mainHeight = Math.max(30, names.length * 11 + 16);
    const height =
      mainHeight + (notes.length ? notes.length * 10 + 9 : 0);

    space(height, true);

    if (index % 2 === 0) {
      box(page, y, height, rgb(.98, .985, .975));
    }

    const values = [
      dateLabel(s.date, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      "",
      s.start,
      `${s.end}${s.nextDay ? " (+1d)" : ""}`,
      `${s.unpaidBreak} min`,
      (paidMinutes(s) / 60).toFixed(2),
      ...(includePay
        ? [money(s.rate, currency), money(gross(s), currency)]
        : []),
    ];

    values.forEach((value, i) => {
      if (i !== 1) {
        text(
          page,
          value,
          i >= 5 ? lefts[i] + widths[i] - 9 : lefts[i] + 9,
          y + 10,
          8.3,
          includePay && i === 7,
          i >= 5,
        );
      }
    });

    names.forEach((row, i) =>
      text(page, row, lefts[1] + 9, y + 10 + i * 11, 8.5),
    );
    notes.forEach((row, i) =>
      text(
        page, row, M + 12,
        y + mainHeight + 1 + i * 10,
        8, false, false, muted,
      ),
    );

    y += height;
    line(page, y);
  });

  const nameWidth = includePay ? 360 : 465;

  const jobs = state.jobs
    .map((job) => ({
      job,
      total: summary(shifts.filter((s) => s.jobId === job.id)),
    }))
    .filter((row) => row.total.count);

  const summaryHeight =
    26 +
    jobs.reduce(
      (height, row) =>
        height +
        Math.max(24, wrap(row.job.name, nameWidth).length * 12 + 8),
      0,
    ) +
    110;

  y += 20;
  space(Math.min(summaryHeight, 390));
  text(page, "Totals by job", M, y, 13, true);
  y += 26;

  for (const row of jobs) {
    const names = wrap(row.job.name, nameWidth);
    const height = Math.max(24, names.length * 12 + 8);
    space(height);

    names.forEach((value, i) =>
      text(page, value, M, y + i * 12),
    );

    text(
      page,
      `${row.total.count} shifts`,
      includePay ? W - 310 : W - 210,
      y, 9, false, false, muted,
    );

    text(
      page,
      `${(row.total.minutes / 60).toFixed(2)} h`,
      includePay ? W - 180 : W - M,
      y, 9, false, true,
    );

    if (includePay) {
      text(
        page,
        money(row.total.gross, currency),
        W - M, y, 10, true, true, green,
      );
    }

    y += height;
  }

  y += 8;
  space(includePay ? 85 : 72);
  box(page, y, 35);

  text(
    page,
    includePay ? "TOTAL ESTIMATED GROSS PAY" : "TOTAL PAID HOURS",
    M + 12, y + 12, 9, true, false, green,
  );

  text(
    page,
    includePay
      ? money(total.gross, currency)
      : `${(total.minutes / 60).toFixed(2)} hours`,
    W - M - 12, y + 8, 15, true, true, green,
  );

  y += 47;

  if (includePay) {
    text(
      page,
      "Gross estimates are before tax and other deductions. Overtime premiums are not added automatically.",
      M, y, 8, false, false, muted,
    );
    y += 13;
  }

  text(
    page,
    `Times use ${state.settings.timeZone}. Overnight shifts belong to their start date. (+1d) means the following day.`,
    M, y, 8, false, false, muted,
  );

  if (total.open) {
    y += 14;
    space(15);
    text(
      page,
      `${total.open} unfinished shift(s) are excluded from this report.`,
      M, y, 8, false, false, muted,
    );
  }

  const pages = doc.getPages();

  pages.forEach((p, i) => {
    line(p, H - 34);
    text(
      p,
      "Developed by Md Sohel Habib",
      M, H - 26, 7.5, false, false, muted,
    );
    text(
      p,
      `${i + 1} / ${pages.length}`,
      W - M, H - 26, 7.5, false, true, muted,
    );
  });

  return doc.save();
}