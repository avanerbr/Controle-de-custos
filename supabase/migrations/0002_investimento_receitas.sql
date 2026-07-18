-- ============================================================
-- Migration 0002: grupo "Investimento" + receitas (faturamento/renda)
-- ============================================================

-- Permite o novo grupo "investimento" em categories
alter table public.categories drop constraint if exists categories_group_type_check;
alter table public.categories add constraint categories_group_type_check
  check (group_type in ('casa', 'empresa', 'investimento'));

-- Move a categoria "Carta Consórcio" (se existir) para o grupo investimento,
-- já que é dinheiro que vai gerar retorno no futuro, não uma despesa fixa de casa.
update public.categories
  set group_type = 'investimento'
  where name = 'Carta Consórcio' and group_type = 'casa';

-- Categorias iniciais de investimento
insert into public.categories (name, group_type, color, recurring) values
  ('Carta Consórcio - Imóvel', 'investimento', '#a855f7', true),
  ('Outros Investimentos', 'investimento', '#7c3aed', false)
on conflict do nothing;

-- ---------- Receitas / Faturamento ----------
-- Entradas do mês (faturamento da empresa, renda de casa) para calcular o saldo.

create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  group_type text not null check (group_type in ('casa', 'empresa')),
  amount numeric(12, 2) not null check (amount >= 0),
  income_date date not null default current_date,
  note text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists incomes_date_idx on public.incomes (income_date);
create index if not exists incomes_group_idx on public.incomes (group_type);

drop trigger if exists incomes_set_updated_at on public.incomes;
create trigger incomes_set_updated_at
  before update on public.incomes
  for each row execute function public.set_updated_at();

create or replace view public.incomes_view as
select
  i.id,
  i.amount,
  i.income_date,
  date_trunc('month', i.income_date)::date as month_ref,
  i.note,
  i.group_type,
  i.created_by,
  i.created_at
from public.incomes i;

alter table public.incomes enable row level security;

drop policy if exists "incomes_select" on public.incomes;
create policy "incomes_select" on public.incomes
  for select using (auth.role() = 'authenticated');

drop policy if exists "incomes_insert" on public.incomes;
create policy "incomes_insert" on public.incomes
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "incomes_update" on public.incomes;
create policy "incomes_update" on public.incomes
  for update using (auth.role() = 'authenticated');

drop policy if exists "incomes_delete" on public.incomes;
create policy "incomes_delete" on public.incomes
  for delete using (auth.role() = 'authenticated');
