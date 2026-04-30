import { supabase } from '../supabase';

export interface Expense {
  id: string;
  workshop_id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  created_at: string;
}

export const getExpenses = async (
  workshopId: string,
  startDate?: string,
  endDate?: string
): Promise<Expense[]> => {
  let query = supabase
    .from('expenses')
    .select('*')
    .eq('workshop_id', workshopId);

  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);

  const { data, error } = await query.order('date', { ascending: false });

  if (error) throw error;
  return data as Expense[];
};

export const createExpense = async (
  expense: Omit<Expense, 'id' | 'created_at' | 'workshop_id'>,
  workshopId: string
): Promise<Expense> => {
  const { data, error } = await supabase
    .from('expenses')
    .insert([{ ...expense, workshop_id: workshopId }])
    .select()
    .single();

  if (error) throw error;
  return data as Expense;
};

export const updateExpense = async (
  id: string,
  updates: Partial<Omit<Expense, 'id' | 'created_at' | 'workshop_id'>>
): Promise<Expense> => {
  const { data, error } = await supabase
    .from('expenses')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Expense;
};

export const deleteExpense = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id);

  if (error) throw error;
};
