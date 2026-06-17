interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}

const PRESETS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

function todayISO(): string {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export default function DateRangePicker({ startDate, endDate, onChange }: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={startDate}
          onChange={(e) => onChange(e.target.value, endDate)}
          className="bg-surface-raised border border-border-default rounded-radius-input px-3 py-1.5 text-[12px] text-text-primary outline-none focus:border-accent-gold transition-colors"
        />
        <span className="text-text-muted text-[12px]">—</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onChange(startDate, e.target.value)}
          className="bg-surface-raised border border-border-default rounded-radius-input px-3 py-1.5 text-[12px] text-text-primary outline-none focus:border-accent-gold transition-colors"
        />
      </div>
      <div className="flex gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => onChange(daysAgoISO(p.days), todayISO())}
            className={
              "px-2.5 py-1.5 text-[11px] rounded-radius-input border transition-colors " +
              (startDate === daysAgoISO(p.days) && endDate === todayISO()
                ? "border-accent-gold text-accent-gold bg-accent-gold/10"
                : "border-border-default text-text-muted hover:text-text-primary hover:border-border-light")
            }
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => onChange("", "")}
          className={
            "px-2.5 py-1.5 text-[11px] rounded-radius-input border transition-colors " +
            (!startDate && !endDate
              ? "border-accent-gold text-accent-gold bg-accent-gold/10"
              : "border-border-default text-text-muted hover:text-text-primary hover:border-border-light")
          }
        >
          All
        </button>
      </div>
    </div>
  );
}
