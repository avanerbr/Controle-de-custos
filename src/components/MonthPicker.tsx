"use client";

import { formatMonthLabel } from "@/lib/utils";

export default function MonthPicker({
  value,
  onChange,
}: {
  value: string; // yyyy-mm-01
  onChange: (value: string) => void;
}) {
  function shift(delta: number) {
    const [y, m] = value.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => shift(-1)} className="btn-secondary px-2 py-1 text-sm">
        ←
      </button>
      <span className="text-sm font-medium text-slate-800 w-28 text-center">
        {formatMonthLabel(value)}
      </span>
      <button onClick={() => shift(1)} className="btn-secondary px-2 py-1 text-sm">
        →
      </button>
    </div>
  );
}
