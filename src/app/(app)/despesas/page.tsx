"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category, ExpenseView, GroupType } from "@/types/database";
import { currentMonthRef, formatBRL } from "@/lib/utils";
import MonthPicker from "@/components/MonthPicker";

const GROUPS: { key: GroupType; label: string }[] = [
  { key: "casa", label: "Casa" },
  { key: "empresa", label: "Empresa" },
  { key: "investimento", label: "Investimento" },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function DespesasPage() {
  const supabase = createClient();
  const [month, setMonth] = useState(currentMonthRef());
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<ExpenseView[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [paid, setPaid] = useState(false);
  const [note, setNote] = useState("");
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
    return (data ?? []) as Category[];
  }

  async function loadExpenses() {
    const { data } = await supabase
      .from("expenses_view")
      .select("*")
      .eq("month_ref", month)
      .order("expense_date", { ascending: false });
    if (data) setExpenses(data as ExpenseView[]);
    return (data ?? []) as ExpenseView[];
  }

  // Garante que toda categoria "recorrente" já tenha um lançamento no mês
  // selecionado, copiando o valor do mês anterior (editável depois).
  async function ensureRecurringExpenses(cats: Category[], monthRef: string) {
    const recurringCats = cats.filter((c) => c.recurring && !c.archived);
    if (recurringCats.length === 0) return;

    const { data: existing } = await supabase
      .from("expenses_view")
      .select("category_id")
      .eq("month_ref", monthRef);

    const existingIds = new Set((existing ?? []).map((e: { category_id: string }) => e.category_id));
    const missing = recurringCats.filter((c) => !existingIds.has(c.id));
    if (missing.length === 0) return;

    setSyncing(true);

    const toInsert = [];
    for (const cat of missing) {
      const { data: previous } = await supabase
        .from("expenses")
        .select("amount")
        .eq("category_id", cat.id)
        .lt("expense_date", monthRef)
        .order("expense_date", { ascending: false })
        .limit(1);

      const previousAmount = previous && previous.length > 0 ? previous[0].amount : 0;

      toInsert.push({
        category_id: cat.id,
        amount: previousAmount,
        expense_date: monthRef,
        paid: false,
      });
    }

    if (toInsert.length > 0) {
      await supabase.from("expenses").insert(toInsert);
    }

    setSyncing(false);
  }

  async function refreshAll() {
    setLoading(true);
    const cats = await loadCategories();
    await ensureRecurringExpenses(cats, month);
    await loadExpenses();
    setLoading(false);
  }

  useEffect(() => {
    refreshAll();
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
    });

    setSaving(false);

    if (error) {
      setError("Não foi possível salvar a despesa.");
      return;
    }

    setAmount("");
    setNote("");
    setPaid(false);
    loadExpenses();
  }

  async function togglePaid(exp: ExpenseView) {
    await supabase.from("expenses").update({ paid: !exp.paid }).eq("id", exp.id);
    loadExpenses();
  }

  async function updateAmount(id: string, value: number) {
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, amount: value } : e)));
    await supabase.from("expenses").update({ amount: value }).eq("id", id);
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta despesa?")) return;
    await supabase.from("expenses").delete().eq("id", id);
    loadExpenses();
  }

  const categoriesByGroup = useMemo(() => {
    const map: Record<GroupType, Category[]> = { casa: [], empresa: [], investimento: [] };
    for (const c of categories) map[c.group_type].push(c);
    return map;
  }, [categories]);

  const grouped = useMemo(() => {
    const groups: Record<GroupType, ExpenseView[]> = { casa: [], empresa: [], investimento: [] };
    for (const e of expenses) groups[e.group_type].push(e);
    return groups;
  }, [expenses]);

  const paidSummary = useMemo(() => {
    const paidTotal = expenses.filter((e) => e.paid).reduce((s, e) => s + Number(e.amount), 0);
    const pendingTotal = expenses.filter((e) => !e.paid).reduce((s, e) => s + Number(e.amount), 0);
    const paidCount = expenses.filter((e) => e.paid).length;
    const pendingCount = expenses.filter((e) => !e.paid).length;
    return { paidTotal, pendingTotal, paidCount, pendingCount };
  }, [expenses]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Lançar despesas</h1>
          <p className="text-sm text-slate-500">
            Contas fixas entram sozinhas todo mês (é só ajustar o valor) — gastos avulsos você
            lança na hora.
          </p>
        </div>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Pago</p>
            <p className="text-lg font-semibold text-green-700">{formatBRL(paidSummary.paidTotal)}</p>
          </div>
          <span className="text-xs text-slate-400">{paidSummary.paidCount} lançamento(s)</span>
        </div>
        <div className="card flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Falta pagar</p>
            <p className="text-lg font-semibold text-red-600">{formatBRL(paidSummary.pendingTotal)}</p>
          </div>
          <span className="text-xs text-slate-400">{paidSummary.pendingCount} lançamento(s)</span>
        </div>
      </div>

      <form onSubmit={handleCreate} className="card grid sm:grid-cols-2 md:grid-cols-6 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="label">Categoria</label>
          <select
            className="input"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {GROUPS.map((g) => (
              <optgroup key={g.key} label={g.label}>
                {categoriesByGroup[g.key].map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
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
            placeholder="Ex.: mercado da semana"
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

        <div className="sm:col-span-2 md:col-span-6 flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Salvando..." : "Adicionar despesa"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : (
        <>
          {syncing && (
            <p className="text-xs text-slate-400">Preenchendo contas fixas do mês...</p>
          )}
          <div className="grid md:grid-cols-3 gap-6">
            {GROUPS.map((g) => (
              <ExpenseGroupTable
                key={g.key}
                title={g.label}
                expenses={grouped[g.key]}
                onTogglePaid={togglePaid}
                onDelete={handleDelete}
                onUpdateAmount={updateAmount}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ExpenseGroupTable({
  title,
  expenses,
  onTogglePaid,
  onDelete,
  onUpdateAmount,
}: {
  title: string;
  expenses: ExpenseView[];
  onTogglePaid: (e: ExpenseView) => void;
  onDelete: (id: string) => void;
  onUpdateAmount: (id: string, value: number) => void;
}) {
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium text-slate-900">{title}</h2>
        <span className="text-sm font-semibold text-slate-700">{formatBRL(total)}</span>
      </div>
      <ul className="space-y-2 max-h-[460px] overflow-y-auto">
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
            <div className="flex items-center gap-2 shrink-0">
              <EditableAmount value={Number(e.amount)} onSave={(v) => onUpdateAmount(e.id, v)} />
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

function EditableAmount({ value, onSave }: { value: number; onSave: (value: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commit() {
    const parsed = Number(draft.replace(",", "."));
    setEditing(false);
    if (!isNaN(parsed) && parsed >= 0 && parsed !== value) {
      onSave(parsed);
    } else {
      setDraft(String(value));
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        className="input py-1 w-24 text-sm text-right"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(String(value));
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-sm font-medium text-slate-700 hover:underline"
      title="Clique para editar o valor"
    >
      {formatBRL(value)}
    </button>
  );
}
