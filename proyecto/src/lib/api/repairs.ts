import { supabase } from '../supabase';
import { sendNotification } from './notifications';

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
  workshop?: { name: string };
}

export const getRepairHistory = async (vehicleId: string, plate?: string, workshopId?: string): Promise<RepairHistory[]> => {
  let vehicleIds = [vehicleId];
  
  // Si tenemos la placa, buscamos todos los IDs de vehículos (incluyendo shadow profiles) con esa placa
  if (plate) {
    const { data: relatedVehicles } = await supabase
      .from('vehicles')
      .select('id')
      .eq('plate', plate);
      
    if (relatedVehicles && relatedVehicles.length > 0) {
      vehicleIds = relatedVehicles.map(v => v.id);
    }
  }

  let query = supabase
    .from('repair_history')
    .select('*, workshops(name)')
    .in('vehicle_id', vehicleIds)
    .order('created_at', { ascending: false });

  if (workshopId) {
    query = query.eq('workshop_id', workshopId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Supabase error fetching repair history:', error);
    throw error;
  }
  return data as any[];
};

export const getAllRepairs = async (workshopId: string): Promise<any[]> => {
  const { data, error } = await supabase
    .from('repair_history')
    .select('*, vehicles(id, plate, brand, model, year, color, client_id, clients:client_id(id, full_name, phone, email))')
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

  // Send notification to the client
  const { data: vehicle } = await supabase.from('vehicles').select('client_id, brand, model').eq('id', repair.vehicle_id).single();
  if (vehicle && vehicle.client_id) {
    await sendNotification(
      vehicle.client_id,
      'Nueva Reparación Registrada',
      `El taller ha registrado una nueva reparación para tu ${vehicle.brand} ${vehicle.model}.`,
      'repair',
      data.id
    );
  }

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

  // Send notification to the client if status changed
  if (updates.status) {
    const { data: vehicle } = await supabase.from('vehicles').select('client_id, brand, model').eq('id', data.vehicle_id).single();
    if (vehicle && vehicle.client_id) {
      let statusText: string = updates.status;
      if (updates.status === 'completado') statusText = 'completada';
      else if (updates.status === 'en_proceso') statusText = 'en proceso';

      await sendNotification(
        vehicle.client_id,
        'Actualización de Reparación',
        `La reparación de tu ${vehicle.brand} ${vehicle.model} ha sido marcada como: ${statusText}.`,
        'repair',
        data.id
      );
    }
  }

  return data as RepairHistory;
};

export const deleteRepair = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('repair_history')
    .delete()
    .eq('id', id);

  if (error) throw error;
};
