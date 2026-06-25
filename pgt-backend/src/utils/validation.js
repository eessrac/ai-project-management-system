function normalizeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function isNonEmptyString(value) {
  return normalizeString(value).length > 0;
}

function isValidDateOnly(value) {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return false;

  return d.toISOString().slice(0, 10) === value;
}

module.exports = {
  normalizeString,
  isNonEmptyString,
  isValidDateOnly,
};
