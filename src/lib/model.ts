export const CURRENCIES = [
  "GBP",
  "EUR",
  "USD",
  "INR",
  "AUD",
  "CAD",
  "NZD",
] as const;
export type Currency = (typeof CURRENCIES)[number];
export const COLORS = [
  "mint",
  "violet",
  "blue",
  "peach",
  "rose",
  "slate",
] as const;
export function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export type JobColor = (typeof COLORS)[number];
export type Job = {
  id: string;
  name: string;
  role: string;
  rate: number;
  defaultBreak: number;
  color: JobColor;
  archived: boolean;
  createdAt: string;
};
export type JobInput = Pick<
  Job,
  "name" | "role" | "rate" | "defaultBreak" | "color"
>;
export type Shift = {
  id: string;
  jobId: string;
  date: string;
  start: string;
  end: string | null;
  nextDay: boolean;
  unpaidBreak: number;
  rate: number;
  note: string;
  createdAt: string;
  updatedAt: string;
};
export type ShiftInput = Pick<
  Shift,
  | "jobId"
  | "date"
  | "start"
  | "end"
  | "nextDay"
  | "unpaidBreak"
  | "rate"
  | "note"
>;
export type Settings = {
  displayName: string;
  currency: Currency;
  timeZone: string;
};
export type Change = {
  id: string;
  date: string;
  kind: string;
  label: string;
  before?: Shift | Job | null;
  after?: Shift | Job | null;
};
export type AppState = {
  schemaVersion: 1;
  revision: number;
  settings: Settings;
  jobs: Job[];
  shifts: Shift[];
  history: Change[];
};
export type Period = {
  kind: "week" | "month";
  start: string;
  end: string;
  label: string;
  short: string;
};
export type Action =
  | { type: "job/save"; input: JobInput; id?: string }
  | { type: "job/archive"; id: string; archived: boolean }
  | { type: "job/delete"; id: string }
  | {
      type: "shift/save";
      input: ShiftInput;
      id?: string;
      expectedUpdatedAt?: string;
    }
  | { type: "shift/delete"; id: string }
  | { type: "shift/restore"; shift: Shift }
  | { type: "settings/save"; settings: Settings }
  | { type: "data/replace"; state: AppState }
  | { type: "data/reset" };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export function validDate(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !DATE.test(value) ||
    value < "2000-01-01" ||
    value > "2100-12-31"
  )
    return false;
  const d = new Date(value + "T12:00:00Z");
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === value;
}
export function today(
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  now = new Date(),
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function timeNow(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
}
export function addDays(date: string, n: number): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function monday(date: string): string {
  const day = new Date(date + "T12:00:00Z").getUTCDay();
  return addDays(date, -(day === 0 ? 6 : day - 1));
}
export function dateLabel(
  date: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" },
): string {
  return new Intl.DateTimeFormat("en-GB", {
    ...options,
    timeZone: "UTC",
  }).format(new Date(date + "T12:00:00Z"));
}
export function getPeriod(kind: Period["kind"], anchor: string): Period {
  if (!validDate(anchor)) throw new Error("Choose a valid date.");
  if (kind === "week") {
    const start = monday(anchor),
      end = addDays(start, 6);
    return {
      kind,
      start,
      end,
      label: `${dateLabel(start, { day: "numeric", month: "short", year: "numeric" })} - ${dateLabel(end, { day: "numeric", month: "short", year: "numeric" })}`,
      short: `${dateLabel(start)} – ${dateLabel(end)}`,
    };
  }
  const start = anchor.slice(0, 7) + "-01",
    last = new Date(start + "T12:00:00Z");
  last.setUTCMonth(last.getUTCMonth() + 1);
  last.setUTCDate(0);
  return {
    kind,
    start,
    end: last.toISOString().slice(0, 10),
    label: dateLabel(start, { month: "long", year: "numeric" }),
    short: dateLabel(start, { month: "long", year: "numeric" }),
  };
}
export function minuteOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
export function span(s: ShiftInput): [number, number | null] {
  const base = Date.parse(s.date + "T00:00:00Z") / 60000;
  return [
    base + minuteOf(s.start),
    s.end === null ? null : base + minuteOf(s.end) + (s.nextDay ? 1440 : 0),
  ];
}
export function paidMinutes(s: ShiftInput): number {
  return s.end === null
    ? 0
    : minuteOf(s.end) -
        minuteOf(s.start) +
        (s.nextDay ? 1440 : 0) -
        s.unpaidBreak;
}
export function gross(s: ShiftInput): number {
  return Math.round((paidMinutes(s) * s.rate) / 60);
}
export const money = (cents: number, currency: Currency = "GBP") =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
    cents / 100,
  );
