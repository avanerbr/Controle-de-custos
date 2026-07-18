"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ExpenseView, GroupType } from "@/types/database";
import { currentMonthRef, formatBRL, formatMonthLabel, lastNMonths } from "@/lib/utils";
import MonthPicker from "@/components/MonthPicker";
import EvolutionChart, { EvolutionPoint } from "@/components/EvolutionChart";
import CategoryBreakdownChart, { BreakdownItem } from "@/components/CategoryBreakdownChart";

const HISTORY_MONTHS = 12;
const ALERT_THRESHOLD = 1.2; // 20% acima da média histórica

export default function DashboardPage() {
  const supabase = createClient();
  const [month, setMonth] = useState(currentMonthRef());
  const [allExpenses, setAllExpenses] = useState<ExpenseView[]>([]);
  const [loading, setLoading] = useState(true);

  const months = useMemo(() => lastNMonths(HISTORY_MONTHS), []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("expenses_view")
        .select("*")
        .gte("month_ref", months[0])
        .order("expense_date", { ascending: true });
      if (data) setAllExpenses(data as ExpenseView[]);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const evolutionData: EvolutionPoint[] = useMemo(() => {
    return months.map((m) => {
      const inMonth = allExpenses.filter((e) => e.month_ref === m);
      const casa = inMonth.filter((e) => e.group_type === "casa").reduce((s, e) => s + Number(e.amount), 0);
      const empresa = inMonth
        .filter((e) => e.group_type === "empresa")
        .reduce((s, e) => s + Number(e.amount), 0);
      return { label: formatMonthLabel(m), casa, empresa, total: casa + empresa };
    });
  }, [allExpenses, months]);

  const selectedMonthExpenses = useMemo(
    () => allExpenses.filter((e) => e.month_ref === month),
    [allExpenses, month]
  );

  const totalsByGroup = useMemo(() => {
    const totals: Record<GroupType, number> = { casa: 0, empresa: 0 };
    for (const e of selectedMonthExpenses) totals[e.group_type] += Number(e.amount);
    return totals;
  }, [selectedMonthExpenses]);

  function breakdownFor(group: GroupType): BreakdownItem[] {
    const map = new Map<string, BreakdownItem>();
    for (const e of selectedMonthExpenses.filter((x) => x.group_type === group)) {
      const existing = map.get(e.category_name);
      if (existing) {
        existing.value += Number(e.amount);
      } else {
        map.set(e.category_name, { name: e.category_name, value: Number(e.amount), color: e.color });
      }
    }
    return Array.from(map.values());
  }

  const alerts = useMemo(() => {
    const priorMonths = months.filter((m) => m < month).slice(-6);
    if (priorMonths.length === 0) return [];

    const byCategory = new Map<
      string,
      { name: string; group: GroupType; color: string; history: number[]; current: number }
    >();

    for (const e of allExpenses) {
      if (!priorMonths.includes(e.month_ref) && e.month_ref !== month) continue;
      const key = e.category_id;
      if (!byCategory.has(key)) {
        byCategory.set(key, {
          name: e.category_name,
          group: e.group_type,
          color: e.color,
          history: [],
          current: 0,
        });
      }
      const entry = byCategory.get(key)!;
      if (e.month_ref === month) {
        entry.current += Number(e.amount);
      }
    }

    // sum history per month then average, so months with no expense count as 0
    for (const [key, entry] of byCategory) {
      const monthTotals = priorMonths.map((m) =>
        allExpenses
          .filter((e) => e.category_id === key && e.month_ref === m)
          .reduce((s, e) => s + Number(e.amount), 0)
      );
      entry.history = monthTotals;
    }

    const results: { name: string; group: GroupType; color: string; avg: number; current: number }[] = [];
    for (const entry of byCategory.values()) {
      const avg = entry.history.reduce((a, b) => a + b, 0) / entry.history.length;
      if (avg > 0 && entry.current > avg * ALERT_THRESHOLD) {
        results.push({ name: entry.name, group: entry.group, color: entry.color, avg, current: entry.current });
      }
    }

    return results.sort((a, b) => b.current - b.avg - (a.current - a.avg));
  }, [allExpenses, months, month]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Evolução dos gastos de Casa e Empresa</p>
        </div>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-4">
            <SummaryCard label="Casa" value={totalsByGroup.casa} color="#2563eb" />
            <SummaryCard label="Empresa" value={totalsByGroup.empresa} color="#16a34a" />
            <SummaryCard
              label="Total do mês"
              value={totalsByGroup.casa + totalsByGroup.empresa}
              color="#0f172a"
            />
          </div>

          <div className="card">
            <h2 className="font-medium text-slate-900 mb-4">
              Evolução dos últimos {HISTORY_MONTHS} meses
            </h2>
            <EvolutionChart data={evolutionData} />
          </div>

          {alerts.length > 0 && (
            <div className="card border-red-200 bg-red-50/40">
              <h2 className="font-medium text-red-700 mb-3">
                ⚠ Categorias acima da média histórica em {formatMonthLabel(month)}
              </h2>
              <ul className="space-y-2">
                {alerts.map((a) => (
                  <li
                    key={a.group + a.name}
                    className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2 border border-red-100"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                      <span className="text-slate-800">{a.name}</span>
                      <span className="text-[10px] uppercase text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">
                        {a.group}
                      </span>
                    </div>
                    <span className="text-red-600 font-medium">
                      {formatBRL(a.current)}{" "}
                      <span className="text-slate-400 font-normal">
                        (média {formatBRL(a.avg)})
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <div className="card">
              <h2 className="font-medium text-slate-900 mb-3">
                Casa por categoria — {formatMonthLabel(month)}
              </h2>
              {breakdownFor("casa").length > 0 ? (
                <CategoryBreakdownChart data={breakdownFor("casa")} />
              ) : (
                <p className="text-sm text-slate-400">Sem lançamentos neste mês.</p>
              )}
            </div>
            <div className="card">
              <h2 className="font-medium text-slate-900 mb-3">
                Empresa por categoria — {formatMonthLabel(month)}
              </h2>
              {breakdownFor("empresa").length > 0 ? (
                <CategoryBreakdownChart data={breakdownFor("empresa")} />
              ) : (
                <p className="text-sm text-slate-400">Sem lançamentos neste mês.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-2xl font-semibold mt-1" style={{ color }}>
        {formatBRL(value)}
      </p>
    </div>
  );
}
