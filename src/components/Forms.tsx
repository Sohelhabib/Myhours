import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  Clock3,
  Coffee,
  LoaderCircle,
  Moon,
  Wallet,
} from "lucide-react";
import Modal from "./Modal.tsx";
import {
  COLORS,
  CURRENCIES,
  gross,
  hoursLabel,
  money,
  paidMinutes,
  timeNow,
  validateJob,
  validateShift,
  type AppState,
  type Currency,
  type Job,
  type JobColor,
  type JobInput,
  type Settings,
  type Shift,
  type ShiftInput,
} from "../lib/model.ts";

export function JobForm({
  job,
  currency,
  busy,
  error,
  onClose,
  onSave,
  onArchive,
  onDelete,
  canDelete,
}: {
  job?: Job;
  currency: Currency;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (job: JobInput) => Promise<void>;
  onArchive?: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
}) {
  const [name, setName] = useState(job?.name || ""),
    [role, setRole] = useState(job?.role || ""),
    [rate, setRate] = useState(job ? (job.rate / 100).toFixed(2) : ""),
    [breaks, setBreaks] = useState(String(job?.defaultBreak || 0)),
    [color, setColor] = useState<JobColor>(job?.color || "mint"),
    [localError, setLocalError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setLocalError("");
    try {
      await onSave(
        validateJob({
          name,
          role,
          rate: Math.round(Number(rate) * 100),
          defaultBreak: Number(breaks),
          color,
        }),
      );
    } catch (e) {
      setLocalError((e as Error).message);
    }
  }
  return (
    <Modal
      title={job ? "Make this job yours." : "A new place for your hours."}
      subtitle={
        job
          ? "Changes to the default rate apply to new shifts. Saved shifts keep their own rate."
          : "Any job, any employer. Set the details once, then start logging."
      }
      busy={busy}
      onClose={onClose}
    >
      <form onSubmit={submit} className="form-stack">
        <label>
          Job name
          <input
            autoComplete="organization"
            autoFocus
            required
            maxLength={80}
            placeholder="e.g. Weekend café"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Role or label <span className="optional">optional</span>
          <input
            maxLength={60}
            placeholder="e.g. Barista, freelance, evening shifts"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            Hourly pay rate <span className="optional">{currency}</span>
            <input
              aria-label="Hourly pay rate"
              inputMode="decimal"
              type="number"
              min="0"
              max="10000"
              step="0.01"
              required
              placeholder="13.00"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </label>
          <label>
            Default unpaid break
            <span className="optional">minutes per shift</span>
            <input
              inputMode="numeric"
              type="number"
              min="0"
              max="600"
              step="1"
              required
              value={breaks}
              onChange={(e) => setBreaks(e.target.value)}
            />
          </label>
        </div>
        <p className="form-hint">
          Both the rate and unpaid break can be changed on each shift.
        </p>
        <fieldset className="colour-field">
          <legend>Give it a colour</legend>
          <div className="colour-options">
            {COLORS.map((c) => (
              <label
                key={c}
                className={`colour-choice colour-${c} ${color === c ? "selected" : ""}`}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name="job-colour"
                  aria-label={`${c} colour`}
                  value={c}
                  checked={color === c}
                  onChange={() => setColor(c)}
                />
                {color === c ? <Check size={19} /> : null}
              </label>
            ))}
          </div>
        </fieldset>
        {localError || error ? (
          <p role="alert" className="form-error">
            {localError || error}
          </p>
        ) : null}
        <div className="modal-actions">
          <button
            type="button"
            className="btn secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Check size={17} />
            )}
            {job ? "Save job" : "Add job"}
          </button>
        </div>
        {job ? (
          <div className="form-secondary-actions">
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={onArchive}
            >
              {job.archived ? "Restore this job" : "Archive this job"}
            </button>
            {canDelete ? (
              <button
                type="button"
                className="text-button danger-text"
                disabled={busy}
                onClick={onDelete}
              >
                Delete empty job
              </button>
            ) : (
              <small>Archiving keeps all previous shifts and reports.</small>
            )}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}

export function ShiftForm({
  shift,
  state,
  day,
  today = day,
  preferredJob,
  mode = "complete",
  busy,
  error,
  onClose,
  onSave,
}: {
  shift?: Shift;
  state: AppState;
  day: string;
  today?: string;
  preferredJob?: string;
  mode?: "start" | "complete";
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (shift: ShiftInput) => Promise<void>;
}) {
  const activeJobs = state.jobs.filter(
    (j) => !j.archived || j.id === shift?.jobId,
  );
  const initialJob =
    state.jobs.find((j) => j.id === (shift?.jobId || preferredJob)) ||
    activeJobs[0];
  const [jobId, setJobId] = useState(initialJob?.id || ""),
    [date, setDate] = useState(shift?.date || day),
    [start, setStart] = useState(
      shift?.start ||
        (mode === "start" ? timeNow(state.settings.timeZone) : "09:00"),
    ),
    [end, setEnd] = useState(shift?.end || timeNow(state.settings.timeZone)),
    [nextDay, setNextDay] = useState(
      shift?.nextDay ||
        Boolean(shift && shift.end === null && shift.date < today),
    ),
    [unpaidBreak, setBreak] = useState(
      String(shift?.unpaidBreak ?? initialJob?.defaultBreak ?? 0),
    ),
    [rate, setRate] = useState(
      ((shift?.rate ?? initialJob?.rate ?? 0) / 100).toFixed(2),
    ),
    [note, setNote] = useState(shift?.note || ""),
    [openShift, setOpenShift] = useState(!shift && mode === "start"),
    [localError, setLocalError] = useState("");
  function changeJob(id: string) {
    setJobId(id);
    const job = state.jobs.find((j) => j.id === id);
    if (job) {
      setRate((job.rate / 100).toFixed(2));
      setBreak(String(job.defaultBreak));
    }
  }
  const input: ShiftInput = {
    jobId,
    date,
    start,
    end: openShift ? null : end,
    nextDay,
    unpaidBreak: Number(unpaidBreak),
    rate: Math.round(Number(rate) * 100),
    note,
  };
  let preview: ShiftInput | null = null;
  try {
    if (rate !== "" && unpaidBreak !== "")
      preview = validateShift(input, state.jobs);
  } catch {
    /* Show a neutral preview until the form is complete. */
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setLocalError("");
    try {
      const validated = validateShift(input, state.jobs);
      await onSave(validated);
    } catch (e) {
      setLocalError((e as Error).message);
    }
  }
  return (
    <Modal
      title={
        shift?.end === null
          ? "Time to wrap up?"
          : shift
            ? "Keep the details accurate."
            : openShift
              ? "Your shift starts here."
              : "Your hours, your way."
      }
      subtitle="You choose the times and rate. Change them whenever you need to."
      busy={busy}
      onClose={onClose}
    >
      <form onSubmit={submit} className="form-stack">
        <label>
          Job
          <select
            value={jobId}
            onChange={(e) => changeJob(e.target.value)}
            required
            aria-label="Shift job"
          >
            {activeJobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
                {j.archived ? " (archived)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Shift date
          <input
            type="date"
            required
            min="2000-01-01"
            max="2100-12-31"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            Start time
            <input
              type="time"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          {!openShift ? (
            <label>
              Finish time
              <input
                type="time"
                required
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          ) : (
            <div className="open-time-note">
              <Clock3 size={19} />
              <span>
                Save now.
                <br />
                Add the finish later.
              </span>
            </div>
          )}
        </div>
        {!openShift ? (
          <label className="check-label">
            <input
              type="checkbox"
              checked={nextDay}
              onChange={(e) => setNextDay(e.target.checked)}
            />
            <Moon size={17} />
            <span>Finishes the next day</span>
          </label>
        ) : null}
        {!shift ? (
          <label className="check-label">
            <input
              type="checkbox"
              checked={openShift}
              onChange={(e) => setOpenShift(e.target.checked)}
            />
            <Clock3 size={17} />
            <span>Still working? Save the finish later.</span>
          </label>
        ) : null}
        <div className="form-grid">
          <label>
            Hourly pay rate{" "}
            <span className="optional">{state.settings.currency}</span>
            <input
              aria-label="Shift hourly pay rate"
              inputMode="decimal"
              type="number"
              min="0"
              max="10000"
              step="0.01"
              required
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </label>
          <label>
            Unpaid break <span className="optional">minutes</span>
            <input
              inputMode="numeric"
              type="number"
              min="0"
              max="1439"
              step="1"
              required
              value={unpaidBreak}
              onChange={(e) => setBreak(e.target.value)}
            />
          </label>
        </div>
        <p className="form-hint">
          The hourly rate is saved with this shift. Your other shifts stay as
          recorded.
        </p>
        <label>
          A note <span className="optional">optional</span>
          <textarea
            rows={2}
            maxLength={500}
            placeholder="Anything you’d like to remember…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <div className="pay-preview" aria-live="polite">
          <div>
            <span>
              <Clock3 size={13} />
              Paid time
            </span>
            <strong>
              {preview && !openShift ? hoursLabel(paidMinutes(preview)) : "—"}
            </strong>
          </div>
          <ArrowRight size={19} />
          <div>
            <span>
              <Wallet size={13} />
              Estimated gross
            </span>
            <strong>
              {preview && !openShift
                ? money(gross(preview), state.settings.currency)
                : "—"}
            </strong>
          </div>
        </div>
        <p className="form-hint">
          {openShift
            ? "Open shifts are saved, but only completed shifts count toward hours and pay."
            : `Unpaid breaks deducted. Gross pay is before tax and other deductions. Times: ${state.settings.timeZone}.`}
        </p>
        {localError || error ? (
          <p role="alert" className="form-error">
            {localError || error}
          </p>
        ) : null}
        <div className="modal-actions">
          <button
            type="button"
            className="btn secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Check size={17} />
            )}
            {openShift ? "Save start time" : shift ? "Save shift" : "Add shift"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function ProfileForm({
  settings,
  busy,
  error,
  onSave,
}: {
  settings: Settings;
  busy: boolean;
  error: string;
  onSave: (settings: Settings) => Promise<void>;
}) {
  const [name, setName] = useState(settings.displayName),
    [currency, setCurrency] = useState<Currency>(settings.currency),
    [zone, setZone] = useState(settings.timeZone);
  const zones = Array.from(
    new Set([
      settings.timeZone,
      "Europe/London",
      "Europe/Paris",
      "Asia/Kolkata",
      "Australia/Sydney",
      "America/New_York",
      "America/Los_Angeles",
      "Pacific/Auckland",
      "UTC",
    ]),
  );
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSave({ displayName: name, currency, timeZone: zone });
      }}
    >
      <label>
        Your name{" "}
        <span className="optional">optional · used on PDF reports</span>
        <input
          autoComplete="name"
          maxLength={80}
          placeholder="Name for your timesheets"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <div className="form-grid">
        <label>
          Currency
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
          >
            {CURRENCIES.map((c) => (
              <option value={c} key={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Time zone
          <select value={zone} onChange={(e) => setZone(e.target.value)}>
            {zones.map((z) => (
              <option value={z} key={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="form-hint">
        All jobs use the same currency. Changing it changes the label, not the
        numeric rates or exchange value.
      </p>
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      <button className="btn primary align-start" disabled={busy}>
        {busy ? (
          <LoaderCircle size={17} className="spin" />
        ) : (
          <Check size={17} />
        )}
        Save preferences
      </button>
    </form>
  );
}
