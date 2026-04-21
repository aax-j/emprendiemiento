import { supabase } from '../supabase';

export interface Client {
  id: string;
  workshop_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
}

export const getClients = async (workshopId: string) => {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('workshop_id', workshopId)
    .order('full_name', { ascending: true });

  if (error) throw error;
  return data as Client[];
};

export const createClient = async (
  client: Omit<Client, 'id' | 'created_at' | 'workshop_id'>,
  workshopId: string
) => {
  const { data, error } = await supabase
    .from('clients')
    .insert([{ ...client, workshop_id: workshopId }])
    .select()
    .single();

  if (error) throw error;
  return data as Client;
};

export const updateClient = async (
  id: string,
  updates: Partial<Omit<Client, 'id' | 'created_at' | 'workshop_id'>>
) => {
  const { data, error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Client;
};

export const deleteClient = async (id: string) => {
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id);

  if (error) throw error;
};
