import { supabase } from '../supabase';

export interface Vehicle {
  id: string;
  workshop_id: string;
  client_id: string;
  plate: string;
  brand: string;
  model: string;
  year: number | null;
  color: string | null;
  notes: string | null;
  last_oil_change: string | null;
  created_at: string;
  // Joined fields
  client_name?: string;
}

export interface VehicleWithClient extends Vehicle {
  clients: {
    full_name: string;
    phone: string | null;
    email: string | null;
  };
}

export const getVehicles = async (workshopId: string): Promise<VehicleWithClient[]> => {
  // 1. Vehículos creados localmente en el taller
  const { data: wsVehicles, error: err1 } = await supabase
    .from('vehicles')
    .select('*, clients:client_id(full_name, phone, email)')
    .eq('workshop_id', workshopId);

  if (err1) throw err1;

  // 2. Obtener clientes conectados por Smart Sync
  const { data: connections, error: err2 } = await supabase
    .from('workshop_clients')
    .select('client_id')
    .eq('workshop_id', workshopId);
    
  if (err2) throw err2;

  let allVehicles = wsVehicles || [];

  if (connections && connections.length > 0) {
    const clientIds = connections.map(c => c.client_id);
    // 3. Vehículos globales de clientes conectados
    const { data: clientVehicles, error: err3 } = await supabase
      .from('vehicles')
      .select('*, clients:client_id(full_name, phone, email)')
      .in('client_id', clientIds);
      
    if (!err3 && clientVehicles) {
      const merged = [...allVehicles, ...clientVehicles];
      const uniqueMap = new Map();
      merged.forEach(v => uniqueMap.set(v.id, v));
      allVehicles = Array.from(uniqueMap.values());
    }
  }

  allVehicles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return allVehicles as VehicleWithClient[];
};

export const getVehiclesByClient = async (clientId: string): Promise<Vehicle[]> => {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('client_id', clientId)
    .order('plate', { ascending: true });

  if (error) throw error;
  return data as Vehicle[];
};

export const getVehicleById = async (id: string): Promise<VehicleWithClient> => {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*, clients:client_id(full_name, phone, email)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as VehicleWithClient;
};

export const createVehicle = async (
  vehicle: Omit<Vehicle, 'id' | 'created_at' | 'workshop_id' | 'client_name'>,
  workshopId: string
): Promise<Vehicle> => {
  const { data, error } = await supabase
    .from('vehicles')
    .insert([{ ...vehicle, workshop_id: workshopId }])
    .select()
    .single();

  if (error) throw error;
  return data as Vehicle;
};

export const updateVehicle = async (
  id: string,
  updates: Partial<Omit<Vehicle, 'id' | 'created_at' | 'workshop_id' | 'client_id' | 'client_name'>>
): Promise<Vehicle> => {
  const { data, error } = await supabase
    .from('vehicles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Vehicle;
};

export const deleteVehicle = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('vehicles')
    .delete()
    .eq('id', id);

  if (error) throw error;
};
