/**
 * Returns YYYY-MM-DD in local time format instead of UTC ISO string, 
 * preventing date timezone drift for Indonesia (UTC+7, UTC+8, UTC+9).
 */
export const getLocalDateStr = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
