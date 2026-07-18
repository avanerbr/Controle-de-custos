"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category, ExpenseView, GroupType, IncomeGroupType, IncomeView } from "@/types/database";
import { currentMonthRef, formatBRL, formatMonthLabel, lastNMonths } from "@/lib/utils";
import MonthPicker from "@/components/MonthPicker";
import EvolutionChart, { EvolutionPoint } from "@/components/EvolutionChart";
import CategoryBreakdownChart, { BreakdownItem } from "@/components/CategoryBreakdownChart";

const HISTORY_MONTHS = 12;
const ALERT_THRESHOLD = 1.2; // 20% acima da média histórica

const GROUPS: { key: GroupType; label: string; color: string }[] = [
  { key: "casa", label: "Casa", color: "#2563eb" },
  { key: "empresa", label: "Empresa", color: "#16a34a" },
  { key: "investimento", label: "Investimento", color: "#a855f7" },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const supabase = createClient();
  const [month, setMonth] = useState(currentMonthRef());
  const [allExpenses, setAllExpenses] = useState<ExpenseView[]>([]);
  const [incomes, setIncomes] = useState<IncomeView[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // lançamento rápido
  const [quickGroup, setQuickGroup] = useState<GroupType>("casa");
  const [quickAmount, setQuickAmount] = useState("");
  const [quickNote, setQuickNote] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  const months = useMemo(() => lastNMonths(HISTORY_MONTHS), []);

  async function loadAll() {
    setLoading(true);
    const [{ data: expensesData }, { data: incomesData }, { data: categoriesData }] = await Promise.all([
      supabase.from("expenses_view").select("*").gte("month_ref", months[0]).order("expense_date", { ascending: true }),
      supabase.from("incomes_view").select("*").eq("month_ref", month),
      supabase.from("categories").select("*").eq("archived", false),
    ]);
    if (expensesData) setAllExpenses(expensesData as ExpenseView[]);
    if (incomesData) setIncomes(incomesData as IncomeView[]);
    if (categoriesData) setCategories(categoriesData as Category[]);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const evolutionData: EvolutionPoint[] = useMemo(() => {
    return months.map((m) => {
      const inMonth = allExpenses.filter((e) => e.month_ref === m);
      const totals: Record<GroupType, number> = { casa: 0, empresa: 0, investimento: 0 };
      for (const e of inMonth) totals[e.group_type] += Number(e.amount);
      return {
        label: formatMonthLabel(m),
        casa: totals.casa,
        empresa: totals.empresa,
        investimento: totals.investimento,
        total: totals.casa + totals.empresa + totals.investimento,
      };
    });
  }, [allExpenses, months]);

  const selectedMonthExpenses = useMemo(
    () => allExpenses.filter((e) => e.month_ref === month),
    [allExpenses, month]
  );

  const totalsByGroup = useMemo(() => {
    const totals: Record<GroupType, number> = { casa: 0, empresa: 0, investimento: 0 };
    for (const e of selectedMonthExpenses) totals[e.group_type] += Number(e.amount);
    return totals;
  }, [selectedMonthExpenses]);

  const incomeByGroup = useMemo(() => {
    const totals: Record<IncomeGroupType, number> = { casa: 0, empresa: 0 };
    for (const i of incomes) totals[i.group_type] += Number(i.amount);
    return totals;
  }, [incomes]);

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

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(quickAmount.replace(",", "."));
    if (!value || value <= 0) {
      setQuickError("Informe um valor válido.");
      return;
    }

    // usa a primeira categoria "avulsa" do grupo escolhido; se não achar, usa a primeira categoria do grupo
    const groupCategories = categories.filter((c) => c.group_type === quickGroup);
    const targetCategory =
      groupCategories.find((c) => !c.recurring) ?? groupCategories[0];

    if (!targetCategory) {
      setQuickError("Crie uma categoria nesse grupo primeiro (em Categorias).");
      return;
    }

    setQuickSaving(true);
    setQuickError(null);

    const { error } = await supabase.from("expenses").insert({
      category_id: targetCategory.id,
      amount: value,
      expense_date: todayStr(),
      paid: true,
      note: quickNote || null,
    });

    setQuickSaving(false);

    if (error) {
      setQuickError("Não foi possível salvar.");
      return;
    }

    setQuickAmount("");
    setQuickNote("");
    loadAll();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Evolução dos gastos de Casa, Empresa e Investimento</p>
        </div>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      <form onSubmit={handleQuickAdd} className="card">
        <h2 className="font-medium text-slate-900 mb-3">Lançamento rápido de hoje</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="label">Grupo</label>
            <select
              className="input"
              value={quickGroup}
              onChange={(e) => setQuickGroup(e.target.value as GroupType)}
            >
              {GROUPS.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Valor (R$)</label>
            <input
              className="input"
              inputMode="decimal"
              placeholder="0,00"
              value={quickAmount}
              onChange={(e) => setQuickAmount(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 md:col-span-1">
            <label className="label">O que é?</label>
            <input
              className="input"
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
              placeholder="Ex.: almoço, uber..."
            />
          </div>
          <button type="submit" className="btn-primary" disabled={quickSaving}>
            {quickSaving ? "Salvando..." : "Adicionar"}
          </button>
        </div>
        {quickError && <p className="text-sm text-red-600 mt-2">{quickError}</p>}
      </form>

      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {GROUPS.map((g) => (
              <SummaryCard key={g.key} label={g.label} value={totalsByGroup[g.key]} color={g.color} />
            ))}
            <SummaryCard
              label="Total do mês"
              value={totalsByGroup.casa + totalsByGroup.empresa + totalsByGroup.investimento}
              color="#0f172a"
            />
          </div>

          <SaldoCard
            label="Saldo geral (Casa + Empresa)"
            income={incomeByGroup.casa + incomeByGroup.empresa}
            expense={totalsByGroup.casa + totalsByGroup.empresa}
          />

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

          <div className="grid md:grid-cols-3 gap-6">
            {GROUPS.map((g) => (
              <div key={g.key} className="card">
                <h2 className="font-medium text-slate-900 mb-3">
                  {g.label} por categoria — {formatMonthLabel(month)}
                </h2>
                {breakdownFor(g.key).length > 0 ? (
                  <CategoryBreakdownChart data={breakdownFor(g.key)} />
                ) : (
                  <p className="text-sm text-slate-400">Sem lançamentos neste mês.</p>
                )}
              </div>
            ))}
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

function SaldoCard({ label, income, expense }: { label: string; income: number; expense: number }) {
  const saldo = income - expense;
  return (
    <div className="card">
      <p className="text-xs font-medium text-slate-500 mb-2">{label}</p>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">Entradas</span>
        <span className="text-green-700 font-medium">{formatBRL(income)}</span>
      </div>
      <div className="flex items-center justify-between text-sm mt-1">
        <span className="text-slate-500">Despesas</span>
        <span className="text-red-600 font-medium">{formatBRL(expense)}</span>
      </div>
      <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-slate-100">
        <span className="text-slate-700 font-medium">Sobra</span>
        <span className={`font-semibold ${saldo >= 0 ? "text-green-700" : "text-red-600"}`}>
          {formatBRL(saldo)}
        </span>
      </div>
    </div>
  );
}
