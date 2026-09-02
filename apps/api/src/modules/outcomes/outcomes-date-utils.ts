const DAY_IN_MS = 24 * 60 * 60 * 1000;

export interface MeasurementWindow {
  start: Date;
  end: Date;
}

export const buildMeasurementWindow = (
  measurementWindowStart: string,
  measurementWindowEnd: string,
): MeasurementWindow => ({
  start: new Date(measurementWindowStart),
  end: new Date(measurementWindowEnd),
});

export const buildWindowReference = (window: MeasurementWindow): string =>
  `${window.start.toISOString()}|${window.end.toISOString()}`;

export const calculateWindowDays = (window: MeasurementWindow): number =>
  Math.max(1, Math.ceil((window.end.getTime() - window.start.getTime()) / DAY_IN_MS));

export const subtractWindow = (window: MeasurementWindow): MeasurementWindow => {
  const durationMs = Math.max(DAY_IN_MS, window.end.getTime() - window.start.getTime());
  return {
    start: new Date(window.start.getTime() - durationMs),
    end: new Date(window.start.getTime()),
  };
};

export const maxDate = (left: Date, right: Date): Date =>
  left.getTime() >= right.getTime() ? left : right;

export const startOfUtcDay = (value: Date): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0));

export const endOfUtcDay = (value: Date): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999));

export const addUtcDays = (value: Date, days: number): Date =>
  new Date(value.getTime() + days * DAY_IN_MS);

export const diffUtcDays = (left: Date, right: Date): number =>
  Math.round((startOfUtcDay(left).getTime() - startOfUtcDay(right).getTime()) / DAY_IN_MS);

export const enumerateUtcDays = (window: MeasurementWindow): Date[] => {
  const days: Date[] = [];
  let cursor = startOfUtcDay(window.start);

  while (cursor.getTime() <= window.end.getTime()) {
    days.push(cursor);
    cursor = addUtcDays(cursor, 1);
  }

  return days;
};
