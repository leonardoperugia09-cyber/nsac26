// Standard Bluetooth health profiles, read in the browser through Web Bluetooth (Chrome or Edge on a computer).
// The parsers are pure: they take the raw bytes a device sends and return values in HALO units.
import { LB_TO_KG, fToC, round } from "./types.ts";

const KPA_TO_MMHG = 7.50062;

/** IEEE 11073 16-bit SFLOAT: 4-bit signed exponent, 12-bit signed mantissa. Special values become NaN. */
export function readSfloat(view: DataView, offset: number): number {
  const raw = view.getUint16(offset, true);
  const mantissa = raw & 0x0fff;
  if (mantissa >= 0x07fe && mantissa <= 0x0802) return NaN; // NaN, NRes, +INF, -INF, reserved
  return scale(
    mantissa >= 0x0800 ? mantissa - 0x1000 : mantissa,
    raw >> 12 >= 0x8 ? (raw >> 12) - 0x10 : raw >> 12,
  );
}

/** IEEE 11073 32-bit FLOAT: 8-bit signed exponent, 24-bit signed mantissa. Special values become NaN. */
export function readFloat(view: DataView, offset: number): number {
  const raw = view.getUint32(offset, true);
  const mantissa = raw & 0xffffff;
  if (mantissa >= 0x7ffffe && mantissa <= 0x800002) return NaN;
  const exponent = raw >>> 24;
  return scale(
    mantissa >= 0x800000 ? mantissa - 0x1000000 : mantissa,
    exponent >= 0x80 ? exponent - 0x100 : exponent,
  );
}
// Divide for negative exponents so 1205e-1 is exactly 120.5
const scale = (m: number, e: number) => (e < 0 ? m / 10 ** -e : m * 10 ** e);

/** Bluetooth "Date Time" (7 bytes, device local time). Year 0 means the device did not know the time. */
function readDateTime(view: DataView, offset: number): Date | null {
  const year = view.getUint16(offset, true);
  if (!year) return null;
  const b = (i: number) => view.getUint8(offset + i);
  return new Date(year, b(2) - 1, b(3), b(4), b(5), b(6));
}

export type HeartRateReading = {
  bpm: number;
  /** null when the strap does not report skin contact */
  sensorContact: boolean | null;
  energyKj: number | null;
  /** Beat-to-beat intervals in milliseconds */
  rrIntervalsMs: number[];
};

/** Heart Rate Measurement, characteristic 0x2A37 (service 0x180D). */
export function parseHeartRate(view: DataView): HeartRateReading {
  const flags = view.getUint8(0);
  let i = 1;
  const wide = flags & 0x01;
  const bpm = wide ? view.getUint16(i, true) : view.getUint8(i);
  i += wide ? 2 : 1;
  const sensorContact = flags & 0x04 ? Boolean(flags & 0x02) : null;
  let energyKj: number | null = null;
  if (flags & 0x08) {
    energyKj = view.getUint16(i, true);
    i += 2;
  }
  const rrIntervalsMs: number[] = [];
  if (flags & 0x10)
    for (; i + 1 < view.byteLength; i += 2)
      rrIntervalsMs.push((view.getUint16(i, true) * 1000) / 1024);
  return { bpm, sensorContact, energyKj, rrIntervalsMs };
}

export type BloodPressureReading = {
  /** All pressures in mmHg, also when the cuff sent kPa */
  systolic: number;
  diastolic: number;
  meanArterial: number;
  pulseRate: number | null;
  at: Date | null;
};

/** Blood Pressure Measurement, characteristic 0x2A35 (service 0x1810). */
export function parseBloodPressure(view: DataView): BloodPressureReading {
  const flags = view.getUint8(0);
  const toMmHg = (v: number) => (flags & 0x01 ? round(v * KPA_TO_MMHG, 1) : v);
  let i = 7;
  let at: Date | null = null;
  if (flags & 0x02) {
    at = readDateTime(view, i);
    i += 7;
  }
  const pulseRate = flags & 0x04 ? readSfloat(view, i) : null;
  return {
    systolic: toMmHg(readSfloat(view, 1)),
    diastolic: toMmHg(readSfloat(view, 3)),
    meanArterial: toMmHg(readSfloat(view, 5)),
    pulseRate,
    at,
  };
}

export type TemperatureReading = { celsius: number; at: Date | null };

/** Temperature Measurement, characteristic 0x2A1C (service 0x1809). */
export function parseTemperature(view: DataView): TemperatureReading {
  const flags = view.getUint8(0);
  const value = readFloat(view, 1);
  return {
    celsius: flags & 0x01 ? round(fToC(value), 2) : value,
    at: flags & 0x02 ? readDateTime(view, 5) : null,
  };
}

export type WeightReading = { kg: number; at: Date | null };

/** Weight Measurement, characteristic 0x2A9D (service 0x181D). */
export function parseWeight(view: DataView): WeightReading {
  const flags = view.getUint8(0);
  const raw = view.getUint16(1, true);
  const imperial = flags & 0x01;
  const kg =
    raw === 0xffff
      ? NaN
      : imperial
        ? round(raw * 0.01 * LB_TO_KG, 2)
        : round(raw * 0.005, 3);
  return { kg, at: flags & 0x02 ? readDateTime(view, 3) : null };
}

// Minimal Web Bluetooth types (the @types/web-bluetooth package is not installed).
type Characteristic = EventTarget & {
  value?: DataView;
  startNotifications(): Promise<Characteristic>;
  stopNotifications(): Promise<Characteristic>;
};
type Device = EventTarget & {
  name?: string;
  gatt?: {
    connect(): Promise<{
      getPrimaryService(
        s: string,
      ): Promise<{ getCharacteristic(c: string): Promise<Characteristic> }>;
    }>;
    disconnect(): void;
  };
};
type Bluetooth = {
  requestDevice(options: {
    filters: { services: string[] }[];
  }): Promise<Device>;
};

/**
 * Pair a Bluetooth heart-rate strap (Polar H10 and similar) and report each beat-rate update.
 * Must be called from a click: the browser shows its own device picker.
 */
export async function connectHeartRate(
  onBpm: (bpm: number, at: Date) => void,
): Promise<{ name: string; disconnect(): void }> {
  const bluetooth =
    typeof navigator === "undefined"
      ? undefined
      : (navigator as unknown as { bluetooth?: Bluetooth }).bluetooth;
  if (!bluetooth)
    throw new Error("Bluetooth needs Chrome or Edge on a computer");
  const device = await bluetooth.requestDevice({
    filters: [{ services: ["heart_rate"] }],
  });
  if (!device.gatt)
    throw new Error("This device does not offer a heart-rate connection");
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService("heart_rate");
  const characteristic = await service.getCharacteristic(
    "heart_rate_measurement",
  );
  const onChange = () => {
    if (!characteristic.value) return;
    const { bpm, sensorContact } = parseHeartRate(characteristic.value);
    // A strap without skin contact sends 0 or stale numbers
    if (bpm > 0 && sensorContact !== false) onBpm(bpm, new Date());
  };
  characteristic.addEventListener("characteristicvaluechanged", onChange);
  await characteristic.startNotifications();
  return {
    name: device.name || "Heart-rate strap",
    disconnect() {
      characteristic.removeEventListener(
        "characteristicvaluechanged",
        onChange,
      );
      characteristic.stopNotifications().catch(() => {});
      device.gatt?.disconnect();
    },
  };
}
