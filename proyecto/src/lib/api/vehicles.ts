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
  const { data, error } = await supabase
    .from('vehicles')
    .select('*, clients(full_name, phone, email)')
    .eq('workshop_id', workshopId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as VehicleWithClient[];
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
    .select('*, clients(full_name, phone, email)')
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
