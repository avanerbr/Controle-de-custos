"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category, ExpenseView, GroupType } from "@/types/database";
import { currentMonthRef, formatBRL } from "@/lib/utils";
import MonthPicker from "@/components/MonthPicker";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function DespesasPage() {
  const supabase = createClient();
  const [month, setMonth] = useState(currentMonthRef());
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<ExpenseView[]>([]);
  const [loading, setLoading] = useState(true);

  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [paid, setPaid] = useState(false);
  const [note, setNote] = useState("");
  const [whereToPay, setWhereToPay] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadCategories() {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("archived", false)
      .order("group_type")
      .order("name");
    if (data) {
      setCategories(data as Category[]);
      if (!categoryId && data.length > 0) setCategoryId((data as Category[])[0].id);
    }
  }

  async function loadExpenses() {
    setLoading(true);
    const { data } = await supabase
      .from("expenses_view")
      .select("*")
      .eq("month_ref", month)
      .order("expense_date", { ascending: false });
    if (data) setExpenses(data as ExpenseView[]);
    setLoading(false);
  }

  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount.replace(",", "."));
    if (!categoryId || !value || value <= 0) {
      setError("Escolha uma categoria e um valor válido.");
      return;
    }
    setSaving(true);
    setError(null);

    const { error } = await supabase.from("expenses").insert({
      category_id: categoryId,
      amount: value,
      expense_date: date,
      paid,
      note: note || null,
      where_to_pay: whereToPay || null,
    });

    setSaving(false);

    if (error) {
      setError("Não foi possível salvar a despesa.");
      return;
    }

    setAmount("");
    setNote("");
    setWhereToPay("");
    setPaid(false);
    loadExpenses();
  }

  async function togglePaid(exp: ExpenseView) {
    await supabase.from("expenses").update({ paid: !exp.paid }).eq("id", exp.id);
    loadExpenses();
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta despesa?")) return;
    await supabase.from("expenses").delete().eq("id", id);
    loadExpenses();
  }

  const casaCategories = categories.filter((c) => c.group_type === "casa");
  const empresaCategories = categories.filter((c) => c.group_type === "empresa");

  const grouped = useMemo(() => {
    const groups: Record<GroupType, ExpenseView[]> = { casa: [], empresa: [] };
    for (const e of expenses) groups[e.group_type].push(e);
    return groups;
  }, [expenses]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Lançar despesas</h1>
          <p className="text-sm text-slate-500">
            Contas fixas do mês ou gastos avulsos/diários — tudo entra no mesmo lançamento.
          </p>
        </div>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      <form onSubmit={handleCreate} className="card grid md:grid-cols-6 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="label">Categoria</label>
          <select
            className="input"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <optgroup label="Casa">
              {casaCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Empresa">
              {empresaCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
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
          <label className="label">Onde pagar / observação</label>
          <input
            className="input"
            value={note || whereToPay}
            onChange={(e) => {
              setNote(e.target.value);
              setWhereToPay(e.target.value);
            }}
            placeholder="Opcional"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="paid"
            type="checkbox"
            checked={paid}
            onChange={(e) => setPaid(e.target.checked)}
            className="h-4 w-4"
          />
          <label htmlFor="paid" className="text-sm text-slate-600">
            Pago
          </label>
        </div>

        <div className="md:col-span-6 flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Salvando..." : "Adicionar despesa"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <ExpenseGroupTable
            title="Casa"
            expenses={grouped.casa}
            onTogglePaid={togglePaid}
            onDelete={handleDelete}
          />
          <ExpenseGroupTable
            title="Empresa"
            expenses={grouped.empresa}
            onTogglePaid={togglePaid}
            onDelete={handleDelete}
          />
        </div>
      )}
    </div>
  );
}

function ExpenseGroupTable({
  title,
  expenses,
  onTogglePaid,
  onDelete,
}: {
  title: string;
  expenses: ExpenseView[];
  onTogglePaid: (e: ExpenseView) => void;
  onDelete: (id: string) => void;
}) {
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium text-slate-900">{title}</h2>
        <span className="text-sm font-semibold text-slate-700">{formatBRL(total)}</span>
      </div>
      <ul className="space-y-2 max-h-[420px] overflow-y-auto">
        {expenses.map((e) => (
          <li
            key={e.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                <span className="text-sm text-slate-800 truncate">{e.category_name}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {new Date(e.expense_date + "T00:00:00").toLocaleDateString("pt-BR")}
                {e.note ? ` · ${e.note}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm font-medium text-slate-700">{formatBRL(Number(e.amount))}</span>
              <button
                onClick={() => onTogglePaid(e)}
                className={`text-xs rounded px-2 py-1 border ${
                  e.paid
                    ? "border-green-200 text-green-700 bg-green-50"
                    : "border-slate-200 text-slate-500"
                }`}
              >
                {e.paid ? "Pago" : "Pendente"}
              </button>
              <button
                onClick={() => onDelete(e.id)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Excluir
              </button>
            </div>
          </li>
        ))}
        {expenses.length === 0 && (
          <p className="text-sm text-slate-400">Nenhuma despesa lançada neste mês.</p>
        )}
      </ul>
    </div>
  );
}
