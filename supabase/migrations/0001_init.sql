-- ============================================================
-- Sistema de Despesas - Michael & Jamille
-- Schema inicial: categorias, despesas, RLS e seed
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Tabelas ----------

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  group_type text not null check (group_type in ('casa', 'empresa')),
  color text not null default '#2563eb',
  recurring boolean not null default true, -- true = conta fixa mensal, false = gasto avulso/diario
  archived boolean not null default false,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0),
  expense_date date not null default current_date,
  paid boolean not null default false,
  note text,
  where_to_pay text, -- "onde encontrar" (site, whats, debito automatico...)
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expenses_category_idx on public.expenses (category_id);
create index if not exists expenses_date_idx on public.expenses (expense_date);
create index if not exists categories_group_idx on public.categories (group_type);

-- trigger para manter updated_at atualizado
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- ---------- View auxiliar ----------
-- Junta despesa + categoria, e expõe o mês de referência (1º dia do mês)
create or replace view public.expenses_view as
select
  e.id,
  e.amount,
  e.expense_date,
  date_trunc('month', e.expense_date)::date as month_ref,
  e.paid,
  e.note,
  e.where_to_pay,
  e.created_by,
  e.created_at,
  c.id as category_id,
  c.name as category_name,
  c.group_type,
  c.color,
  c.recurring
from public.expenses e
join public.categories c on c.id = e.category_id;

-- ---------- RLS ----------
-- App é privado para 2 usuários (Michael e Jamille). Qualquer usuário
-- autenticado no projeto Supabase pode ler/escrever tudo (dados compartilhados).
-- Importante: desabilite "Allow new users to sign up" no Supabase Auth e
-- crie manualmente apenas os 2 usuários (veja README).

alter table public.categories enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "categories_select" on public.categories;
create policy "categories_select" on public.categories
  for select using (auth.role() = 'authenticated');

drop policy if exists "categories_insert" on public.categories;
create policy "categories_insert" on public.categories
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "categories_update" on public.categories;
create policy "categories_update" on public.categories
  for update using (auth.role() = 'authenticated');

drop policy if exists "categories_delete" on public.categories;
create policy "categories_delete" on public.categories
  for delete using (auth.role() = 'authenticated');

drop policy if exists "expenses_select" on public.expenses;
create policy "expenses_select" on public.expenses
  for select using (auth.role() = 'authenticated');

drop policy if exists "expenses_insert" on public.expenses;
create policy "expenses_insert" on public.expenses
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "expenses_update" on public.expenses;
create policy "expenses_update" on public.expenses
  for update using (auth.role() = 'authenticated');

drop policy if exists "expenses_delete" on public.expenses;
create policy "expenses_delete" on public.expenses
  for delete using (auth.role() = 'authenticated');

-- ---------- Seed: categorias baseadas na planilha atual ----------

insert into public.categories (name, group_type, color, recurring) values
  ('Aluguel + Condomínio + Seguro', 'casa', '#2563eb', true),
  ('Energia', 'casa', '#0ea5e9', true),
  ('Gás', 'casa', '#f97316', true),
  ('Água', 'casa', '#06b6d4', true),
  ('Internet Pessoal - Jamille', 'casa', '#8b5cf6', true),
  ('Internet Casa', 'casa', '#8b5cf6', true),
  ('Internet Pessoal - Michael', 'casa', '#8b5cf6', true),
  ('Internet Jamille Trabalho', 'casa', '#8b5cf6', true),
  ('Plano de Saúde - Unimed', 'casa', '#ec4899', true),
  ('Carta Consórcio', 'casa', '#a855f7', true),
  ('Carro Onix', 'casa', '#f59e0b', true),
  ('Cartão Jamille', 'casa', '#ef4444', true),
  ('Cartão Michael', 'casa', '#ef4444', true),
  ('Mensalidade NF', 'casa', '#14b8a6', true),
  ('Solar Digital', 'casa', '#84cc16', true),
  ('Mercado / Gastos diários', 'casa', '#64748b', false),
  ('Aluguel', 'empresa', '#16a34a', true),
  ('Energia', 'empresa', '#22c55e', true),
  ('Internet - TIM', 'empresa', '#8b5cf6', true),
  ('Água', 'empresa', '#06b6d4', true),
  ('Imposto de Renda Empresa', 'empresa', '#dc2626', true),
  ('Despesas diversas / diárias', 'empresa', '#64748b', false)
on conflict do nothing;
