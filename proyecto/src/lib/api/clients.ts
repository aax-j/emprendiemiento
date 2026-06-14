import { supabase } from '../supabase';
import { sendNotification } from './notifications';

export interface Client {
  id: string;
  workshop_id?: string | null; // Mantener por compatibilidad legacy
  owner_workshop_id?: string | null; // Propietario del shadow profile local
  role_type?: 'mechanic' | 'client';
  client_tag?: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  // Campos cruzados de estado
  sync_status?: 'local' | 'pending_approval' | 'connected';
  connection_id?: string;
}

export interface WorkshopClientConnection {
  id: string;
  workshop_id: string;
  client_id: string;
  status: 'pending_client_approval' | 'pending_workshop_approval' | 'connected';
  created_at: string;
  // Campos unidos
  client?: {
    full_name: string;
    client_tag: string;
    phone: string | null;
    email: string | null;
  };
  workshop?: {
    name: string;
  };
}

// Recupera todos los clientes de un taller: shadow profiles locales O clientes B2C conectados activamente
export const getClients = async (workshopId: string): Promise<Client[]> => {
  // 1. Obtener shadow profiles locales
  const { data: shadowClients, error: shadowError } = await supabase
    .from('profiles')
    .select('*')
    .eq('role_type', 'client')
    .eq('owner_workshop_id', workshopId);

  if (shadowError) throw shadowError;

  // 2. Obtener clientes B2C conectados o pendientes de aprobación
  const { data: connections, error: connError } = await supabase
    .from('workshop_clients')
    .select('*, client:client_id(*)')
    .eq('workshop_id', workshopId);

  if (connError) throw connError;

  // Mapear shadow profiles locales
  const mappedShadows: Client[] = (shadowClients || []).map(c => ({
    ...c,
    sync_status: 'local'
  }));

  // Mapear clientes B2C conectados (y pendientes para mostrar estado)
  const mappedConnected: Client[] = (connections || [])
    .filter(conn => conn.client)
    .map(conn => ({
      ...conn.client,
      sync_status: conn.status === 'connected' ? 'connected' : 'pending_approval',
      connection_id: conn.id
    }));

  // Combinar y ordenar alfabéticamente
  const allClients = [...mappedShadows, ...mappedConnected];
  allClients.sort((a, b) => a.full_name.localeCompare(b.full_name));
  return allClients;
};

// Crear un perfil sombra local (Legacy)
export const createClient = async (
  client: Omit<Client, 'id' | 'created_at' | 'owner_workshop_id'>,
  workshopId: string
): Promise<Client> => {
  const { data, error } = await supabase
    .from('profiles')
    .insert([{ 
      ...client, 
      role_type: 'client', 
      owner_workshop_id: workshopId 
    }])
    .select()
    .single();

  if (error) throw error;
  return { ...data, sync_status: 'local' } as Client;
};

// Actualizar perfil de cliente (Las políticas RLS controlan si se tiene permiso)
export const updateClient = async (
  id: string,
  updates: Partial<Omit<Client, 'id' | 'created_at' | 'owner_workshop_id' | 'client_tag'>>
): Promise<Client> => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Client;
};

// Eliminar un cliente
export const deleteClient = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

// Smart Sync: Buscar un cliente global B2C por su Tag único
export const searchClientByTag = async (tag: string): Promise<Client | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role_type', 'client')
    .is('owner_workshop_id', null)
    .eq('client_tag', tag.trim().toUpperCase())
    .maybeSingle();

  if (error) throw error;
  return data as Client | null;
};

// --- Gestión de Conexiones Bilaterales (Smart Sync "Estilo Facebook") ---

// Enviar invitación de conexión (Taller -> Cliente o Cliente -> Taller)
export const sendConnectionInvite = async (
  workshopId: string,
  clientId: string,
  sender: 'workshop' | 'client'
): Promise<WorkshopClientConnection> => {
  const status = sender === 'workshop' ? 'pending_client_approval' : 'pending_workshop_approval';
  
  const { data, error } = await supabase
    .from('workshop_clients')
    .insert([{
      workshop_id: workshopId,
      client_id: clientId,
      status: status
    }])
    .select()
    .single();

  if (error) throw error;

  // Send notification to the receiver
  const receiverId = sender === 'workshop' ? clientId : workshopId;
  const senderName = sender === 'workshop' ? 'Un taller' : 'Un cliente'; // In a real app we could fetch their actual name, but this works for now.
  await sendNotification(
    receiverId,
    'Nueva solicitud de conexión',
    `${senderName} quiere conectarse contigo en AutoTech.`,
    'invite',
    data.id
  );

  return data as WorkshopClientConnection;
};

export const acceptConnectionInvite = async (connectionId: string): Promise<void> => {
  // First get the connection details to know who to notify
  const { data: conn } = await supabase.from('workshop_clients').select('*').eq('id', connectionId).single();

  const { error } = await supabase
    .from('workshop_clients')
    .update({ status: 'connected' })
    .eq('id', connectionId);

  if (error) throw error;

  if (conn) {
    // Notify both parties or figure out who accepted.
    // If the status was pending_client_approval, the client accepted, so notify the workshop.
    // If pending_workshop_approval, the workshop accepted, so notify the client.
    const receiverId = conn.status === 'pending_client_approval' ? conn.workshop_id : conn.client_id;
    const accepterType = conn.status === 'pending_client_approval' ? 'El cliente' : 'El taller';
    
    await sendNotification(
      receiverId,
      'Solicitud aceptada',
      `${accepterType} ha aceptado tu solicitud de conexión.`,
      'invite',
      connectionId
    );
  }
};

// Declinar / Cancelar conexión
export const declineConnectionInvite = async (connectionId: string): Promise<void> => {
  const { error } = await supabase
    .from('workshop_clients')
    .delete()
    .eq('id', connectionId);

  if (error) throw error;
};

// Obtener invitaciones pendientes recibidas por un cliente (B2C portal)
export const getClientPendingInvites = async (clientId: string): Promise<WorkshopClientConnection[]> => {
  const { data, error } = await supabase
    .from('workshop_clients')
    .select('*, workshop:workshop_id(name)')
    .eq('client_id', clientId)
    .eq('status', 'pending_client_approval');

  if (error) throw error;
  return data as any[];
};

// Obtener talleres conectados de un cliente (B2C portal)
export const getClientConnectedWorkshops = async (clientId: string): Promise<any[]> => {
  const { data, error } = await supabase
    .from('workshop_clients')
    .select('*, workshop:workshop_id(*)')
    .eq('client_id', clientId)
    .eq('status', 'connected');

  if (error) throw error;
  return data || [];
};

// Obtener invitaciones pendientes recibidas por un taller (B2B portal)
export const getWorkshopPendingInvites = async (workshopId: string): Promise<WorkshopClientConnection[]> => {
  const { data, error } = await supabase
    .from('workshop_clients')
    .select('*, client:client_id(*)')
    .eq('workshop_id', workshopId)
    .eq('status', 'pending_workshop_approval');

  if (error) throw error;
  return data as any[];
};

