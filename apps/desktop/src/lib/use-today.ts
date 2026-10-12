import { getLocalTimeZone, today as todayIn, type CalendarDate } from '@internationalized/date';
import { useEffect, useState } from 'react';

const localToday = () => todayIn(getLocalTimeZone());

/**
 * Today's local date, which turns over at midnight: a form left open overnight
 * reads the new day. A timer waits for midnight; a Mac that slept through it
 * checks again when the window shows or gets the focus.
 */
export function useToday(): CalendarDate {
  const [today, setToday] = useState(localToday);

  useEffect(() => {
    const check = () =>
      setToday((current) => {
        const next = localToday();
        return next.compare(current) === 0 ? current : next;
      });
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    // A second past midnight, so the clock reads the new day.
    const timer = setTimeout(check, midnight.getTime() - now.getTime() + 1000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, [today]);

  return today;
}
