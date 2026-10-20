import { useEffect, useMemo, useState } from "react";

export default function HomeClock({
  timeZone,
  compact = false,
}: {
  timeZone: string;
  compact?: boolean;
}) {
  const [now, setNow] = useState(() => new Date());

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }),
    [timeZone],
  );

  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = window.setInterval(tick, 1000);

    document.addEventListener("visibilitychange", tick);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const parts = formatter.formatToParts(now);

  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value || 0);

  const h = value("hour");
  const m = value("minute");
  const s = value("second");

  return (
    <div
      className={
        compact
          ? "glass live-clock compact-clock"
          : "welcome-clock live-clock"
      }
    >
      {!compact ? (
        <div className="clock-orbit" aria-hidden="true" />
      ) : null}

      <div className="glass-clock" aria-hidden="true">
        <span className="clock-twelve">12</span>
        <span className="clock-six">6</span>

        <span
          className="hand-hour"
          style={{
            transform: `rotate(${(h % 12) * 30 + m / 2 + s / 120}deg)`,
          }}
        />

        <span
          className="hand-minute"
          style={{
            transform: `rotate(${m * 6 + s / 10}deg)`,
          }}
        />

        <span
          className="hand-second"
          style={{
            transform: `rotate(${s * 6}deg)`,
          }}
        />

        <span className="clock-pin" />
      </div>

      <div className="live-clock-readout">
        <time dateTime={now.toISOString()}>
          {formatter.format(now)}
        </time>
        <span>{timeZone.replace(/_/g, " ")}</span>
      </div>
    </div>
  );
}