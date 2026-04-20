import { supabase } from '../supabase';

export interface RepairHistory {
  id: string;
  vehicle_id: string;
  workshop_id: string;
  description: string;
  status: 'pendiente' | 'en_proceso' | 'completado';
  cost: number | null;
  start_date: string | null;     // Fecha de inicio
  delivery_date: string | null;  // Fecha estimada de entrega
  created_at: string;
  completed_at: string | null;
}

export const getRepairHistory = async (vehicleId: string): Promise<RepairHistory[]> => {
  const { data, error } = await supabase
    .from('repair_history')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as RepairHistory[];
};

export const getAllRepairs = async (workshopId: string): Promise<any[]> => {
  const { data, error } = await supabase
    .from('repair_history')
    .select('*, vehicles(id, plate, brand, model, year, color, client_id, clients(id, full_name, phone, email))')
    .eq('workshop_id', workshopId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

export const createRepair = async (
  repair: Pick<RepairHistory, 'vehicle_id' | 'workshop_id' | 'description' | 'status' | 'cost' | 'start_date' | 'delivery_date'>
): Promise<RepairHistory> => {
  const { data, error } = await supabase
    .from('repair_history')
    .insert([repair])
    .select()
    .single();

  if (error) throw error;
  return data as RepairHistory;
};

export const updateRepair = async (
  id: string,
  updates: Partial<Pick<RepairHistory, 'description' | 'status' | 'cost' | 'completed_at' | 'start_date' | 'delivery_date'>>
): Promise<RepairHistory> => {
  const payload = {
    ...updates,
    ...(updates.status === 'completado' && !updates.completed_at
      ? { completed_at: new Date().toISOString() }
      : {}),
  };

  const { data, error } = await supabase
    .from('repair_history')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as RepairHistory;
};

export const deleteRepair = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('repair_history')
    .delete()
    .eq('id', id);

  if (error) throw error;
};
