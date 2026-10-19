import {
  ArrowDownToLine,
  ArrowRight,
  BriefcaseBusiness,
  Clock3,
  Plus,
  Sparkles,
  Wallet,
} from "lucide-react";
import {
  addDays,
  dateLabel,
  decimalHours,
  getPeriod,
  hoursLabel,
  money,
  selectShifts,
  summary,
  type AppState,
  type Job,
  type Shift,
} from "../lib/model.ts";
import { Empty, JobFilter, JobMark, ShiftCards, WeekNav } from "./Common.tsx";
export default function Home({
  state,
  day,
  anchor,
  selectedDay,
  jobId,
  onJob,
  onWeek,
  onDay,
  onAddJob,
  onAddShift,
  onStartShift,
  onEdit,
  onDelete,
  onReports,
  onDemo,
  isDemo,
}: {
  state: AppState;
  day: string;
  anchor: string;
  selectedDay: string;
  jobId: string;
  onJob: (id: string) => void;
  onWeek: (date: string) => void;
  onDay: (date: string) => void;
  onAddJob: () => void;
  onAddShift: () => void;
  onStartShift: () => void;
  onEdit: (shift: Shift) => void;
  onDelete: (shift: Shift) => void;
  onReports: () => void;
  onDemo: () => void;
  isDemo: boolean;
}) {
  const period = getPeriod("week", anchor),
    selected = selectShifts(state, period, jobId, true),
    total = summary(selected),
    active = state.shifts.filter(
      (s) => s.end === null && (jobId === "all" || s.jobId === jobId),
    );
  const dayShifts = state.shifts
      .filter(
        (s) => s.date === selectedDay && (jobId === "all" || s.jobId === jobId),
      )
      .sort((a, b) => a.start.localeCompare(b.start)),
    daily = summary(dayShifts),
    activeJobs = state.jobs.filter((j) => !j.archived);
  const byJob = state.jobs
    .map((job) => ({
      job,
      total: summary(selected.filter((s) => s.jobId === job.id)),
    }))
    .filter((j) => j.total.count > 0);
  if (!state.jobs.length)
    return (
      <div className="welcome-layout">
        <section className="glass welcome-card">
          <span className="eyebrow">A LITTLE CLARITY FOR YOUR WORKDAY</span>
          <h1>
            Your time.
            <br />
            <span>Your possibilities.</span>
          </h1>
          <p>
            One job or a few. Keep your shifts, paid hours and earnings
            together, wherever work takes you.
          </p>
          <div className="welcome-clock" aria-hidden="true">
            <div className="clock-orbit" />
            <div className="glass-clock">
              <span className="clock-twelve">12</span>
              <span className="clock-six">6</span>
              <span className="hand-hour" />
              <span className="hand-minute" />
              <span className="clock-pin" />
            </div>
            <span className="floating-pay">
              <Wallet size={16} />
              Your hours, adding up.
            </span>
          </div>
          <button className="btn primary full" onClick={onAddJob}>
            <Plus size={19} />
            Add your first job
          </button>
          {!isDemo ? (
            <button className="text-button demo-link" onClick={onDemo}>
              <Sparkles size={15} />
              Explore with sample data
            </button>
          ) : null}
          <div className="welcome-features">
            <span>
              <BriefcaseBusiness size={16} />
              Multiple jobs
            </span>
            <span>
              <Clock3 size={16} />
              Manual times
            </span>
            <span>
              <ArrowDownToLine size={16} />
              PDF reports
            </span>
          </div>
        </section>
        <section className="glass quiet-card">
          <span className="label-pill">YOUR HOURS, YOUR WAY</span>
          <h2>Made for real working days.</h2>
          <p>
            Set a rate for each job. Enter your times, deduct unpaid breaks, and
            see what each shift earns.
          </p>
          <p>
            Change your own entries whenever you need to. Your totals update
            along with them.
          </p>
        </section>
      </div>
    );
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">
            {state.settings.displayName
              ? `HELLO, ${state.settings.displayName.toUpperCase()}`
              : "A LITTLE CLARITY FOR YOUR WORKDAY"}
          </span>
          <h1>
            Your hours,<span> in balance.</span>
          </h1>
          <p>A clear view of your time and what it earns.</p>
        </div>
        <button className="btn primary desktop-add" onClick={onAddShift}>
          <Plus size={18} />
          Add a shift
        </button>
      </div>
      <JobFilter jobs={state.jobs} value={jobId} onChange={onJob} />
      {active.length ? (
        <section className="active-shifts">
          {active.map((s) => (
            <div key={s.id} className="glass active-shift">
              <span className="active-indicator">
                <Clock3 size={21} />
              </span>
              <div>
                <span className="eyebrow">SHIFT IN PROGRESS</span>
                <strong>
                  {state.jobs.find((j) => j.id === s.jobId)?.name}
                </strong>
                <p>
                  Started {s.start}
                  {s.date !== day ? ` on ${dateLabel(s.date)}` : ""} · finish
                  time is yours to enter
                </p>
              </div>
              <button className="btn primary small" onClick={() => onEdit(s)}>
                Finish shift <ArrowRight size={15} />
              </button>
            </div>
          ))}
        </section>
      ) : null}
      <section className="week-section">
        <div className="section-heading">
          <h2>Your week at a glance</h2>
          <button className="text-button" onClick={onReports}>
            Get a report <ArrowRight size={14} />
          </button>
        </div>
        <WeekNav period={period} today={day} onChange={onWeek} />
        <div className="stats-grid">
          <section className="glass stat-card">
            <div className="stat-label">
              <Clock3 size={17} />
              Paid hours
            </div>
            <strong>
              {decimalHours(total.minutes)}
              <small> hrs</small>
            </strong>
            <span>
              {total.count} completed shift{total.count === 1 ? "" : "s"}
            </span>
          </section>
          <section className="glass stat-card money-stat">
            <div className="stat-label">
              <Wallet size={17} />
              Estimated earnings
            </div>
            <strong>{money(total.gross, state.settings.currency)}</strong>
            <span>Gross pay · before deductions</span>
          </section>
        </div>
        <div className="glass day-strip" aria-label="View hours by day">
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(period.start, i),
              t = summary(selected.filter((s) => s.date === d));
            return (
              <button
                key={d}
                className={`day-button ${selectedDay === d ? "chosen" : ""} ${day === d ? "is-today" : ""}`}
                aria-pressed={selectedDay === d}
                aria-label={`${dateLabel(d, { weekday: "long", day: "numeric", month: "long" })}, ${hoursLabel(t.minutes)}, ${money(t.gross, state.settings.currency)}`}
                onClick={() => onDay(d)}
              >
                <span>{dateLabel(d, { weekday: "short" })}</span>
                <strong>{dateLabel(d, { day: "2-digit" })}</strong>
                <div className="day-bar-track">
                  <i
                    style={{
                      height: t.minutes
                        ? `${Math.max(8, Math.min(100, (t.minutes / 720) * 100))}%`
                        : "3px",
                    }}
                  />
                </div>
                <small>{t.minutes ? decimalHours(t.minutes) + "h" : "—"}</small>
              </button>
            );
          })}
        </div>
      </section>
      <div className="home-columns">
        <section className="day-section">
          <div className="section-heading">
            <h2>
              {selectedDay === day
                ? "Today"
                : dateLabel(selectedDay, { weekday: "long" })}
              <span className="section-date">{dateLabel(selectedDay)}</span>
            </h2>
            <span className="count-pill">
              {dayShifts.length} shift{dayShifts.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="glass daily-total">
            <div>
              <span>Paid time</span>
              <strong>{hoursLabel(daily.minutes)}</strong>
            </div>
            <span className="daily-divider" />
            <div>
              <span>Estimated gross</span>
              <strong>{money(daily.gross, state.settings.currency)}</strong>
            </div>
          </div>
          {dayShifts.length ? (
            <ShiftCards
              shifts={dayShifts}
              state={state}
              onEdit={onEdit}
              onDelete={onDelete}
              showDate={false}
            />
          ) : (
            <div className="glass">
              <Empty
                title="A little room in your day."
                text="Add a shift for this date to see your daily hours and earnings."
                action={
                  <button className="text-button" onClick={onAddShift}>
                    <Plus size={15} />
                    Add a shift
                  </button>
                }
              />
            </div>
          )}
          <div className="quick-actions">
            <button className="btn primary" onClick={onAddShift}>
              <Plus size={18} />
              Add a shift
            </button>
            <button
              className="btn secondary"
              onClick={onStartShift}
              disabled={!activeJobs.length}
            >
              <Clock3 size={18} />
              Start a shift
            </button>
          </div>
        </section>
        <section className="job-summary glass">
          <div className="section-heading">
            <h2>Across your jobs</h2>
            <span className="label-pill">THIS WEEK</span>
          </div>
          {byJob.length ? (
            byJob.map(({ job, total: t }) => (
              <button
                className="job-summary-row"
                key={job.id}
                onClick={() => onJob(job.id)}
              >
                <JobMark job={job} small />
                <div>
                  <strong>{job.name}</strong>
                  <span>
                    {hoursLabel(t.minutes)} · {t.count} shift
                    {t.count === 1 ? "" : "s"}
                  </span>
                </div>
                <strong>{money(t.gross, state.settings.currency)}</strong>
              </button>
            ))
          ) : (
            <p className="muted job-summary-empty">
              A breakdown appears as you finish shifts.
            </p>
          )}
          <div className="summary-note">
            <span>Unpaid breaks already deducted.</span>
            <span>
              {total.open
                ? `${total.open} open shift(s) excluded from totals.`
                : "Each shift keeps its recorded hourly rate."}
            </span>
          </div>
          <button className="text-button" onClick={onAddJob}>
            <Plus size={15} />
            Add another job
          </button>
        </section>
      </div>
    </>
  );
}
