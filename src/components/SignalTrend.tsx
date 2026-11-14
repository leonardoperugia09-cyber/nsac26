import { useMemo } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { SIGNAL_BY_KEY } from "../engine/signals.ts";
import { buildTrend, fmtNum, fmtRange, fmtUnit } from "../ui/healthData.ts";
import card from "./Card.module.css";
import s from "./SignalTrend.module.css";

type TickProps = { x?: number; y?: number; payload?: { value: number } };

function DayTick({ x = 0, y = 0, payload }: TickProps) {
  return (
    <text
      x={x}
      y={y + 14}
      textAnchor="middle"
      className={s.tick}
    >{`Day ${payload?.value ?? ""}`}</text>
  );
}

/** One signal over the last 30 days against the astronaut's own normal band. */
export function SignalTrend({
  crewId,
  day,
  signal,
}: {
  crewId: string;
  day: number;
  signal: string;
}) {
  const t = useMemo(
    () => buildTrend(crewId, day, signal),
    [crewId, day, signal],
  );
  const def = SIGNAL_BY_KEY[signal];
  const unit = fmtUnit(signal);

  const { domain, ticks } = useMemo(() => {
    if (!t.points.length)
      return { domain: [0, 1] as [number, number], ticks: [] };
    const vals = t.points.flatMap((p) => [p.value, ...p.band]);
    const lo = Math.min(...vals),
      hi = Math.max(...vals),
      pad = (hi - lo) * 0.12;
    const first = t.points[0].day,
      last = t.points[t.points.length - 1].day;
    const n = Math.min(4, t.points.length);
    const ticks = Array.from({ length: n }, (_, i) =>
      Math.round(first + ((last - first) * i) / Math.max(1, n - 1)),
    );
    return { domain: [lo - pad, hi + pad] as [number, number], ticks };
  }, [t]);

  if (!t.points.length)
    return (
      <section className={card.card}>
        <h3>{def.label}</h3>
        <p>
          Insufficient baseline or missing measurement. No normal result
          inferred.
        </p>
      </section>
    );
  return (
    <section className={`${card.card} ${s.card}`} aria-label={def.label}>
      <div className={s.top}>
        <h3 className={s.label}>{def.label}</h3>
        <div className={s.now}>
          <div className={`mono ${s.value} ${t.outNow ? s.out : ""}`}>
            {fmtNum(signal, t.now)}
            {unit && <small>{unit}</small>}
          </div>
          <p className={s.normal}>Your normal {fmtRange(signal, t.lo, t.hi)}</p>
          {t.outNow && <p className={s.outside}>Outside your normal</p>}
        </div>
      </div>
      <div
        className={s.plot}
        role="img"
        aria-label={`${def.label}, last 30 days, now ${fmtNum(signal, t.now)} ${unit}${t.outNow ? ", outside your normal" : ""}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={t.points}
            margin={{ top: 4, right: 28, bottom: 0, left: 28 }}
          >
            <XAxis
              dataKey="day"
              type="number"
              domain={["dataMin", "dataMax"]}
              ticks={ticks}
              axisLine={false}
              tickLine={false}
              tick={<DayTick />}
              height={24}
              interval={0}
            />
            <YAxis hide domain={domain} />
            <Area
              dataKey="band"
              stroke="none"
              fill="var(--band-card)"
              isAnimationActive={false}
            />
            <Line
              dataKey="value"
              stroke="#555C6B"
              strokeWidth={1.75}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="out"
              stroke="var(--line-out)"
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
