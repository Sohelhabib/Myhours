import { useEffect, useRef, useState } from "react";
import {
  Archive, ArrowDownToLine, ArrowRight, ArrowUpFromLine,
  BriefcaseBusiness, CalendarDays, Check, ChevronRight,
  Download, FileText, History, Home as HomeIcon, Hourglass,
  LoaderCircle, MoreHorizontal, Pencil, Plus, Search,
  Settings2, Share2, ShieldCheck, Smartphone, Sparkles,
  Trash2, Wallet, WifiOff, X,
} from "lucide-react";

import {
  backupJson, csvReport, dateLabel, demoState, getPeriod,
  hoursLabel, importBackup, money, reduceAction, selectShifts,
  summary, today, validDate,
  type Action, type AppState, type Change, type Job,
  type Period, type Shift,
} from "./lib/model.ts";

import { useRecords } from "./lib/use-records.ts";
import { usePwa } from "./lib/use-pwa.ts";
import {
  Creator, Empty, JobFilter, JobMark, ShiftCards, WeekNav,
} from "./components/Common.tsx";
import {
  JobForm, ProfileForm, ShiftForm,
} from "./components/Forms.tsx";

import Home from "./components/Home.tsx";
import Reports from "./components/Reports.tsx";
import Modal from "./components/Modal.tsx";

type Tab = "home" | "shifts" | "jobs" | "reports" | "settings";

type ModalState =
  | { type: "job"; job?: Job }
  | {
      type: "shift";
      shift?: Shift;
      mode?: "start" | "complete";
      date: string;
    }
  | { type: "delete"; shift: Shift }
  | { type: "install" }
  | { type: "restore"; data: AppState }
  | { type: "reset" }
  | { type: "change"; change: Change };

type ReadyReport = {
  name: string;
  includePay: boolean;
  url: string;
  blob: Blob;
  filename: string;
  period: Period;
  count: number;
  minutes: number;
  gross: number;
};

const navigation = [
  { id: "home", label: "Home", icon: HomeIcon },
  { id: "shifts", label: "Shifts", icon: CalendarDays },
  { id: "jobs", label: "Jobs", icon: BriefcaseBusiness },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "settings", label: "More", icon: MoreHorizontal },
] as const;

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

let fontsPromise: Promise<[Uint8Array, Uint8Array]> | null = null;

function reportFonts() {
  return (fontsPromise ||= Promise.all(
    [
      "/fonts/DejaVuSans.ttf",
      "/fonts/DejaVuSans-Bold.ttf",
    ].map(async (url) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          "Open MyHours online once to cache the PDF fonts, then try again.",
        );
      }
      return new Uint8Array(await response.arrayBuffer());
    }),
  ) as Promise<[Uint8Array, Uint8Array]>);
}

