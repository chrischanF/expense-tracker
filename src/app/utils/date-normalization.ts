const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function normalizeDateToIsoUtc(value: string | Date): string {
  const date = value instanceof Date ? new Date(value.getTime()) : parseDate(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid date value: ${String(value)}`);
  }
  return date.toISOString();
}

export function toLocalDateInputValue(value: string | Date): string {
  if (typeof value === 'string' && DATE_INPUT_PATTERN.test(value)) {
    return value;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function parseDate(value: string): Date {
  const match = DATE_INPUT_PATTERN.exec(value);
  if (!match) {
    return new Date(value);
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return new Date(Number.NaN);
  }
  return date;
}
