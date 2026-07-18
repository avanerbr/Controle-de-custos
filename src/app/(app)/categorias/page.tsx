"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category, GroupType } from "@/types/database";

const DEFAULT_COLORS = ["#2563eb", "#16a34a", "#f97316", "#8b5cf6", "#ec4899", "#0ea5e9", "#dc2626"];

const GROUPS: { key: GroupType; label: string }[] = [
  { key: "casa", label: "Casa" },
  { key: "empresa", label: "Empresa" },
  { key: "investimento", label: "Investimento" },
];

export default function CategoriasPage() {
  const supabase = createClient();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [groupType, setGroupType] = useState<GroupType>("casa");
  const [recurring, setRecurring] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  async function loadCategories() {
    setLoading(true);
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("group_type", { ascending: true })
      .order("name", { ascending: true });

    if (!error && data) setCategories(data as Category[]);
    setLoading(false);
  }

  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    const color = DEFAULT_COLORS[categories.length % DEFAULT_COLORS.length];

    const { error } = await supabase.from("categories").insert({
      name: name.trim(),
      group_type: groupType,
      recurring,
      color,
    });

    setSaving(false);

    if (error) {
      setError("Não foi possível criar a categoria.");
      return;
    }

    setName("");
    loadCategories();
  }

  async function handleArchive(id: string, archived: boolean) {
    await supabase.from("categories").update({ archived: !archived }).eq("id", id);
    loadCategories();
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta categoria e todas as despesas lançadas nela?")) return;
    await supabase.from("categories").delete().eq("id", id);
    loadCategories();
  }

  function startEditing(c: Category) {
    setEditingId(c.id);
    setEditingName(c.name);
  }

  async function saveEditing(id: string) {
    const trimmed = editingName.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    await supabase.from("categories").update({ name: trimmed }).eq("id", id);
    setEditingId(null);
    loadCategories();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Categorias</h1>
        <p className="text-sm text-slate-500">
          Crie quantas categorias quiser, separadas por Casa, Empresa ou Investimento. Marque como
          "recorrente" contas fixas mensais (elas entram sozinhas todo mês em Lançar despesas), ou
          deixe desmarcado para gastos avulsos/diários.
        </p>
      </div>

      <form onSubmit={handleCreate} className="card flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="label">Nome da categoria</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Farmácia, Combustível..."
          />
        </div>
        <div>
          <label className="label">Grupo</label>
          <select
            className="input"
            value={groupType}
            onChange={(e) => setGroupType(e.target.value as GroupType)}
          >
            {GROUPS.map((g) => (
              <option key={g.key} value={g.key}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Tipo</label>
          <select
            className="input"
            value={recurring ? "1" : "0"}
            onChange={(e) => setRecurring(e.target.value === "1")}
          >
            <option value="1">Conta fixa mensal</option>
            <option value="0">Gasto avulso / diário</option>
          </select>
        </div>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Salvando..." : "Adicionar"}
        </button>
        {error && <p className="text-sm text-red-600 w-full">{error}</p>}
      </form>

      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {GROUPS.map((g) => (
            <CategoryGroupList
              key={g.key}
              title={g.label}
              categories={categories.filter((c) => c.group_type === g.key)}
              editingId={editingId}
              editingName={editingName}
              onStartEdit={startEditing}
              onEditingNameChange={setEditingName}
              onSaveEdit={saveEditing}
              onCancelEdit={() => setEditingId(null)}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryGroupList({
  title,
  categories,
  editingId,
  editingName,
  onStartEdit,
  onEditingNameChange,
  onSaveEdit,
  onCancelEdit,
  onArchive,
  onDelete,
}: {
  title: string;
  categories: Category[];
  editingId: string | null;
  editingName: string;
  onStartEdit: (c: Category) => void;
  onEditingNameChange: (v: string) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onArchive: (id: string, archived: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="card">
      <h2 className="font-medium text-slate-900 mb-3">{title}</h2>
      <ul className="space-y-2">
        {categories.map((c) => (
          <li
            key={c.id}
            className={`flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 ${
              c.archived ? "opacity-50" : ""
            }`}
          >
            {editingId === c.id ? (
              <input
                autoFocus
                className="input flex-1 py-1"
                value={editingName}
                onChange={(e) => onEditingNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSaveEdit(c.id);
                  if (e.key === "Escape") onCancelEdit();
                }}
                onBlur={() => onSaveEdit(c.id)}
              />
            ) : (
              <div
                className="flex items-center gap-2 min-w-0 cursor-pointer flex-1"
                onClick={() => onStartEdit(c)}
                title="Clique para renomear"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: c.color }}
                />
                <span className="text-sm text-slate-800 truncate">{c.name}</span>
                {!c.recurring && (
                  <span className="text-[10px] uppercase tracking-wide text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 shrink-0">
                    avulso
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onArchive(c.id, c.archived)}
                className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1"
              >
                {c.archived ? "Reativar" : "Arquivar"}
              </button>
              <button
                onClick={() => onDelete(c.id)}
                className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
              >
                Excluir
              </button>
            </div>
          </li>
        ))}
        {categories.length === 0 && (
          <p className="text-sm text-slate-400">Nenhuma categoria ainda.</p>
        )}
      </ul>
    </div>
  );
}
