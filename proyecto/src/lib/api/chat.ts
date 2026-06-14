import { supabase } from '../supabase';
import { sendNotification } from './notifications';

export interface ConnectionMessage {
  id: string;
  connection_id: string;
  sender_type: 'client' | 'workshop';
  content: string;
  is_read: boolean;
  created_at: string;
}

// 1. Obtener mensajes de una conexión
export const getConnectionMessages = async (connectionId: string): Promise<ConnectionMessage[]> => {
  const { data, error } = await supabase
    .from('connection_messages')
    .select('*')
    .eq('connection_id', connectionId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as ConnectionMessage[];
};

// 2. Enviar un nuevo mensaje
export const sendMessage = async (
  connectionId: string,
  senderType: 'client' | 'workshop',
  content: string
): Promise<ConnectionMessage> => {
  const { data, error } = await supabase
    .from('connection_messages')
    .insert([{
      connection_id: connectionId,
      sender_type: senderType,
      content
    }])
    .select()
    .single();

  if (error) throw error;

  // Send notification to the other party
  const { data: conn } = await supabase.from('workshop_clients').select('*').eq('id', connectionId).single();
  if (conn) {
    const receiverId = senderType === 'workshop' ? conn.client_id : conn.workshop_id;
    const senderName = senderType === 'workshop' ? 'El taller' : 'El cliente';
    await sendNotification(
      receiverId,
      'Nuevo mensaje',
      `${senderName} te ha enviado un mensaje.`,
      'message',
      connectionId
    );
  }

  return data as ConnectionMessage;
};

// 3. Marcar mensajes como leídos
export const markMessagesAsRead = async (
  connectionId: string,
  readerType: 'client' | 'workshop'
): Promise<void> => {
  const senderToUpdate = readerType === 'client' ? 'workshop' : 'client';
  
  const { error } = await supabase
    .from('connection_messages')
    .update({ is_read: true })
    .eq('connection_id', connectionId)
    .eq('sender_type', senderToUpdate)
    .eq('is_read', false);

  if (error) throw error;
};

// 4. Suscripción a nuevos mensajes (Realtime)
export const subscribeToMessages = (
  connectionId: string,
  callback: (payload: any) => void
) => {
  const channel = supabase
    .channel(`messages:${connectionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'connection_messages',
        filter: `connection_id=eq.${connectionId}`
      },
      (payload) => callback(payload.new)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
