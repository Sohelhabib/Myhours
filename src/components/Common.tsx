import type { ReactNode } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coffee,
  Moon,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  addDays,
  dateLabel,
  gross,
  hoursLabel,
  money,
  paidMinutes,
  type AppState,
  type Job,
  type Period,
  type Shift,
} from "../lib/model.ts";

export function Creator() {
  return (
    <div className="creator">
      <span>
        Developed by <strong>Md Sohel Habib</strong>
      </span>
    </div>
  );
}
export function JobMark({
  job,
  small = false,
}: {
  job?: Job;
  small?: boolean;
}) {
  return (
    <span
      className={`job-mark colour-${job?.color || "mint"} ${small ? "small" : ""}`}
      aria-hidden="true"
    >
      <BriefcaseBusiness size={small ? 17 : 22} strokeWidth={1.7} />
    </span>
  );
}
export function WeekNav({
  period,
  onChange,
  today,
}: {
  period: Period;
  onChange: (date: string) => void;
  today: string;
}) {
  return (
    <div className="week-nav">
      <button
        type="button"
        className="icon-btn"
        onClick={() => onChange(addDays(period.start, -7))}
        aria-label="Previous week"
      >
        <ChevronLeft size={20} />
      </button>
      <div>
        <CalendarDays size={15} />
        <span>{period.short}</span>
      </div>
      <button
        type="button"
        className="icon-btn"
        onClick={() => onChange(addDays(period.start, 7))}
        aria-label="Next week"
      >
        <ChevronRight size={20} />
      </button>
      {today >= period.start && today <= period.end ? null : (
        <button
          className="text-button return-today"
          onClick={() => onChange(today)}
        >
          This week
        </button>
      )}
    </div>
  );
}
export function JobFilter({
  jobs,
  value,
  onChange,
}: {
  jobs: Job[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="job-filters" aria-label="Filter by job">
      <button
        className={value === "all" ? "filter-chip chosen" : "filter-chip"}
        aria-pressed={value === "all"}
        onClick={() => onChange("all")}
      >
        <BriefcaseBusiness size={14} />
        All jobs
      </button>
      {jobs.map((job) => (
        <button
          key={job.id}
          className={`filter-chip ${value === job.id ? "chosen" : ""}`}
          aria-pressed={value === job.id}
          onClick={() => onChange(job.id)}
        >
          <i className={`job-dot colour-${job.color}`} />
          {job.name}
          {job.archived ? " (archived)" : ""}
        </button>
      ))}
    </div>
  );
}
export function Empty({
  title,
  text,
  action,
  icon = <CalendarDays size={28} />,
}: {
  title: string;
  text: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-mark">{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function ShiftCards({
  shifts,
  state,
  onEdit,
  onDelete,
  showDate = true,
}: {
  shifts: Shift[];
  state: AppState;
  onEdit: (shift: Shift) => void;
  onDelete: (shift: Shift) => void;
  showDate?: boolean;
}) {
  return (
    <div className="shift-list">
      {shifts.map((shift) => {
        const job = state.jobs.find((j) => j.id === shift.jobId);
        return (
          <article key={shift.id} className="shift-card glass">
            <div className="shift-top">
              <JobMark job={job} small />
              <div className="shift-job">
                <strong>{job?.name || "Job"}</strong>
                {showDate ? (
                  <span>
                    {dateLabel(shift.date, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                ) : (
                  <span>{job?.role || "Recorded shift"}</span>
                )}
              </div>
              <div className="shift-earned">
                {shift.end === null ? (
                  <span className="open-badge">
                    <i />
                    In progress
                  </span>
                ) : (
                  <>
                    <strong>
                      {money(gross(shift), state.settings.currency)}
                    </strong>
                    <span>estimated gross</span>
                  </>
                )}
              </div>
            </div>
            <div className="shift-times">
              <div>
                <Clock3 size={15} />
                <span>
                  {shift.start}
                  <span className="time-separator">—</span>
                  {shift.end || "Not finished"}
                  {shift.nextDay ? (
                    <span className="next-day">
                      <Moon size={11} />
                      +1 day
                    </span>
                  ) : null}
                </span>
              </div>
              <span className="paid-badge">
                {shift.end === null
                  ? "Finish to calculate"
                  : hoursLabel(paidMinutes(shift))}
              </span>
            </div>
            <div className="shift-bottom">
              <span>
                <Coffee size={13} />
                {shift.unpaidBreak} min unpaid<span className="sep-dot">·</span>
                {money(shift.rate, state.settings.currency)}/hr
              </span>
              <div className="shift-actions">
                <button
                  className="icon-btn"
                  aria-label={`Edit ${job?.name || "job"} shift on ${shift.date}`}
                  onClick={() => onEdit(shift)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-btn danger-hover"
                  aria-label={`Delete ${job?.name || "job"} shift on ${shift.date}`}
                  onClick={() => onDelete(shift)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            {shift.note ? <p className="shift-note">{shift.note}</p> : null}
          </article>
        );
      })}
    </div>
  );
}
