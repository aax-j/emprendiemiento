import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Icon } from '../Icon/Icon';
import styles from './TopAppBar.module.css';

interface TopAppBarProps {
  onMenuClick?: () => void;
  botStatus?: 'connected' | 'disconnected' | 'loading';
}

interface Notification {
  phone_number: string;
  updated_at: string;
  state: string;
  client_name?: string;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({ onMenuClick, botStatus }) => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const waDisconnected = botStatus === 'disconnected';

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  useEffect(() => {
    if (!profile?.workshop_id) return;

    const fetchNotifications = async () => {
      const { data: botSessions } = await supabase
        .from('bot_sessions')
        .select('phone_number, updated_at, state')
        .eq('workshop_id', profile.workshop_id);
      
      // Filter sessions that are in a notification state (might have metadata after |)
      const filteredSessions = (botSessions || []).filter(s => 
        s.state.startsWith('NEEDS_HUMAN') || 
        s.state.startsWith('NEEDS_HISTORY') || 
        s.state.startsWith('NEW_BOOKING')
      );

      if (filteredSessions) {
        // Fetch client names if possible
        const notificationsWithNames = await Promise.all(filteredSessions.map(async (session) => {
          const [pureState, metadataName] = session.state.split('|');
          
          const { data: client } = await supabase
            .from('clients')
            .select('full_name')
            .eq('workshop_id', profile.workshop_id)
            .ilike('phone', `%${session.phone_number}%`)
            .maybeSingle();
            
          return {
            ...session,
            state: pureState, // Use clean state for UI logic
            client_name: client?.full_name || metadataName || null
          };
        }));
        
        setNotifications(notificationsWithNames as Notification[]);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, [profile?.workshop_id, supabase]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const handleResolve = async (phone: string) => {
    await supabase.from('bot_sessions').update({ state: 'COMPLETED' }).eq('phone_number', phone);
    setNotifications(prev => prev.filter(n => n.phone_number !== phone));
  };

  return (
    <header className={styles.topbar}>
      <div className={styles.leftArea}>
        <button className={styles.menuBtn} onClick={onMenuClick} aria-label="Abrir menú">
          <Icon name="menu" />
        </button>
        <div className={styles.workshopName}>
          AutoTech SaaS
        </div>
      </div>

      <div className={styles.rightArea}>
        <div className={styles.notificationsContainer} ref={dropdownRef}>
          <button 
            className={styles.iconBtn} 
            aria-label="Notificaciones"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <Icon name="notifications" />
            {(notifications.length > 0 || waDisconnected) && (
              <span className={styles.badge}>{notifications.length + (waDisconnected ? 1 : 0)}</span>
            )}
          </button>

          {showDropdown && (
            <div className={styles.dropdownMenu}>
              <h4 className={styles.dropdownHeader}>Notificaciones</h4>

              {/* WhatsApp disconnected notification */}
              {waDisconnected && (
                <div
                  className={styles.dropdownItem}
                  style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem', cursor: 'default', borderLeft: '3px solid #f59e0b' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Icon name="wifi_off" style={{ color: '#f59e0b', fontSize: '1rem' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-on-surface)' }}>
                      WhatsApp desconectado
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-on-surface-variant)', lineHeight: 1.4 }}>
                    El bot no está respondiendo a clientes.
                  </p>
                  <button
                    onClick={() => { setShowDropdown(false); navigate('/settings'); }}
                    style={{ fontSize: '0.78rem', fontWeight: 600, color: '#f59e0b', background: 'transparent', border: '1px solid rgba(245,158,11,0.4)', padding: '0.25rem 0.6rem', borderRadius: '0.4rem', cursor: 'pointer' }}
                  >
                    Ir a Configuración
                  </button>
                </div>
              )}

              {notifications.length === 0 && !waDisconnected ? (
                <p className={styles.dropdownEmpty}>No hay mensajes nuevos.</p>
              ) : (
                <ul className={styles.dropdownList}>
                  {notifications.map((n, i) => (
                    <li key={i} className={styles.dropdownItem} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Nueva notificación
                        </span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#333' }}>
                          {n.state === 'NEEDS_HUMAN' ? `${n.client_name || 'Un cliente'} ha solicitado conversar con un asesor` : 
                           n.state === 'NEEDS_HISTORY' ? `${n.client_name || 'Un cliente'} ha solicitado su historial clínico` : 
                           n.state === 'NEW_BOOKING' ? `Nueva cita agendada por ${n.client_name || 'un cliente'}` : 'Acción requerida'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', width: '100%', justifyContent: 'flex-end', alignItems: 'center', marginTop: '4px' }}>
                        <button 
                          className={styles.resolveBtn}
                          onClick={() => handleResolve(n.phone_number)}
                        >
                          Atendido
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className={styles.profileArea}>
          <div className={styles.avatar}>
            {getInitials(profile?.full_name || '')}
          </div>
        </div>
      </div>
    </header>
  );
};
