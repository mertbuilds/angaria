import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parse } from "date-fns";
import { tr } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const GIB_FORMAT = "dd/MM/yyyy";
const GIB_FORMAT_DASH = "dd-MM-yyyy";

/** Parse a GIB date string (dd/MM/yyyy or dd-MM-yyyy) into a Date */
export function parseGIB(s: string): Date | undefined {
  if (!s) return undefined;
  try {
    const fmt = s.includes("/") ? GIB_FORMAT : GIB_FORMAT_DASH;
    const d = parse(s, fmt, new Date());
    return isNaN(d.getTime()) ? undefined : d;
  } catch {
    return undefined;
  }
}

/** Format a Date as dd/MM/yyyy for GIB API */
export function toGIB(d: Date | undefined): string {
  return d ? format(d, GIB_FORMAT) : "";
}

/** Format a GIB date string as human-readable Turkish (e.g. "19 Mart 2026") */
export function formatDateHuman(s: string): string {
  const d = parseGIB(s);
  return d ? format(d, "d MMMM yyyy", { locale: tr }) : s;
}
