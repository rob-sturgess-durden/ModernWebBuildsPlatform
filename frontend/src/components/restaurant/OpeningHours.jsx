const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

function pad2(n) {
  const s = String(n ?? "");
  return s.length === 1 ? `0${s}` : s;
}

function coerceTime(v) {
  if (v == null) return "";
  const raw = String(v).trim();
  if (!raw) return "";

  const m = raw.match(/^(\d{1,2})(?::(\d{1,2}))?(?::\d{1,2})?$/);
  if (m) {
    const hh = Math.max(0, Math.min(23, parseInt(m[1], 10)));
    const mm = m[2] != null ? Math.max(0, Math.min(59, parseInt(m[2], 10))) : 0;
    return `${pad2(hh)}:${pad2(mm)}`;
  }

  const f = Number(raw);
  if (Number.isFinite(f)) {
    const hh = Math.max(0, Math.min(23, Math.floor(f)));
    const mm = Math.max(0, Math.min(59, Math.round((f - Math.floor(f)) * 60)));
    return `${pad2(hh)}:${pad2(mm)}`;
  }

  return "";
}

function parseRangeString(s) {
  const raw = String(s || "").trim();
  if (!raw) return null;
  const parts = raw.split(/[-–—]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const open = coerceTime(parts[0]);
  const close = coerceTime(parts[1]);
  if (!open || !close) return null;
  return { open, close };
}

function normalizeOpeningHours(input) {
  const out = Object.fromEntries(DAYS.map((d) => [d.key, []]));
  if (!input || typeof input !== "object") return out;

  const alias = {
    monday: "mon",
    tuesday: "tue",
    wednesday: "wed",
    thursday: "thu",
    friday: "fri",
    saturday: "sat",
    sunday: "sun",
  };

  for (const [kRaw, v] of Object.entries(input)) {
    const k = alias[String(kRaw).toLowerCase().trim()] || String(kRaw).toLowerCase().trim();
    if (!Object.prototype.hasOwnProperty.call(out, k)) continue;

    const addInterval = (it) => {
      const open = coerceTime(it?.open ?? it?.start ?? it?.from);
      const close = coerceTime(it?.close ?? it?.end ?? it?.to);
      if (open && close) out[k].push({ open, close });
    };

    if (typeof v === "string") {
      const parsed = parseRangeString(v);
      if (parsed) out[k].push(parsed);
      continue;
    }
    if (Array.isArray(v)) {
      v.forEach((it) => {
        if (typeof it === "string") {
          const parsed = parseRangeString(it);
          if (parsed) out[k].push(parsed);
          return;
        }
        if (it && typeof it === "object") addInterval(it);
      });
      continue;
    }
    if (v && typeof v === "object") {
      if ("open" in v || "close" in v || "start" in v || "end" in v || "from" in v || "to" in v) {
        addInterval(v);
      } else {
        Object.values(v).forEach((it) => it && typeof it === "object" && addInterval(it));
      }
    }
  }

  for (const d of DAYS) {
    out[d.key] = (out[d.key] || []).slice().sort((a, b) => String(a.open).localeCompare(String(b.open)));
  }
  return out;
}

function hasAnyIntervals(norm) {
  return DAYS.some((d) => (norm?.[d.key] || []).length > 0);
}

export default function OpeningHours({ openingHours }) {
  const norm = normalizeOpeningHours(openingHours);
  if (!hasAnyIntervals(norm)) return null;

  return (
    <div style={{ marginTop: "1rem" }}>
      <p className="meta-title" style={{ marginBottom: 8 }}>Opening hours</p>
      <div className="hours-list">
        {DAYS.map((d) => {
          const intervals = norm[d.key] || [];
          const text = intervals.length
            ? intervals.map((it) => `${it.open}–${it.close}`).join(", ")
            : "Closed";
          return (
            <div key={d.key} className="hours-row">
              <span className="hours-day">{d.label}</span>
              <span className="hours-time">{text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