export default function App() {
  const records = useRecords();
  const pwa = usePwa();

  const [preview, setPreview] = useState<AppState | null>(null);
  const state = preview || records.data;
  const day = today(state.settings.timeZone);

  const [tab, setTab] = useState<Tab>(() =>
    new URLSearchParams(location.search).get("tab") === "reports"
      ? "reports"
      : "home",
  );

  const [anchor, setAnchor] = useState(day);
  const [selectedDay, setSelectedDay] = useState(day);
  const [jobId, setJobId] = useState("all");
  const [month, setMonth] = useState(day.slice(0, 7));
  const [reportKind, setReportKind] = useState<Period["kind"]>("week");
  const [shiftRange, setShiftRange] =
    useState<"week" | "month" | "all">("week");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const [undo, setUndo] = useState<Shift | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [ready, setReady] = useState<ReadyReport | null>(null);
  const [deleteWord, setDeleteWord] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const shortcutDone = useRef(false);

  const filter =
    jobId === "all" || state.jobs.some((j) => j.id === jobId)
      ? jobId
      : "all";

  const weekly = getPeriod("week", anchor);
  const close = () => setModal(null);

  const notify = (message: string) => {
    setUndo(null);
    setToast(message);
  };

  const open = (next: ModalState) => {
    setFormError("");
    setModal(next);
  };

  const navigate = (next: Tab) => {
    setTab(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  function changeWeek(date: string) {
    setAnchor(date);
    setSelectedDay(
      date === day ? day : getPeriod("week", date).start,
    );
  }

  function addShift(mode: "start" | "complete" = "complete") {
    if (!state.jobs.some((j) => !j.archived)) {
      return open({ type: "job" });
    }
    open({
      type: "shift",
      mode,
      date:
        tab === "home" && mode === "complete"
          ? selectedDay
          : day,
    });
  }

  const editShift = (shift: Shift) =>
    open({ type: "shift", shift, date: shift.date });

  async function mutate(
    action: Action,
    message: string,
  ): Promise<boolean> {
    if (busyRef.current) return false;

    busyRef.current = true;
    setBusy(true);
    setFormError("");

    try {
      if (preview) {
        setPreview(reduceAction(preview, action));
      } else {
        await records.dispatch(action);
      }

      notify(message + (preview ? " · Sample preview only" : ""));
      return true;
    } catch (error) {
      const message = (error as Error).message;
      setFormError(message);
      if (!modal) notify(message);
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast("");
      setUndo(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (records.loading || shortcutDone.current) return;
    shortcutDone.current = true;

    if (
      new URLSearchParams(location.search).get("action") === "shift"
    ) {
      if (state.jobs.some((j) => !j.archived)) {
        setModal({ type: "shift", date: day });
      } else {
        setModal({ type: "job" });
      }
    }

    if (location.search) {
      history.replaceState(null, "", location.pathname);
    }
  }, [records.loading, state.jobs, day]);

  useEffect(
    () => () => {
      if (ready) URL.revokeObjectURL(ready.url);
    },
    [ready],
  );

  function startDemo() {
    setPreview(demoState(day));
    setAnchor(day);
    setSelectedDay(day);
    setJobId("all");
    navigate("home");
    notify("Exploring sample data. Your real records are unchanged.");
  }

  function exitDemo() {
    setPreview(null);
    setAnchor(day);
    setSelectedDay(day);
    setJobId("all");
    navigate("home");
    notify("Back to your saved records.");
  }

  async function installApp() {
    if (!pwa.canInstall || pwa.installed) {
      return open({ type: "install" });
    }

    try {
      if (await pwa.install()) {
        close();
        notify("MyHours added to your Home Screen.");
      }
    } catch {
      open({ type: "install" });
    }
  }

  async function makePdf(
    period: Period,
    shifts: Shift[],
    options: { name: string; includePay: boolean },
  ) {
    if (pdfBusy) return;

    const name = options.name.trim();
    if (!name || name.length > 80) {
      return notify("Enter your name using 80 characters or fewer.");
    }

    setPdfBusy(true);

    try {
      const settings = { ...state.settings, displayName: name };

      if (
        name !== state.settings.displayName &&
        !(await mutate(
          { type: "settings/save", settings },
          "Your report name is saved.",
        ))
      ) {
        return;
      }

      const [{ createTimesheetPdf }, fonts] = await Promise.all([
        import("./lib/pdf.ts"),
        reportFonts(),
      ]);

      const bytes = await createTimesheetPdf(
        {
          state: { ...state, settings },
          shifts,
          period,
          includePay: options.includePay,
          jobName: `${preview ? "SAMPLE DATA / " : ""}${
            filter === "all"
              ? "All jobs"
              : state.jobs.find((j) => j.id === filter)?.name || "Job"
          }`,
        },
        fonts[0],
        fonts[1],
      );

      const blob = new Blob(
        [bytes.slice().buffer as ArrayBuffer],
        { type: "application/pdf" },
      );
      const total = summary(shifts);

      setReady({
        name,
        includePay: options.includePay,
        blob,
        url: URL.createObjectURL(blob),
        filename: `MyHours-${preview ? "sample-" : ""}${
          period.kind
        }-${period.start}-${
          options.includePay ? "hours-and-pay" : "hours-only"
        }.pdf`,
        period,
        count: total.count,
        minutes: total.minutes,
        gross: total.gross,
      });
    } catch (error) {
      fontsPromise = null;
      notify(
        (error as Error).message ||
          "Your PDF could not be created. Please try again.",
      );
    } finally {
      setPdfBusy(false);
    }
  }

  function makeCsv(period: Period, shifts: Shift[]) {
    download(
      new Blob([csvReport(state, shifts)], {
        type: "text/csv;charset=utf-8;",
      }),
      `MyHours-${preview ? "sample-" : ""}${period.kind}-${period.start}.csv`,
    );
    notify("Your CSV is ready to save.");
  }

  function backup() {
    download(
      new Blob([backupJson(state)], { type: "application/json" }),
      `MyHours-${preview ? "sample-" : ""}backup-${day}.json`,
    );
    notify("Backup ready to save. Keep it somewhere safe.");
  }

  async function chooseBackup(file: File | undefined) {
    if (!file) return;

    try {
      if (file.size > 10000000) {
        throw new Error("Choose a backup smaller than 10 MB.");
      }
      open({
        type: "restore",
        data: importBackup(await file.text()),
      });
    } catch (error) {
      notify((error as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const shiftsForView = state.shifts.filter(
    (s) =>
      (filter === "all" || s.jobId === filter) &&
      (shiftRange === "all" ||
        (shiftRange === "month"
          ? s.date.startsWith(month)
          : s.date >= weekly.start && s.date <= weekly.end)) &&
      `${s.date} ${s.note} ${
        state.jobs.find((j) => j.id === s.jobId)?.name || ""
      }`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );

  const shiftDays = Array.from(
    new Set(shiftsForView.map((s) => s.date)),
  ).sort().reverse();

  const shiftTotal = summary(shiftsForView);

  return (
    <div className="app-shell">
      <div className="ambient" aria-hidden="true">
        <div className="ambient-mint" />
        <div className="ambient-lilac" />
        <div className="ambient-peach" />
      </div>

      <aside className="desktop-sidebar glass">
        <a className="brand" href="/" aria-label="MyHours home">
          <span className="brand-mark"><Hourglass size={24} /></span>
          MyHours<span className="brand-dot">.</span>
        </a>

        <span className="sidebar-caption">YOUR TIME, YOUR WAY</span>

        <nav aria-label="Main navigation">
          {navigation.map((n) => (
            <button
              key={n.id}
              aria-current={tab === n.id ? "page" : undefined}
              className={tab === n.id ? "selected" : ""}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={20} />
              {n.id === "settings" ? "Settings & more" : n.label}
              {tab === n.id ? <i /> : null}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Sparkles size={24} />
            <h3>A little less admin.<br />A little more clarity.</h3>
            <p>Your jobs, hours and earnings, together in one place.</p>
          </div>
          <button className="install-side" onClick={installApp}>
            <Smartphone size={19} />
            <span>
              {pwa.installed
                ? "Installed on this device"
                : "Take MyHours with you"}
            </span>
            <ChevronRight size={15} />
          </button>
          <Creator />
        </div>
      </aside>

      <div className="main-shell">
        <header className="mobile-header">
          <a className="brand" href="/">
            <span className="brand-mark"><Hourglass size={21} /></span>
            MyHours<span className="brand-dot">.</span>
          </a>
          <div>
            <span className="today-chip">
              <i />{dateLabel(day, { day: "numeric", month: "short" })}
            </span>
            <button
              className="icon-btn top-settings"
              aria-label="Open settings"
              onClick={() => navigate("settings")}
            >
              <Settings2 size={21} />
            </button>
          </div>
        </header>

        <header className="desktop-header">
          <div>
            <span>My workspace</span>
            <ChevronRight size={14} />
            <strong>
              {tab === "settings"
                ? "Settings & more"
                : navigation.find((n) => n.id === tab)?.label}
            </strong>
          </div>
          <span>
            <i className="status-dot" />
            {online ? "On this device" : "Working offline"}
            <button
              className="icon-btn"
              aria-label="Installation options"
              onClick={installApp}
            >
              <Smartphone size={19} />
            </button>
          </span>
        </header>

        <main className="main-content">
          {records.loading ? (
            <div className="glass loading-card">
              <LoaderCircle className="spin" size={23} />
              <p>Opening your hours…</p>
            </div>
          ) : (
            <>
              {preview ? (
                <div className="demo-banner">
                  <span>
                    <Sparkles size={15} />
                    <strong>Sample preview</strong>
                    <span>Changes aren’t saved.</span>
                  </span>
                  <button onClick={exitDemo}>
                    My records <ArrowRight size={14} />
                  </button>
                </div>
              ) : null}

              {records.error && !preview ? (
                <div className="error-banner" role="alert">
                  <span>{records.error}</span>
                  <button
                    className="text-button"
                    onClick={() =>
                      records.refresh().catch((e) => notify(e.message))
                    }
                  >
                    Try again
                  </button>
                </div>
              ) : null}

              {!online ? (
                <div className="offline-note">
                  <WifiOff size={14} />
                  You’re offline. Your entries still save on this device.
                </div>
              ) : null}

              {pwa.needRefresh[0] && !modal && !ready ? (
                <div className="update-banner">
                  <span>A fresh version of MyHours is ready.</span>
                  <button
                    className="text-button"
                    onClick={() => pwa.updateServiceWorker(true)}
                  >
                    Update app <ArrowRight size={14} />
                  </button>
                </div>
              ) : null}

              {tab === "home" ? (
                <Home
                  state={state}
                  day={day}
                  anchor={anchor}
                  selectedDay={selectedDay}
                  jobId={filter}
                  onJob={setJobId}
                  onWeek={changeWeek}
                  onDay={setSelectedDay}
                  onAddJob={() => open({ type: "job" })}
                  onAddShift={() => addShift()}
                  onStartShift={() => addShift("start")}
                  onEdit={editShift}
                  onDelete={(shift) => open({ type: "delete", shift })}
                  onReports={() => {
                    setReportKind("week");
                    navigate("reports");
                  }}
                  onDemo={startDemo}
                  isDemo={Boolean(preview)}
                  installed={pwa.installed}
                  onInstall={installApp}
                />
              ) : null}

              {tab === "shifts" ? (
                <>
                  <div className="page-intro">
                    <div>
                      <span className="eyebrow">EVERY HOUR, ACCOUNTED FOR</span>
                      <h1>Your shifts.<span> Your call.</span></h1>
                      <p>Add, edit or finish your shifts, whenever you need to.</p>
                    </div>
                    <button
                      className="btn primary desktop-add"
                      onClick={() => addShift()}
                    >
                      <Plus size={18} />Add a shift
                    </button>
                  </div>

                  <JobFilter
                    jobs={state.jobs}
                    value={filter}
                    onChange={setJobId}
                  />

                  <div className="glass shift-filters">
                    <div className="segmented">
                      {(["week", "month", "all"] as const).map((range) => (
                        <button
                          key={range}
                          aria-pressed={shiftRange === range}
                          className={shiftRange === range ? "selected" : ""}
                          onClick={() => setShiftRange(range)}
                        >
                          {range === "week"
                            ? "Week"
                            : range === "month"
                              ? "Month"
                              : "All shifts"}
                        </button>
                      ))}
                    </div>

                    {shiftRange === "week" ? (
                      <WeekNav
                        period={weekly}
                        today={day}
                        onChange={changeWeek}
                      />
                    ) : shiftRange === "month" ? (
                      <label className="sr-only-label">
                        Filter month
                        <input
                          type="month"
                          min="2000-01"
                          max="2100-12"
                          aria-label="Shift month"
                          value={month}
                          onChange={(e) => {
                            if (validDate(e.target.value + "-01")) {
                              setMonth(e.target.value);
                            }
                          }}
                        />
                      </label>
                    ) : null}

                    <div className="search-field">
                      <Search size={17} />
                      <input
                        aria-label="Search shifts"
                        placeholder="Search jobs, notes or dates"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="shift-summary-line">
                    <span>
                      {shiftTotal.count} completed shifts ·{" "}
                      {hoursLabel(shiftTotal.minutes)} paid
                    </span>
                    <strong>
                      {money(shiftTotal.gross, state.settings.currency)}
                    </strong>
                  </div>

                  <button
                    className="btn primary mobile-full-add"
                    onClick={() => addShift()}
                  >
                    <Plus size={18} />Add a shift
                  </button>

                  {shiftDays.length ? (
                    shiftDays.map((date) => {
                      const rows = shiftsForView
                        .filter((s) => s.date === date)
                        .sort((a, b) => a.start.localeCompare(b.start));
                      const total = summary(rows);

                      return (
                        <section className="shift-day-group" key={date}>
                          <div className="section-heading">
                            <h2>
                              {dateLabel(date, {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                              })}
                            </h2>
                            <span>
                              {hoursLabel(total.minutes)} ·{" "}
                              {money(total.gross, state.settings.currency)}
                            </span>
                          </div>
                          <ShiftCards
                            shifts={rows}
                            state={state}
                            onEdit={editShift}
                            onDelete={(shift) =>
                              open({ type: "delete", shift })
                            }
                            showDate={false}
                          />
                        </section>
                      );
                    })
                  ) : (
                    <div className="glass">
                      <Empty
                        title={
                          state.jobs.length
                            ? "A clear page for your hours."
                            : "Start with a job."
                        }
                        text={
                          state.jobs.length
                            ? "No shifts match this period. Add one or choose another date."
                            : "Add a job and its pay rate, then record your first shift."
                        }
                        action={
                          <button
                            className="btn secondary"
                            onClick={() =>
                              state.jobs.length
                                ? addShift()
                                : open({ type: "job" })
                            }
                          >
                            <Plus size={17} />
                            {state.jobs.length ? "Add a shift" : "Add a job"}
                          </button>
                        }
                      />
                    </div>
                  )}
                </>
              ) : null}

              {tab === "jobs" ? (
                <>
                  <div className="page-intro">
                    <div>
                      <span className="eyebrow">ONE JOB OR A FEW</span>
                      <h1>Work, in<span> your colours.</span></h1>
                      <p>Different jobs. Different rates. One clearer picture.</p>
                    </div>
                    <button
                      className="btn primary desktop-add"
                      onClick={() => open({ type: "job" })}
                    >
                      <Plus size={18} />Add a job
                    </button>
                  </div>

                  <div className="jobs-toolbar">
                    <div className="segmented">
                      <button
                        className={!showArchived ? "selected" : ""}
                        aria-pressed={!showArchived}
                        onClick={() => setShowArchived(false)}
                      >
                        Active jobs{" "}
                        <span>
                          {state.jobs.filter((j) => !j.archived).length}
                        </span>
                      </button>
                      <button
                        className={showArchived ? "selected" : ""}
                        aria-pressed={showArchived}
                        onClick={() => setShowArchived(true)}
                      >
                        Archived
                      </button>
                    </div>
                    <button
                      className="btn primary small mobile-job-add"
                      onClick={() => open({ type: "job" })}
                    >
                      <Plus size={17} />Add job
                    </button>
                  </div>

                  <div className="jobs-grid">
                    {state.jobs
                      .filter((j) => j.archived === showArchived)
                      .map((job) => {
                        const total = summary(
                          selectShifts(state, weekly, job.id),
                        );

                        return (
                          <section
                            className={`glass job-card ${
                              job.archived ? "archived" : ""
                            }`}
                            key={job.id}
                          >
                            <div className="job-card-head">
                              <JobMark job={job} />
                              <div>
                                <h2>{job.name}</h2>
                                <p>{job.role || "Your job, your hours"}</p>
                              </div>
                              <button
                                className="icon-btn"
                                aria-label={`Edit ${job.name}`}
                                onClick={() => open({ type: "job", job })}
                              >
                                <Pencil size={18} />
                              </button>
                            </div>

                            <div className="job-rate">
                              <span>Default hourly rate</span>
                              <strong>
                                {money(job.rate, state.settings.currency)}
                                <small> / hour</small>
                              </strong>
                            </div>

                            <div className="job-period-label">
                              WEEK OF {dateLabel(weekly.start).toUpperCase()}
                            </div>

                            <div className="job-totals">
                              <div>
                                <span>Paid time</span>
                                <strong>{hoursLabel(total.minutes)}</strong>
                              </div>
                              <div>
                                <span>Estimated gross</span>
                                <strong>
                                  {money(total.gross, state.settings.currency)}
                                </strong>
                              </div>
                            </div>

                            <div className="job-card-bottom">
                              <span>
                                {job.defaultBreak} min default unpaid break
                              </span>
                              {job.archived ? (
                                <button
                                  className="text-button"
                                  onClick={() =>
                                    mutate(
                                      {
                                        type: "job/archive",
                                        id: job.id,
                                        archived: false,
                                      },
                                      "Job restored",
                                    )
                                  }
                                >
                                  <Archive size={14} />Restore
                                </button>
                              ) : (
                                <button
                                  className="text-button"
                                  onClick={() => {
                                    setJobId(job.id);
                                    open({ type: "shift", date: day });
                                  }}
                                >
                                  Add shift <Plus size={15} />
                                </button>
                              )}
                            </div>
                          </section>
                        );
                      })}
                  </div>

                  {!state.jobs.some(
                    (j) => j.archived === showArchived,
                  ) ? (
                    <div className="glass">
                      <Empty
                        title={
                          showArchived
                            ? "A place for your past jobs."
                            : "Make room for your first job."
                        }
                        text={
                          showArchived
                            ? "Archived jobs keep their shifts and reports. They will appear here when you archive one."
                            : "Enter a job name and hourly rate. Add as many different jobs as you need."
                        }
                        icon={<BriefcaseBusiness size={29} />}
                        action={
                          !showArchived ? (
                            <button
                              className="btn primary"
                              onClick={() => open({ type: "job" })}
                            >
                              <Plus size={17} />Add your first job
                            </button>
                          ) : undefined
                        }
                      />
                    </div>
                  ) : null}

                  <div className="glass useful-note">
                    <ShieldCheck size={22} />
                    <p>
                      Changing a job’s rate only changes the default for
                      future entries. Each saved shift keeps its own hourly rate.
                    </p>
                  </div>
                </>
              ) : null}

              {tab === "reports" ? (
                <Reports
                  state={state}
                  day={day}
                  kind={reportKind}
                  anchor={anchor}
                  month={month}
                  jobId={filter}
                  busy={pdfBusy}
                  onKind={setReportKind}
                  onAnchor={changeWeek}
                  onMonth={(value) => {
                    if (validDate(value + "-01")) setMonth(value);
                  }}
                  onJob={setJobId}
                  onPdf={makePdf}
                  onCsv={makeCsv}
                />
              ) : null}

              {tab === "settings" ? (
                <>
                  <div className="page-intro">
                    <div>
                      <span className="eyebrow">MAKE YOURSELF AT HOME</span>
                      <h1>The little<span> details.</span></h1>
                      <p>Your preferences, records and a little help.</p>
                    </div>
                  </div>

                  <div className="settings-grid">
                    <section className="glass settings-card">
                      <div className="section-heading">
                        <h2>Your preferences</h2>
                        <Settings2 size={18} />
                      </div>
                      <ProfileForm
                        key={`${state.settings.displayName}-${state.settings.currency}-${state.settings.timeZone}`}
                        settings={state.settings}
                        busy={busy}
                        error={formError}
                        onSave={async (settings) => {
                          await mutate(
                            { type: "settings/save", settings },
                            "Preferences saved",
                          );
                        }}
                      />
                    </section>

                    <div className="settings-stack">
                      <section className="glass settings-card storage-card">
                        <ShieldCheck size={25} />
                        <h2>Your records stay with you.</h2>
                        <p>
                          MyHours saves on this device, including offline.
                          It doesn’t send your jobs or pay to an employer.
                          This version has no cloud account or automatic
                          cross-device sync.
                        </p>
                        <p>
                          Keep a backup before clearing browser data or changing
                          phones. Safari and Chrome can keep separate copies.
                        </p>

                        <div className="storage-actions">
                          <button
                            className="btn secondary small"
                            onClick={backup}
                          >
                            <ArrowDownToLine size={16} />Back up records
                          </button>
                          <button
                            className="btn secondary small"
                            onClick={() => fileRef.current?.click()}
                          >
                            <ArrowUpFromLine size={16} />Restore backup
                          </button>
                        </div>

                        <input
                          className="sr-only"
                          ref={fileRef}
                          type="file"
                          accept="application/json,.json"
                          aria-label="Choose MyHours backup"
                          onChange={(e) =>
                            chooseBackup(e.target.files?.[0])
                          }
                        />

                        <button
                          className="text-button persist-button"
                          onClick={async () => {
                            try {
                              const granted =
                                await navigator.storage?.persist?.();
                              notify(
                                granted
                                  ? "Persistent storage is enabled. Keep regular backups too."
                                  : "This browser manages storage automatically. Keep regular backups.",
                              );
                            } catch {
                              notify(
                                "This browser manages storage automatically. Keep a backup of your records.",
                              );
                            }
                          }}
                        >
                          Request persistent storage
                          <ArrowRight size={13} />
                        </button>
                      </section>

                      <button
                        className="glass install-card"
                        onClick={installApp}
                      >
                        <span className="install-icon">
                          <Smartphone size={25} />
                        </span>
                        <div>
                          <h3>
                            {pwa.installed
                              ? "MyHours is on your Home Screen."
                              : "Make room on your Home Screen."}
                          </h3>
                          <p>
                            {pwa.installed
                              ? "Your own little space for your hours."
                              : "Install MyHours from Safari or Chrome."}
                          </p>
                        </div>
                        <ChevronRight size={19} />
                      </button>
                    </div>
                  </div>

                  <section className="glass history-card">
                    <div className="section-heading">
                      <div>
                        <h2><History size={18} />A clear edit history</h2>
                        <p>
                          Original details stay available when you change an entry.
                        </p>
                      </div>
                    </div>

                    {state.history.length ? (
                      <div className="history-list">
                        {state.history.slice(0, 25).map((change) => (
                          <button
                            key={change.id}
                            onClick={() =>
                              open({ type: "change", change })
                            }
                          >
                            <span><History size={15} /></span>
                            <div>
                              <strong>{change.label}</strong>
                              <small>
                                {new Intl.DateTimeFormat("en-GB", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                  timeZone: state.settings.timeZone,
                                }).format(new Date(change.date))}
                              </small>
                            </div>
                            <ChevronRight size={17} />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="history-empty">
                        Changes will appear here as you update your jobs and shifts.
                      </p>
                    )}
                  </section>

                  <section className="glass about-card">
                    <div className="brand-mark">
                      <Hourglass size={24} />
                    </div>
                    <div>
                      <h2>MyHours <span>1.0</span></h2>
                      <p>
                        Your time, clearly counted. Made for multiple jobs
                        and real working days.
                      </p>
                      <Creator />
                    </div>
                  </section>

                  {!preview ? (
                    <div className="settings-danger">
                      <button
                        className="text-button danger-text"
                        onClick={() => {
                          setDeleteWord("");
                          open({ type: "reset" });
                        }}
                      >
                        <Trash2 size={14} />Reset this device’s records
                      </button>
                      <button className="text-button" onClick={startDemo}>
                        <Sparkles size={14} />Explore sample data
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}

              <footer className="app-footer">
                <span>
                  <Hourglass size={14} />A calmer way to keep time.
                </span>
                <Creator />
              </footer>
            </>
          )}
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Main navigation">
        {navigation.map((n) => (
          <button
            key={n.id}
            className={tab === n.id ? "selected" : ""}
            aria-current={tab === n.id ? "page" : undefined}
            onClick={() => navigate(n.id)}
          >
            <span>
              <n.icon
                size={21}
                strokeWidth={tab === n.id ? 2 : 1.65}
              />
            </span>
            <small>{n.label}</small>
          </button>
        ))}
      </nav>

      {toast ? (
        <div className="toast" role="status">
          <span><Check size={16} /></span>
          <p>{toast}</p>
          {undo ? (
            <button
              onClick={async () => {
                if (
                  await mutate(
                    { type: "shift/restore", shift: undo },
                    "Shift restored",
                  )
                ) {
                  setUndo(null);
                }
              }}
            >
              Undo
            </button>
          ) : null}
          <button
            className="icon-btn"
            aria-label="Dismiss message"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      ) : null}

      {modal?.type === "job" ? (
        <JobForm
          job={modal.job}
          currency={state.settings.currency}
          busy={busy}
          error={formError}
          onClose={close}
          canDelete={Boolean(
            modal.job &&
              !state.shifts.some((s) => s.jobId === modal.job!.id),
          )}
          onSave={async (input) => {
            if (
              await mutate(
                { type: "job/save", input, id: modal.job?.id },
                modal.job
                  ? "Job updated. Saved shifts keep their rates."
                  : "Job added. You’re ready to log your hours.",
              )
            ) {
              close();
              if (!state.jobs.length) navigate("home");
            }
          }}
          onArchive={
            modal.job
              ? async () => {
                  if (
                    await mutate(
                      {
                        type: "job/archive",
                        id: modal.job!.id,
                        archived: !modal.job!.archived,
                      },
                      modal.job!.archived
                        ? "Job restored"
                        : "Job archived. Its shifts are still in your reports.",
                    )
                  ) {
                    close();
                  }
                }
              : undefined
          }
          onDelete={
            modal.job
              ? async () => {
                  if (
                    await mutate(
                      { type: "job/delete", id: modal.job!.id },
                      "Empty job deleted",
                    )
                  ) {
                    close();
                  }
                }
              : undefined
          }
        />
      ) : null}

      {modal?.type === "shift" ? (
        <ShiftForm
          shift={modal.shift}
          state={state}
          day={modal.date}
          today={day}
          preferredJob={filter === "all" ? undefined : filter}
          mode={modal.mode}
          busy={busy}
          error={formError}
          onClose={close}
          onSave={async (input) => {
            if (
              await mutate(
                {
                  type: "shift/save",
                  input,
                  id: modal.shift?.id,
                  expectedUpdatedAt: modal.shift?.updatedAt,
                },
                input.end === null
                  ? "Start time saved. Add the finish when you’re ready."
                  : "Shift saved. Your totals are up to date.",
              )
            ) {
              close();
              setAnchor(input.date);
              setSelectedDay(input.date);
              setMonth(input.date.slice(0, 7));
            }
          }}
        />
      ) : null}

      {modal?.type === "delete" ? (
        <Modal
          title="Remove this shift?"
          busy={busy}
          onClose={close}
          subtitle={`${dateLabel(modal.shift.date, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })} · ${
            state.jobs.find((j) => j.id === modal.shift.jobId)?.name
          }`}
        >
          <p className="dialog-copy">
            Your hours and pay will be recalculated.
            The original entry stays in your edit history.
          </p>
          {formError ? (
            <p className="form-error" role="alert">{formError}</p>
          ) : null}

          <div className="modal-actions">
            <button
              className="btn secondary"
              disabled={busy}
              onClick={close}
            >
              Keep shift
            </button>
            <button
              className="btn danger"
              disabled={busy}
              onClick={async () => {
                const removed = modal.shift;
                if (
                  await mutate(
                    { type: "shift/delete", id: removed.id },
                    "Shift removed",
                  )
                ) {
                  close();
                  setUndo(removed);
                }
              }}
            >
              <Trash2 size={17} />Remove shift
            </button>
          </div>
        </Modal>
      ) : null}

      {modal?.type === "install" ? (
        <Modal
          title={
            pwa.installed
              ? "Right at home."
              : "Your hours. In your pocket."
          }
          subtitle={
            pwa.installed
              ? "MyHours is installed on this device."
              : "Add MyHours to your Home Screen for an app-like experience."
          }
          onClose={close}
        >
          <div className="install-guide">
            <div className="install-guide-icon">
              <Hourglass size={36} />
            </div>

            {pwa.canInstall ? (
              <button
                className="btn primary full"
                onClick={installApp}
              >
                Install MyHours <Download size={18} />
              </button>
            ) : null}

            <section>
              <h3>iPhone or iPad · Safari</h3>
              <ol>
                <li>Open your MyHours address in Safari.</li>
                <li>
                  Tap <strong>Share</strong>, then{" "}
                  <strong>Add to Home Screen</strong>.
                </li>
                <li>
                  Turn on <strong>Open as Web App</strong> if shown,
                  then tap <strong>Add</strong>.
                </li>
              </ol>
            </section>

            <section>
              <h3>Android · Chrome</h3>
              <ol>
                <li>Open your MyHours address in Chrome.</li>
                <li>Open the three-dot menu.</li>
                <li>
                  Choose <strong>Install app</strong> or{" "}
                  <strong>Add to Home screen</strong>.
                </li>
              </ol>
            </section>

            <p className="form-hint">
              Open the deployed HTTPS address online once so the app
              and PDF fonts can be saved for offline use.
            </p>
          </div>
        </Modal>
      ) : null}

      {ready ? (
        <Modal
          title="Your timesheet is ready."
          subtitle={ready.period.label}
          onClose={() => setReady(null)}
        >
          <div className="report-ready">
            <span><FileText size={34} /></span>
            <h3>One PDF. All the details.</h3>
            <p>
              {ready.name}<br />
              {ready.count} shifts · {hoursLabel(ready.minutes)} paid
              {ready.includePay
                ? ` · ${money(
                    ready.gross,
                    state.settings.currency,
                  )} estimated gross`
                : " · Hours only"}
            </p>

            <a
              className="btn primary full"
              href={ready.url}
              download={ready.filename}
            >
              <ArrowDownToLine size={18} />Download PDF
            </a>

            {navigator.canShare &&
            navigator.canShare({
              files: [
                new File([ready.blob], ready.filename, {
                  type: "application/pdf",
                }),
              ],
            }) ? (
              <button
                className="btn secondary full"
                onClick={async () => {
                  try {
                    await navigator.share({
                      title: "MyHours timesheet",
                      files: [
                        new File([ready.blob], ready.filename, {
                          type: "application/pdf",
                        }),
                      ],
                    });
                  } catch (error) {
                    if ((error as Error).name !== "AbortError") {
                      notify(
                        "Sharing is unavailable here. Use Download PDF instead.",
                      );
                    }
                  }
                }}
              >
                <Share2 size={18} />Share PDF
              </button>
            ) : null}

            <p className="form-hint">
              On iPhone, you can save to Files or share the PDF
              from its preview.
            </p>
          </div>
        </Modal>
      ) : null}

      {modal?.type === "restore" ? (
        <Modal
          title="Bring your records back."
          subtitle="Review this backup before restoring it."
          busy={busy}
          onClose={close}
        >
          <div className="restore-summary">
            <span>
              <BriefcaseBusiness size={18} />{modal.data.jobs.length} jobs
            </span>
            <span>
              <CalendarDays size={18} />{modal.data.shifts.length} shifts
            </span>
            <span>
              <Wallet size={18} />{modal.data.settings.currency}
            </span>
          </div>

          <p className="dialog-copy">
            Restoring replaces the records on this device.
            Download a backup of your current records first if you
            want to keep them. Imported backups start a fresh edit history.
          </p>

          <button className="text-button" onClick={backup}>
            <ArrowDownToLine size={15} />Back up current records first
          </button>

          {formError ? (
            <p className="form-error" role="alert">{formError}</p>
          ) : null}

          <div className="modal-actions">
            <button
              className="btn secondary"
              disabled={busy}
              onClick={close}
            >
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={busy}
              onClick={async () => {
                if (
                  await mutate(
                    { type: "data/replace", state: modal.data },
                    "Backup restored",
                  )
                ) {
                  close();
                  setJobId("all");
                  navigate("home");
                }
              }}
            >
              <ArrowUpFromLine size={17} />Restore backup
            </button>
          </div>
        </Modal>
      ) : null}

      {modal?.type === "reset" ? (
        <Modal
          title="Start with a clean page?"
          busy={busy}
          onClose={close}
          subtitle="This removes all jobs, shifts, preferences and history saved by MyHours on this device."
        >
          <p className="dialog-copy">
            Download a backup first if you want to keep a copy of your records.
          </p>

          <button className="text-button" onClick={backup}>
            <ArrowDownToLine size={15} />Download a backup
          </button>

          <label className="reset-label">
            Type DELETE to confirm
            <input
              value={deleteWord}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setDeleteWord(e.target.value)}
            />
          </label>

          {formError ? (
            <p className="form-error" role="alert">{formError}</p>
          ) : null}

          <div className="modal-actions">
            <button
              className="btn secondary"
              disabled={busy}
              onClick={close}
            >
              Keep my records
            </button>
            <button
              className="btn danger"
              disabled={busy || deleteWord !== "DELETE"}
              onClick={async () => {
                if (
                  await mutate(
                    { type: "data/reset" },
                    "All local records reset",
                  )
                ) {
                  close();
                  setJobId("all");
                  navigate("home");
                }
              }}
            >
              Reset records
            </button>
          </div>
        </Modal>
      ) : null}

      {modal?.type === "change" ? (
        <Modal
          title="A clear record of the change."
          subtitle={modal.change.label}
          wide
          onClose={close}
        >
          <div className="change-comparison">
            {[
              { label: "Before", value: modal.change.before },
              { label: "After", value: modal.change.after },
            ].map((side) => (
              <section key={side.label}>
                <h3>{side.label}</h3>
                {side.value ? (
                  <ChangeDetails item={side.value} state={state} />
                ) : (
                  <p className="muted">
                    {side.label === "Before"
                      ? "New record"
                      : "Record removed"}
                  </p>
                )}
              </section>
            ))}
          </div>

          {modal.change.kind === "shift" &&
          modal.change.before &&
          "jobId" in modal.change.before &&
          !modal.change.after &&
          !state.shifts.some(
            (s) => s.id === modal.change.before!.id,
          ) ? (
            <div className="modal-actions">
              <button
                className="btn secondary"
                onClick={async () => {
                  if (
                    await mutate(
                      {
                        type: "shift/restore",
                        shift: modal.change.before as Shift,
                      },
                      "Shift restored",
                    )
                  ) {
                    close();
                  }
                }}
              >
                Restore this shift
              </button>
            </div>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}

function ChangeDetails({
  item,
  state,
}: {
  item: Shift | Job;
  state: AppState;
}) {
  const rows: [string, string][] =
    "jobId" in item
      ? [
          [
            "Job",
            state.jobs.find((j) => j.id === item.jobId)?.name || "Job",
          ],
          ["Date", item.date],
          ["Start", item.start],
          ["Finish", item.end || "In progress"],
          ["Next day", item.nextDay ? "Yes" : "No"],
          ["Unpaid break", `${item.unpaidBreak} min`],
          ["Hourly rate", money(item.rate, state.settings.currency)],
          ["Note", item.note || "—"],
        ]
      : [
          ["Job", item.name],
          ["Role", item.role || "—"],
          ["Hourly rate", money(item.rate, state.settings.currency)],
          ["Default break", `${item.defaultBreak} min`],
          ["Archived", item.archived ? "Yes" : "No"],
        ];

  return (
    <dl>
      {rows.map(([key, value]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}