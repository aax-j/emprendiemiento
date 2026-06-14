import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { 
  Notification, 
  getNotifications, 
  getDynamicDeadlineNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead 
} from '../../lib/api/notifications';
import { Icon } from '../Icon/Icon';
import styles from './NotificationBell.module.css';

export const NotificationBell = () => {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchAllNotifications = async () => {
    if (!profile?.id) return;
    
    let dbNotifs: Notification[] = [];
    try {
      dbNotifs = await getNotifications(profile.id);
    } catch (e) {
      console.error('Error fetching DB notifications (¿Ejecutaste el script SQL?):', e);
    }

    let dynamicNotifs: Notification[] = [];
    try {
      const role = profile.role_type === 'mechanic' ? 'workshop' : 'client';
      dynamicNotifs = await getDynamicDeadlineNotifications(profile.id, role, profile.workshop_id || undefined);
    } catch (e) {
      console.error('Error fetching dynamic notifications:', e);
    }
      
    // Fetch bot sessions (WhatsApp alerts) for mechanics
    let botNotifs: Notification[] = [];
    if (profile.role_type === 'mechanic' && profile.workshop_id) {
      try {
        const { data: botSessions } = await supabase
          .from('bot_sessions')
          .select('phone_number, updated_at, state')
          .eq('workshop_id', profile.workshop_id);
          
        const filteredSessions = (botSessions || []).filter(s => 
          s.state.startsWith('NEEDS_HUMAN') || 
          s.state.startsWith('NEEDS_HISTORY') || 
          s.state.startsWith('NEW_BOOKING')
        );

        botNotifs = await Promise.all(filteredSessions.map(async (session) => {
          const [pureState, metadataName] = session.state.split('|');
          const { data: client } = await supabase
            .from('clients')
            .select('full_name')
            .eq('workshop_id', profile.workshop_id)
            .ilike('phone', `%${session.phone_number}%`)
            .maybeSingle();
            
          const clientName = client?.full_name || metadataName || 'Un cliente';
          let title = 'Acción requerida';
          let message = 'Nueva notificación de WhatsApp';
          
          if (pureState === 'NEEDS_HUMAN') {
            title = 'Soporte humano solicitado';
            message = `${clientName} ha solicitado conversar con un asesor por WhatsApp.`;
          } else if (pureState === 'NEEDS_HISTORY') {
            title = 'Historial solicitado';
            message = `${clientName} ha solicitado su historial clínico.`;
          } else if (pureState === 'NEW_BOOKING') {
            title = 'Nueva cita agendada';
            message = `Se agendó una cita de WhatsApp para ${clientName}.`;
          }

          return {
            id: `dyn_bot_${session.phone_number}`,
            user_id: profile.id,
            title,
            message,
            type: 'message', // use message icon
            read: false,
            related_entity_id: session.phone_number,
            created_at: session.updated_at
          } as Notification;
        }));
      } catch (e) {
        console.error('Error fetching bot notifications:', e);
      }
    }

    // Combine and sort by date
    const all = [...dynamicNotifs, ...dbNotifs, ...botNotifs].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    setNotifications(all);
  };

  useEffect(() => {
    if (!profile?.id) return;
    
    fetchAllNotifications();

    // Subscribe to real-time new notifications
    const channel = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`
        },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    const interval = setInterval(fetchAllNotifications, 5000); // Polling for bot_sessions

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [profile?.id, profile?.workshop_id]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = async (id: string, isDynamic: boolean) => {
    if (id.startsWith('dyn_bot_')) {
      // Resolve WhatsApp bot session
      const phone = id.replace('dyn_bot_', '');
      try {
        await supabase.from('bot_sessions').update({ state: 'COMPLETED' }).eq('phone_number', phone);
        setNotifications(prev => prev.filter(n => n.id !== id));
      } catch (e) {
        console.error('Error resolving bot session:', e);
      }
      return;
    }

    if (isDynamic) return; // Deadline notifications can't be marked as read permanently in DB here
    try {
      await markNotificationAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      await markAllNotificationsAsRead(profile.id);
      setNotifications(prev => prev.map(n => n.id.startsWith('dyn_') ? n : { ...n, read: true }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'invite': return 'person_add';
      case 'message': return 'chat';
      case 'repair': return 'build';
      case 'alert': return 'warning';
      default: return 'notifications';
    }
  };

  return (
    <div className={styles.container} ref={menuRef}>
      <button className={styles.bellButton} onClick={() => setIsOpen(!isOpen)}>
        <Icon name="notifications" style={{ fontSize: '1.5rem' }} />
        {unreadCount > 0 && (
          <span className={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <h3 className={styles.title}>Notificaciones</h3>
            {unreadCount > 0 && (
              <button 
                className={styles.markAllBtn} 
                onClick={handleMarkAllAsRead}
                disabled={loading}
              >
                Marcar todas leídas
              </button>
            )}
          </div>
          
          <div className={styles.list}>
            {notifications.length === 0 ? (
              <div className={styles.empty}>
                <Icon name="notifications_off" style={{ fontSize: '2rem', opacity: 0.5, marginBottom: '0.5rem' }} />
                <p>No tienes notificaciones</p>
              </div>
            ) : (
              notifications.map(notif => {
                const isDynamic = notif.id.startsWith('dyn_');
                return (
                  <div 
                    key={notif.id} 
                    className={`${styles.item} ${notif.read ? styles.read : styles.unread}`}
                    onClick={() => !notif.read && handleMarkAsRead(notif.id, isDynamic)}
                  >
                    <div className={styles.iconBox} data-type={notif.type}>
                      <Icon name={getIconForType(notif.type)} style={{ fontSize: '1.25rem' }} />
                    </div>
                    <div className={styles.content}>
                      <h4 className={styles.itemTitle}>{notif.title}</h4>
                      <p className={styles.itemMessage}>{notif.message}</p>
                      <span className={styles.time}>
                        {new Date(notif.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {!notif.read && <div className={styles.unreadDot} />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
