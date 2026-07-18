"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { IncomeGroupType, IncomeView } from "@/types/database";
import { currentMonthRef, formatBRL } from "@/lib/utils";
import MonthPicker from "@/components/MonthPicker";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function FaturamentoPage() {
  const supabase = createClient();
  const [month, setMonth] = useState(currentMonthRef());
  const [incomes, setIncomes] = useState<IncomeView[]>([]);
  const [loading, setLoading] = useState(true);

  const [group, setGroup] = useState<IncomeGroupType>("empresa");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadIncomes() {
    setLoading(true);
    const { data } = await supabase
      .from("incomes_view")
      .select("*")
      .eq("month_ref", month)
      .order("income_date", { ascending: false });
    if (data) setIncomes(data as IncomeView[]);
    setLoading(false);
  }

  useEffect(() => {
    loadIncomes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount.replace(",", "."));
    if (!value || value <= 0) {
      setError("Informe um valor válido.");
      return;
    }
    setSaving(true);
    setError(null);

    const { error } = await supabase.from("incomes").insert({
      group_type: group,
      amount: value,
      income_date: date,
      note: note || null,
    });

    setSaving(false);

    if (error) {
      setError("Não foi possível salvar a entrada.");
      return;
    }

    setAmount("");
    setNote("");
    loadIncomes();
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta entrada?")) return;
    await supabase.from("incomes").delete().eq("id", id);
    loadIncomes();
  }

  const grouped = useMemo(() => {
    const groups: Record<IncomeGroupType, IncomeView[]> = { casa: [], empresa: [] };
    for (const i of incomes) groups[i.group_type].push(i);
    return groups;
  }, [incomes]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Faturamento</h1>
          <p className="text-sm text-slate-500">
            Entradas do mês — renda de Casa e faturamento da Empresa, pra saber quanto sobra.
          </p>
        </div>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      <form onSubmit={handleCreate} className="card grid sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
        <div>
          <label className="label">Grupo</label>
          <select
            className="input"
            value={group}
            onChange={(e) => setGroup(e.target.value as IncomeGroupType)}
          >
            <option value="casa">Casa</option>
            <option value="empresa">Empresa</option>
          </select>
        </div>

        <div>
          <label className="label">Valor (R$)</label>
          <input
            className="input"
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div>
          <label className="label">Data</label>
          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label className="label">Observação (opcional)</label>
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex.: cliente X, salário..."
          />
        </div>

        <div className="sm:col-span-2 md:col-span-5 flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Salvando..." : "Adicionar entrada"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <IncomeGroupTable title="Casa" incomes={grouped.casa} onDelete={handleDelete} />
          <IncomeGroupTable title="Empresa" incomes={grouped.empresa} onDelete={handleDelete} />
        </div>
      )}
    </div>
  );
}

function IncomeGroupTable({
  title,
  incomes,
  onDelete,
}: {
  title: string;
  incomes: IncomeView[];
  onDelete: (id: string) => void;
}) {
  const total = incomes.reduce((sum, i) => sum + Number(i.amount), 0);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium text-slate-900">{title}</h2>
        <span className="text-sm font-semibold text-green-700">{formatBRL(total)}</span>
      </div>
      <ul className="space-y-2 max-h-[420px] overflow-y-auto">
        {incomes.map((i) => (
          <li
            key={i.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm text-slate-800">{formatBRL(Number(i.amount))}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {new Date(i.income_date + "T00:00:00").toLocaleDateString("pt-BR")}
                {i.note ? ` · ${i.note}` : ""}
              </p>
            </div>
            <button
              onClick={() => onDelete(i.id)}
              className="text-xs text-red-500 hover:text-red-700 shrink-0"
            >
              Excluir
            </button>
          </li>
        ))}
        {incomes.length === 0 && (
          <p className="text-sm text-slate-400">Nenhuma entrada lançada neste mês.</p>
        )}
      </ul>
    </div>
  );
}
