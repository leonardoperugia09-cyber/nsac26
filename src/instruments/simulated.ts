/** A stand-in heart-rate strap for demos without hardware: a calm 62 to 72 bpm with gentle drift. */
export function startSimulatedStrap(
  onBpm: (bpm: number, at: Date) => void,
  intervalMs = 1000,
): { name: "Simulated strap"; stop(): void } {
  let level = 67;
  const tick = () => {
    // Random walk pulled back toward 67, plus a little beat-to-beat noise
    level += (67 - level) * 0.05 + (Math.random() - 0.5) * 0.8;
    const bpm = Math.round(level + (Math.random() - 0.5) * 2);
    onBpm(Math.min(72, Math.max(62, bpm)), new Date());
  };
  tick();
  const timer = setInterval(tick, intervalMs);
  return { name: "Simulated strap", stop: () => clearInterval(timer) };
}
