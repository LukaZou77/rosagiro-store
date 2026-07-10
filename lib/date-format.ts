const ADMIN_TIME_ZONE = "America/Sao_Paulo";

const adminDateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: ADMIN_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZoneName: "short"
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: ADMIN_TIME_ZONE,
  day: "2-digit",
  month: "long",
  year: "numeric"
});

export function formatAdminDateTime(value?: Date | string | null, fallback = "Sem registro") {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return adminDateTimeFormatter.format(date);
}

export function formatDatePtBr(value?: Date | string | null, fallback = "Sem registro") {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return dateFormatter.format(date);
}
