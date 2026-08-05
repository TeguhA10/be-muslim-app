/**
 * Returns YYYY-MM-DD in local time format instead of UTC ISO string, 
 * preventing date timezone drift for Indonesia (UTC+7, UTC+8, UTC+9).
 */
export const getLocalDateStr = (
  date: Date = new Date(),
  timezone: string = 'Asia/Jakarta'
): string => {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find(p => p.type === 'year')!.value;
  const month = parts.find(p => p.type === 'month')!.value;
  const day = parts.find(p => p.type === 'day')!.value;

  return `${year}-${month}-${day}`;
};
