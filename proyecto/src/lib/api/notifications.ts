import { supabase } from '../supabase';
import { RepairHistory } from './repairs';
import { getVehicles } from './vehicles';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'invite' | 'message' | 'repair' | 'alert' | 'system';
  read: boolean;
  related_entity_id: string | null;
  created_at: string;
}

export const sendNotification = async (
  userId: string,
  title: string,
  message: string,
  type: Notification['type'],
  relatedEntityId?: string
): Promise<void> => {
  const { error } = await supabase
    .from('notifications')
    .insert([{
      user_id: userId,
      title,
      message,
      type,
      related_entity_id: relatedEntityId || null
    }]);

  if (error) {
    console.error('Error sending notification:', error);
  }
};

export const getNotifications = async (userId: string): Promise<Notification[]> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data as Notification[];
};

export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error) throw error;
};

export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) throw error;
};

export const deleteNotification = async (notificationId: string): Promise<void> => {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) throw error;
};

// --- Dynamic Deadline Notifications ---
// These are not saved to the DB, they are computed on the fly

export const getDynamicDeadlineNotifications = async (userId: string, role: 'workshop' | 'client' | 'admin', workshopId?: string): Promise<Notification[]> => {
  let repairs: RepairHistory[] = [];

  try {
    if (role === 'workshop' && workshopId) {
      const { data } = await supabase
        .from('repair_history')
        .select('*, vehicles(plate, brand, model)')
        .eq('workshop_id', workshopId)
        .neq('status', 'completado')
        .not('delivery_date', 'is', null);
      if (data) repairs = data as any[];
    } else if (role === 'client') {
      const vehicles = await getVehicles(userId);
      if (vehicles.length > 0) {
        const vehicleIds = vehicles.map(v => v.id);
        const { data } = await supabase
          .from('repair_history')
          .select('*, workshops(name), vehicles(plate, brand, model)')
          .in('vehicle_id', vehicleIds)
          .neq('status', 'completado')
          .not('delivery_date', 'is', null);
        if (data) repairs = data as any[];
      }
    }

    const dynamicNotifications: Notification[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    repairs.forEach(repair => {
      if (!repair.delivery_date) return;
      const deliveryDate = new Date(repair.delivery_date + 'T00:00:00');
      const diffTime = deliveryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let title = '';
      let message = '';
      let type: Notification['type'] = 'alert';

      const repairData: any = repair;
      const vName = repairData.vehicles ? `${repairData.vehicles.brand} ${repairData.vehicles.model} (${repairData.vehicles.plate})` : 'Vehículo';

      if (diffDays < 0) {
        title = 'Plazo de reparación vencido';
        message = role === 'workshop' 
          ? `La reparación del ${vName} debió entregarse hace ${Math.abs(diffDays)} día(s).`
          : `La reparación de tu ${vName} en el taller está retrasada por ${Math.abs(diffDays)} día(s).`;
      } else if (diffDays === 0) {
        title = 'Entrega de reparación hoy';
        message = role === 'workshop'
          ? `Hoy es la fecha estimada de entrega para el ${vName}.`
          : `Hoy es la fecha estimada de entrega para tu ${vName}.`;
      } else if (diffDays <= 2) {
        title = 'Plazo de reparación próximo';
        message = role === 'workshop'
          ? `Faltan ${diffDays} día(s) para entregar el ${vName}.`
          : `Faltan ${diffDays} día(s) para que termine la reparación de tu ${vName}.`;
      }

      if (title) {
        dynamicNotifications.push({
          id: `dyn_${repair.id}`,
          user_id: userId,
          title,
          message,
          type,
          read: false, // Las notificaciones dinámicas siempre se muestran como activas si aplican
          related_entity_id: repair.id,
          created_at: new Date().toISOString()
        });
      }
    });

    return dynamicNotifications;
  } catch (error) {
    console.error('Error fetching dynamic deadlines:', error);
    return [];
  }
};
