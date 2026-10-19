import {
  ArrowDownToLine,
  CalendarDays,
  Check,
  FileText,
  LoaderCircle,
  Wallet,
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
}: {
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
  onPdf: (period: Period, shifts: Shift[]) => void;
  onCsv: (period: Period, shifts: Shift[]) => void;
}) {
  const period = getPeriod(kind, kind === "week" ? anchor : month + "-01"),
    shifts = selectShifts(state, period, jobId, true),
    total = summary(shifts);
  const jobName =
    jobId === "all"
      ? "All jobs"
      : state.jobs.find((j) => j.id === jobId)?.name || "Job";
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">EVERY HOUR, IN ONE PLACE</span>
          <h1>
            Your time.<span> On record.</span>
          </h1>
          <p>A weekly or monthly timesheet, ready to save or share.</p>
        </div>
      </div>
      <JobFilter jobs={state.jobs} value={jobId} onChange={onJob} />
      <div className="report-layout">
        <section className="glass report-builder">
          <div className="segmented" aria-label="Report period">
            <button
              className={kind === "week" ? "selected" : ""}
              aria-pressed={kind === "week"}
              onClick={() => onKind("week")}
            >
              <CalendarDays size={16} />
              Weekly
            </button>
            <button
              className={kind === "month" ? "selected" : ""}
              aria-pressed={kind === "month"}
              onClick={() => onKind("month")}
            >
              <CalendarDays size={16} />
              Monthly
            </button>
          </div>
          {kind === "week" ? (
            <WeekNav period={period} onChange={onAnchor} today={day} />
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
                  if (validDate(e.target.value + "-01"))
                    onMonth(e.target.value);
                }}
              />
            </label>
          )}
          <div className="paper-preview">
            <div className="paper-brand">
              <span>
                MyHours<span className="brand-dot">.</span>
              </span>
              <FileText size={19} />
            </div>
            <span className="paper-label">
              {kind.toUpperCase()}LY TIMESHEET
            </span>
            <h2>{period.short}</h2>
            <p>
              {state.settings.displayName
                ? state.settings.displayName + " · "
                : ""}
              {jobName}
            </p>
            <div className="paper-totals">
              <div>
                <span>Paid hours</span>
                <strong>{hoursLabel(total.minutes)}</strong>
              </div>
              <div>
                <span>Estimated gross</span>
                <strong>{money(total.gross, state.settings.currency)}</strong>
              </div>
            </div>
            <div className="paper-lines" aria-hidden="true">
              <span>Shift date</span>
              <span>Time</span>
              <span>Hours</span>
              <span>Pay</span>
              {[0, 1, 2].map((i) => (
                <div className="paper-line" key={i}>
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              ))}
            </div>
            <span className="paper-footer">
              {total.count} completed shift{total.count === 1 ? "" : "s"} · One
              PDF for the whole {kind === "week" ? "week" : "month"}
            </span>
          </div>
          <button
            className="btn primary full"
            disabled={busy || !total.count}
            onClick={() => onPdf(period, shifts)}
          >
            {busy ? (
              <LoaderCircle className="spin" size={19} />
            ) : (
              <ArrowDownToLine size={19} />
            )}
            {busy ? "Preparing your PDF…" : "Create PDF timesheet"}
          </button>
          <button
            className="text-button csv-button"
            disabled={busy || !total.count}
            onClick={() => onCsv(period, shifts)}
          >
            Export a CSV instead <ArrowDownToLine size={14} />
          </button>
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
        </section>
        <aside className="report-explanation glass">
          <span className="eyebrow">THE DETAILS THAT MATTER</span>
          <h2>
            A clear picture.
            <br />
            All in one PDF.
          </h2>
          <p>
            Each report includes your selected jobs, with the details behind
            every total.
          </p>
          <ul>
            {[
              "Shift dates and job names",
              "Start and finish times, including overnight shifts",
              "Unpaid breaks and paid hours",
              "Saved hourly rate and gross pay for each shift",
              "Per-job breakdown and combined totals",
            ].map((t) => (
              <li key={t}>
                <span>
                  <Check size={14} />
                </span>
                {t}
              </li>
            ))}
          </ul>
          <div className="gross-note">
            <Wallet size={20} />
            <p>
              Pay is an estimate before tax, National Insurance, pension and
              other deductions. Compare it with your payslip.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
