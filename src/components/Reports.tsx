import { useState } from "react";
import {
  ArrowDownToLine,
  CalendarDays,
  Check,
  FileText,
  LoaderCircle,
} from "lucide-react";

import {
  getPeriod,
  hoursLabel,
  money,
  selectShifts,
  summary,
  validDate,
  type AppState,
  type Period,
  type Shift,
} from "../lib/model.ts";

import { JobFilter, WeekNav } from "./Common.tsx";

type ReportsProps = {
  state: AppState;
  day: string;
  kind: Period["kind"];
  anchor: string;
  month: string;
  jobId: string;
  busy: boolean;
  onKind: (kind: Period["kind"]) => void;
  onAnchor: (date: string) => void;
  onMonth: (month: string) => void;
  onJob: (id: string) => void;
  onPdf: (
    period: Period,
    shifts: Shift[],
    options: { name: string; includePay: boolean },
  ) => void;
  onCsv: (period: Period, shifts: Shift[]) => void;
};

export default function Reports({
  state,
  day,
  kind,
  anchor,
  month,
  jobId,
  busy,
  onKind,
  onAnchor,
  onMonth,
  onJob,
  onPdf,
  onCsv,
}: ReportsProps) {
  const [name, setName] = useState(state.settings.displayName);
  const [includePay, setIncludePay] = useState(true);

  const period = getPeriod(
    kind,
    kind === "week" ? anchor : month + "-01",
  );
  const shifts = selectShifts(state, period, jobId, true);
  const total = summary(shifts);
  const jobName =
    jobId === "all"
      ? "All jobs"
      : state.jobs.find((j) => j.id === jobId)?.name || "Job";

  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">EVERY HOUR, IN ONE PLACE</span>
          <h1>Your time.<span> On record.</span></h1>
          <p>A weekly or monthly timesheet, ready to save or share.</p>
        </div>
      </div>

      <JobFilter
        jobs={state.jobs}
        value={jobId}
        onChange={onJob}
      />

      <div className="report-layout">
        <section className="glass report-builder">
          <div className="segmented" aria-label="Report period">
            {(["week", "month"] as const).map((value) => (
              <button
                key={value}
                className={kind === value ? "selected" : ""}
                aria-pressed={kind === value}
                onClick={() => onKind(value)}
                disabled={busy}
              >
                <CalendarDays size={16} />
                {value === "week" ? "Weekly" : "Monthly"}
              </button>
            ))}
          </div>

          {kind === "week" ? (
            <WeekNav
              period={period}
              today={day}
              onChange={onAnchor}
            />
          ) : (
            <label className="month-picker">
              Choose month
              <input
                type="month"
                required
                min="2000-01"
                max="2100-12"
                aria-label="Report month"
                value={month}
                onChange={(e) => {
                  if (validDate(e.target.value + "-01")) {
                    onMonth(e.target.value);
                  }
                }}
              />
            </label>
          )}

          <div className="report-options form-stack">
            <label>
              Your name on the PDF
              <input
                autoComplete="name"
                maxLength={80}
                required
                disabled={busy}
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <p className="form-hint">
              Your name is saved on this device when you create a report.
            </p>

            <fieldset
              className="pdf-format-options"
              disabled={busy}
            >
              <legend>What should the PDF include?</legend>

              <label
                className={
                  includePay ? "pdf-format selected" : "pdf-format"
                }
              >
                <input
                  type="radio"
                  name="pdf-format"
                  checked={includePay}
                  onChange={() => setIncludePay(true)}
                />
                <span>
                  <strong>Hours and pay</strong>
                  <small>
                    Shift times, breaks, hourly rates and gross earnings
                  </small>
                </span>
              </label>

              <label
                className={
                  !includePay ? "pdf-format selected" : "pdf-format"
                }
              >
                <input
                  type="radio"
                  name="pdf-format"
                  checked={!includePay}
                  onChange={() => setIncludePay(false)}
                />
                <span>
                  <strong>Hours only</strong>
                  <small>
                    Shift times, breaks and paid hours,
                    without rates or pay amounts
                  </small>
                </span>
              </label>
            </fieldset>
          </div>

          <div className="paper-preview">
            <div className="paper-brand">
              <span>
                MyHours<span className="brand-dot">.</span>
              </span>
              <FileText size={19} />
            </div>

            <span className="paper-label">
              {kind.toUpperCase()}LY TIMESHEET ·{" "}
              {includePay ? "HOURS AND PAY" : "HOURS ONLY"}
            </span>

            <h2>{period.short}</h2>
            <p>{name.trim() || "Your name"} · {jobName}</p>

            <div className="paper-totals">
              <div>
                <span>Paid hours</span>
                <strong>{hoursLabel(total.minutes)}</strong>
              </div>
              {includePay ? (
                <div>
                  <span>Estimated gross</span>
                  <strong>
                    {money(total.gross, state.settings.currency)}
                  </strong>
                </div>
              ) : null}
            </div>

            <p className="form-hint">
              {total.count} completed shifts · One PDF for the whole{" "}
              {kind === "week" ? "week" : "month"}
            </p>
            <p className="form-hint">
              Developed by Md Sohel Habib
            </p>
          </div>

          <button
            className="btn primary full"
            disabled={busy || !total.count || !name.trim()}
            onClick={() =>
              onPdf(period, shifts, {
                name: name.trim(),
                includePay,
              })
            }
          >
            {busy ? (
              <LoaderCircle className="spin" size={19} />
            ) : (
              <ArrowDownToLine size={19} />
            )}
            {busy
              ? "Preparing your PDF…"
              : `Create ${includePay ? "hours and pay" : "hours only"} PDF`}
          </button>

          {!name.trim() ? (
            <p className="form-hint centered">
              Enter your name above to create your PDF.
            </p>
          ) : null}

          {!total.count ? (
            <p className="form-hint centered">
              Add or finish a shift in this period to create a report.
            </p>
          ) : null}

          {total.open ? (
            <p className="form-hint centered">
              {total.open} unfinished shift(s) will be excluded.
            </p>
          ) : null}

          <button
            className="text-button csv-button"
            disabled={busy || !total.count}
            onClick={() => onCsv(period, shifts)}
          >
            Export CSV with hours and pay
            <ArrowDownToLine size={14} />
          </button>
        </section>

        <aside className="report-explanation glass">
          <span className="eyebrow">YOUR REPORT, YOUR CHOICE</span>
          <h2>A clear picture.<br />All in one PDF.</h2>
          <p>
            {includePay
              ? "A full record of your hours and estimated gross earnings."
              : "A record of your working hours with hourly rates and pay amounts left out."}
          </p>

          <ul>
            {[
              "Your name and selected period",
              "Shift dates and job names",
              "Start and finish times, including overnight shifts",
              "Unpaid breaks and paid hours",
              ...(includePay
                ? ["Saved hourly rates and gross pay"]
                : []),
              "Per-job and overall totals",
            ].map((item) => (
              <li key={item}>
                <span><Check size={14} /></span>
                {item}
              </li>
            ))}
          </ul>

          <p className="form-hint">
            {includePay
              ? "Earnings are estimates before tax and other deductions."
              : "Choosing hours only does not change your saved rates or earnings."}
          </p>
        </aside>
      </div>
    </>
  );
}