import { supabase } from '../supabase';

export interface WorkOrder {
  id: string;
  workshop_id: string;
  vehicle_id: string;
  assigned_mechanic_id: string | null;
  status: 'pendiente' | 'en_proceso' | 'completado' | 'cancelado';
  scheduled_date: string;
  description: string | null;
  created_at: string;
  vehicles?: {
    id: string;
    plate: string;
    brand: string;
    model: string;
    year: number | null;
    color: string | null;
    client_id: string;
    clients: {
      id: string;
      full_name: string;
      phone: string | null;
      email: string | null;
    };
  };
}

export const getWorkOrders = async (
  workshopId: string,
  startDate?: string,
  endDate?: string
): Promise<WorkOrder[]> => {
  let query = supabase
    .from('work_orders')
    .select('*, vehicles(id, plate, brand, model, year, color, client_id, clients(id, full_name, phone, email))')
    .eq('workshop_id', workshopId);

  if (startDate) query = query.gte('scheduled_date', startDate);
  if (endDate) query = query.lte('scheduled_date', endDate);

  const { data, error } = await query.order('scheduled_date', { ascending: true });

  if (error) throw error;
  return data as WorkOrder[];
};

export const createWorkOrder = async (
  data: Omit<WorkOrder, 'id' | 'created_at' | 'workshop_id' | 'vehicles'>,
  workshopId: string
): Promise<WorkOrder> => {
  const { data: result, error } = await supabase
    .from('work_orders')
    .insert([{ ...data, workshop_id: workshopId }])
    .select()
    .single();

  if (error) throw error;
  return result as WorkOrder;
};

export const updateWorkOrder = async (
  id: string,
  updates: Partial<Omit<WorkOrder, 'id' | 'created_at' | 'workshop_id' | 'vehicles'>>
): Promise<WorkOrder> => {
  const { data, error } = await supabase
    .from('work_orders')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as WorkOrder;
};

export const deleteWorkOrder = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('work_orders')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const getWorkOrdersByVehicleId = async (vehicleId: string): Promise<WorkOrder[]> => {
  const { data, error } = await supabase
    .from('work_orders')
    .select('*, vehicles(id, plate, brand, model, year, color, client_id, clients(id, full_name, phone, email))')
    .eq('vehicle_id', vehicleId)
    .order('scheduled_date', { ascending: false });

  if (error) throw error;
  return data as WorkOrder[];
};
