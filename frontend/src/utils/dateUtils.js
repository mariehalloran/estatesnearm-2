import { format, isAfter, isBefore, isWithinInterval, parseISO } from 'date-fns';

export const formatDate = (date) => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'EEEE, MMMM d, yyyy');
};

export const formatShortDate = (date) => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'MMM d, yyyy');
};

export const getSaleStatus = (startDate, endDate) => {
  const now = new Date();
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;

  if (isAfter(now, end)) return 'ended';
  if (isBefore(now, start)) return 'upcoming';
  return 'active';
};

export const isSaleActive = (endDate) => {
  const now = new Date();
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
  return isAfter(end, now);
};
