export type GroupType = "casa" | "empresa";

export interface Category {
  id: string;
  name: string;
  group_type: GroupType;
  color: string;
  recurring: boolean;
  archived: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  category_id: string;
  amount: number;
  expense_date: string; // yyyy-mm-dd
  paid: boolean;
  note: string | null;
  where_to_pay: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseView extends Expense {
  month_ref: string;
  category_name: string;
  group_type: GroupType;
  color: string;
  recurring: boolean;
}