export const decimalHours = (minutes: number) =>
  new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(
    minutes / 60,
  );
export const hoursLabel = (minutes: number) =>
  `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`;
export const summary = (shifts: Shift[]) =>
  shifts.reduce(
    (a, s) => {
      if (s.end !== null) {
        a.minutes += paidMinutes(s);
        a.gross += gross(s);
        a.breaks += s.unpaidBreak;
        a.count++;
      } else a.open++;
      return a;
    },
    { minutes: 0, gross: 0, breaks: 0, count: 0, open: 0 },
  );
export function selectShifts(
  state: AppState,
  period: Pick<Period, "start" | "end">,
  jobId = "all",
  includeOpen = false,
): Shift[] {
  return state.shifts
    .filter(
      (s) =>
        (includeOpen || s.end !== null) &&
        (jobId === "all" || s.jobId === jobId) &&
        s.date >= period.start &&
        s.date <= period.end,
    )
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
    );
}
function cleanText(
  value: unknown,
  field: string,
  max: number,
  optional = false,
): string {
  if (typeof value !== "string") throw new Error(`Enter a valid ${field}.`);
  const s = value.trim();
  if ((!optional && !s) || s.length > max)
    throw new Error(
      `${field} must ${optional ? "" : "not be empty and "}be ${max} characters or fewer.`,
    );
  return s;
}
export function validateJob(input: JobInput): JobInput {
  if (
    !Number.isSafeInteger(input.rate) ||
    input.rate < 0 ||
    input.rate > 1000000
  )
    throw new Error(
      "Enter an hourly rate from 0 to 10,000, with no more than two decimal places.",
    );
  if (
    !Number.isInteger(input.defaultBreak) ||
    input.defaultBreak < 0 ||
    input.defaultBreak > 600
  )
    throw new Error(
      "Default unpaid break must be a whole number from 0 to 600 minutes.",
    );
  if (!COLORS.includes(input.color)) throw new Error("Choose a job colour.");
  return {
    name: cleanText(input.name, "Job name", 80),
    role: cleanText(input.role, "Job role", 60, true),
    rate: input.rate,
    defaultBreak: input.defaultBreak,
    color: input.color,
  };
}
export function validateShift(input: ShiftInput, jobs: Job[]): ShiftInput {
  if (!jobs.some((j) => j.id === input.jobId))
    throw new Error("Choose an existing job.");
  if (!validDate(input.date)) throw new Error("Choose a valid date.");
  if (
    !TIME.test(input.start) ||
    (input.end !== null &&
      (typeof input.end !== "string" || !TIME.test(input.end)))
  )
    throw new Error("Enter valid start and finish times.");
  if (typeof input.nextDay !== "boolean")
    throw new Error("Choose whether the shift ends the next day.");
  if (
    !Number.isSafeInteger(input.rate) ||
    input.rate < 0 ||
    input.rate > 1000000
  )
    throw new Error(
      "Enter an hourly rate from 0 to 10,000, with no more than two decimal places.",
    );
  if (
    !Number.isInteger(input.unpaidBreak) ||
    input.unpaidBreak < 0 ||
    input.unpaidBreak > 1439
  )
    throw new Error(
      "Enter unpaid break minutes as a whole number from 0 to 1,439.",
    );
  if (input.end !== null) {
    const minutes =
      minuteOf(input.end) - minuteOf(input.start) + (input.nextDay ? 1440 : 0);
    if (minutes <= 0 || minutes > 1440)
      throw new Error(
        "Finish time must be after start time and within 24 hours. Select “Next day” for an overnight shift.",
      );
    if (input.unpaidBreak >= minutes)
      throw new Error("The unpaid break must be shorter than your shift.");
  }
  return {
    jobId: input.jobId,
    date: input.date,
    start: input.start,
    end: input.end,
    nextDay: input.end === null ? false : input.nextDay,
    unpaidBreak: input.unpaidBreak,
    rate: input.rate,
    note: cleanText(input.note, "Note", 500, true),
  };
}
export function validateSettings(input: Settings): Settings {
  if (!CURRENCIES.includes(input.currency))
    throw new Error("Choose a supported currency.");
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: input.timeZone }).format();
  } catch {
    throw new Error("Choose a valid time zone.");
  }
  return {
    displayName: cleanText(input.displayName, "Name", 80, true),
    currency: input.currency,
    timeZone: input.timeZone,
  };
}
export function emptyState(): AppState {
  return {
    schemaVersion: 1,
    revision: 0,
    settings: {
      displayName: "",
      currency: "GBP",
      timeZone:
        Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London",
    },
    jobs: [],
    shifts: [],
    history: [],
  };
}
function event(
  state: AppState,
  kind: string,
  label: string,
  before: Change["before"],
  after: Change["after"],
): Change[] {
  return [
    { id: newId(), date: new Date().toISOString(), kind, label, before, after },
    ...state.history,
  ].slice(0, 200);
}
function checkOverlap(state: AppState, input: ShiftInput, id?: string) {
  if (
    input.end === null &&
    state.shifts.some(
      (s) => s.jobId === input.jobId && s.end === null && s.id !== id,
    )
  )
    throw new Error(
      "This job already has a shift in progress. Finish that shift first.",
    );
  if (input.end !== null) {
    const [start, end] = span(input);
    if (
      state.shifts.some((s) => {
        const other = span(s);
        return (
          s.id !== id &&
          s.jobId === input.jobId &&
          other[1] !== null &&
          other[0] < end! &&
          other[1] > start
        );
      })
    )
      throw new Error(
        "This overlaps another shift for the same job. Check the dates and times.",
      );
  }
}
export function reduceAction(state: AppState, action: Action): AppState {
  const now = new Date().toISOString();
  switch (action.type) {
    case "job/save": {
      const input = validateJob(action.input),
        old = state.jobs.find((j) => j.id === action.id);
      if (action.id && !old) throw new Error("That job no longer exists.");
      const job: Job = {
        ...input,
        id: old?.id || newId(),
        archived: old?.archived || false,
        createdAt: old?.createdAt || now,
      };
      return {
        ...state,
        jobs: [...state.jobs.filter((j) => j.id !== job.id), job],
        history: event(
          state,
          "job",
          old ? `Updated ${job.name}` : `Added ${job.name}`,
          old || null,
          job,
        ),
      };
    }
    case "job/archive": {
      const job = state.jobs.find((j) => j.id === action.id);
      if (!job) throw new Error("Job not found.");
      if (
        action.archived &&
        state.shifts.some((s) => s.jobId === job.id && s.end === null)
      )
        throw new Error("Finish this job’s open shift before archiving it.");
      const next = { ...job, archived: action.archived };
      return {
        ...state,
        jobs: state.jobs.map((j) => (j.id === job.id ? next : j)),
        history: event(
          state,
          "job",
          `${action.archived ? "Archived" : "Restored"} ${job.name}`,
          job,
          next,
        ),
      };
    }
    case "job/delete": {
      const job = state.jobs.find((j) => j.id === action.id);
      if (!job) throw new Error("Job not found.");
      if (state.shifts.some((s) => s.jobId === job.id))
        throw new Error(
          "This job has saved shifts. Archive it to keep its history.",
        );
      return {
        ...state,
        jobs: state.jobs.filter((j) => j.id !== job.id),
        history: event(state, "job", `Removed ${job.name}`, job, null),
      };
    }
    case "shift/save": {
      const input = validateShift(action.input, state.jobs),
        old = state.shifts.find((s) => s.id === action.id);
      if (action.id && !old) throw new Error("That shift no longer exists.");
      if (
        old &&
        action.expectedUpdatedAt &&
        old.updatedAt !== action.expectedUpdatedAt
      )
        throw new Error(
          "This shift changed in another tab. Close this form, reopen the entry and try again.",
        );
      if (!old && state.jobs.find((j) => j.id === input.jobId)?.archived)
        throw new Error("Restore this job before adding new shifts.");
      checkOverlap(state, input, old?.id);
      const shift: Shift = {
        ...input,
        id: old?.id || newId(),
        createdAt: old?.createdAt || now,
        updatedAt: now,
      };
      return {
        ...state,
        shifts: [...state.shifts.filter((s) => s.id !== shift.id), shift],
        history: event(
          state,
          "shift",
          `${old ? "Updated" : input.end === null ? "Started" : "Added"} shift on ${dateLabel(shift.date)}`,
          old || null,
          shift,
        ),
      };
    }
    case "shift/delete": {
      const old = state.shifts.find((s) => s.id === action.id);
      if (!old) throw new Error("Shift not found.");
      return {
        ...state,
        shifts: state.shifts.filter((s) => s.id !== old.id),
        history: event(
          state,
          "shift",
          `Removed shift on ${dateLabel(old.date)}`,
          old,
          null,
        ),
      };
    }
    case "shift/restore": {
      if (state.shifts.some((s) => s.id === action.shift.id))
        throw new Error("This shift has already been restored.");
      validateShift(action.shift, state.jobs);
      checkOverlap(state, action.shift);
      return {
        ...state,
        shifts: [...state.shifts, { ...action.shift, updatedAt: now }],
        history: event(
          state,
          "shift",
          `Restored shift on ${dateLabel(action.shift.date)}`,
          null,
          action.shift,
        ),
      };
    }
    case "settings/save":
      return { ...state, settings: validateSettings(action.settings) };
    case "data/replace":
      return { ...action.state, revision: state.revision };
    case "data/reset":
      return { ...emptyState(), revision: state.revision };
  }
}
export function backupJson(state: AppState): string {
  return JSON.stringify(
    {
      format: "MyHours backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      state,
    },
    null,
    2,
  );
}
export function importBackup(raw: string): AppState {
  if (raw.length > 10000000)
    throw new Error("This backup is too large (maximum 10 MB).");
  let wrapper;
  try {
    wrapper = JSON.parse(raw);
  } catch {
    throw new Error("That file is not valid JSON. Choose a MyHours backup.");
  }
  if (
    wrapper?.format !== "MyHours backup" ||
    wrapper.version !== 1 ||
    !wrapper.state ||
    wrapper.state.schemaVersion !== 1
  )
    throw new Error("Choose a compatible MyHours backup file.");
  const s = wrapper.state;
  if (
    !Array.isArray(s.jobs) ||
    !Array.isArray(s.shifts) ||
    s.jobs.length > 500 ||
    s.shifts.length > 50000
  )
    throw new Error("The backup has an unsupported number of records.");
  const ids = new Set<string>();
  const id = (v: unknown) => {
    if (
      typeof v !== "string" ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(v) ||
      ids.has(v)
    )
      throw new Error("The backup contains missing or duplicate record IDs.");
    ids.add(v);
    return v;
  };
  const jobs: Job[] = s.jobs.map((j: Job) => ({
    ...validateJob(j),
    id: id(j.id),
    archived: Boolean(j.archived),
    createdAt:
      typeof j.createdAt === "string" ? j.createdAt : new Date().toISOString(),
  }));
  const shifts: Shift[] = s.shifts.map((v: Shift) => ({
    ...validateShift(v, jobs),
    id: id(v.id),
    createdAt:
      typeof v.createdAt === "string" ? v.createdAt : new Date().toISOString(),
    updatedAt:
      typeof v.updatedAt === "string" ? v.updatedAt : new Date().toISOString(),
  }));
  return {
    schemaVersion: 1,
    revision: 0,
    jobs,
    shifts,
    settings: validateSettings(s.settings),
    history: [],
  };
}
function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^\s*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function csvReport(state: AppState, shifts: Shift[]): string {
  const rows: unknown[][] = [
    [
      "Job",
      "Date",
      "Start",
      "Finish",
      "Finish next day",
      "Unpaid break minutes",
      "Paid hours",
      `Rate (${state.settings.currency}/hour)`,
      `Estimated gross (${state.settings.currency})`,
      "Note",
    ],
  ];
  for (const s of shifts.filter((s) => s.end !== null))
    rows.push([
      state.jobs.find((j) => j.id === s.jobId)?.name || "Job",
      s.date,
      s.start,
      s.end,
      s.nextDay ? "Yes" : "No",
      s.unpaidBreak,
      (paidMinutes(s) / 60).toFixed(4),
      (s.rate / 100).toFixed(2),
      (gross(s) / 100).toFixed(2),
      s.note,
    ]);
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
export function demoState(day: string): AppState {
  const s = emptyState(),
    week = monday(day),
    now = new Date().toISOString();
  const jobs: Job[] = [
    {
      id: "demo-cafe",
      name: "Weekend café",
      role: "Barista",
      rate: 1350,
      defaultBreak: 30,
      color: "mint",
      archived: false,
      createdAt: now,
    },
    {
      id: "demo-studio",
      name: "Design studio",
      role: "Freelance",
      rate: 2200,
      defaultBreak: 0,
      color: "violet",
      archived: false,
      createdAt: now,
    },
    {
      id: "demo-retail",
      name: "Retail shifts",
      role: "Sales assistant",
      rate: 1275,
      defaultBreak: 30,
      color: "peach",
      archived: false,
      createdAt: now,
    },
  ];
  const shifts: Shift[] = [];
  for (let i = 0; i < 18; i++) {
    const date = addDays(week, i - 7),
      job = jobs[i % 3];
    shifts.push({
      id: `demo-shift-${i}`,
      jobId: job.id,
      date,
      start: i % 3 === 1 ? "10:00" : "09:00",
      end: i % 3 === 1 ? "14:30" : i % 3 === 0 ? "16:30" : "17:00",
      nextDay: false,
      unpaidBreak: job.defaultBreak,
      rate: job.rate,
      note: i % 5 === 0 ? "Covered an extra shift" : "",
      createdAt: now,
      updatedAt: now,
    });
  }
  return {
    ...s,
    settings: { ...s.settings, displayName: "Alex" },
    jobs,
    shifts,
  };
}
