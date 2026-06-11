import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getClientPendingInvites,
  getClientConnectedWorkshops,
  acceptConnectionInvite,
  declineConnectionInvite,
} from '../../lib/api/clients';
import { Icon } from '../../components/Icon/Icon';
import { ConnectionChatModal } from '../../components/ConnectionChatModal/ConnectionChatModal';
import styles from './client_portal.module.css';

type Tab = 'invites' | 'connected';

export const ClientConnections = () => {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('invites');
  const [invites, setInvites] = useState<any[]>([]);
  const [connected, setConnected] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChatName, setActiveChatName] = useState<string>('');

  const load = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const [inv, conn] = await Promise.all([
        getClientPendingInvites(profile.id),
        getClientConnectedWorkshops(profile.id),
      ]);
      setInvites(inv || []);
      setConnected(conn || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [profile?.id]);

  const handleAccept = async (id: string) => {
    setActionId(id);
    try {
      await acceptConnectionInvite(id);
      await load();
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setActionId(null);
    }
  };

  const handleDecline = async (id: string) => {
    setActionId(id);
    try {
      await declineConnectionInvite(id);
      await load();
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Mis Conexiones</h1>
          <p className={styles.pageSub}>Gestiona tus talleres de confianza y solicitudes pendientes</p>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabRow}>
        <button
          className={`${styles.tabBtn} ${tab === 'invites' ? styles.tabActive : ''}`}
          onClick={() => setTab('invites')}
        >
          <Icon name="mark_email_unread" />
          Invitaciones Recibidas
          {invites.length > 0 && <span className={styles.tabBadge}>{invites.length}</span>}
        </button>
        <button
          className={`${styles.tabBtn} ${tab === 'connected' ? styles.tabActive : ''}`}
          onClick={() => setTab('connected')}
        >
          <Icon name="handshake" />
          Talleres Conectados
          <span className={styles.tabBadge} style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}>
            {connected.length}
          </span>
        </button>
      </div>

      {loading ? (
        <p className={styles.emptyText}>Cargando…</p>
      ) : tab === 'invites' ? (
        invites.length === 0 ? (
          <div className={styles.emptyCard}>
            <Icon name="mark_email_unread" style={{ fontSize: '2.5rem', opacity: 0.3 }} />
            <p>No tienes invitaciones pendientes de ningún taller.</p>
          </div>
        ) : (
          <div className={styles.connectionList}>
            {invites.map(inv => (
              <div key={inv.id} className={styles.connectionCard}>
                <div className={styles.workshopAvatarLg} style={{ width: '3rem', height: '3rem', fontSize: '1.25rem' }}>
                  {inv.workshop?.name?.charAt(0) ?? 'T'}
                </div>
                <div className={styles.connectionCardBody}>
                  <span className={styles.connectionCardName}>{inv.workshop?.name ?? 'Taller'}</span>
                  <span className={styles.connectionCardSub}>
                    Solicita sincronizar tu perfil con su sistema de gestión
                  </span>
                  <span className={styles.connectionCardDate}>
                    {new Date(inv.created_at).toLocaleDateString('es-EC')}
                  </span>
                </div>
                <div className={styles.connectionCardActions}>
                  <button
                    className={styles.acceptBtn}
                    onClick={() => handleAccept(inv.id)}
                    disabled={actionId === inv.id}
                  >
                    <Icon name="check" /> Aceptar
                  </button>
                  <button
                    className={styles.declineBtn}
                    onClick={() => handleDecline(inv.id)}
                    disabled={actionId === inv.id}
                  >
                    <Icon name="close" /> Declinar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        connected.length === 0 ? (
          <div className={styles.emptyCard}>
            <Icon name="handshake" style={{ fontSize: '2.5rem', opacity: 0.3 }} />
            <p>Aún no estás conectado a ningún taller.<br />Explora el directorio para enviar solicitudes.</p>
          </div>
        ) : (
          <div className={styles.connectionList}>
            {connected.map(conn => (
              <div key={conn.id} className={styles.connectionCard}>
                <div className={styles.workshopAvatarLg} style={{ width: '3rem', height: '3rem', fontSize: '1.25rem' }}>
                  {conn.workshop?.name?.charAt(0) ?? 'T'}
                </div>
                <div className={styles.connectionCardBody}>
                  <span className={styles.connectionCardName}>{conn.workshop?.name ?? 'Taller'}</span>
                  <div className={styles.connectedBadge} style={{ width: 'fit-content', marginTop: '0.25rem' }}>
                    <Icon name="check_circle" /> Smart Sync Activo
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className={styles.acceptBtn}
                    onClick={() => { setActiveChatId(conn.id); setActiveChatName(conn.workshop?.name ?? 'Taller'); }}
                    title="Contactar al Taller"
                    style={{ background: 'var(--color-primary)', color: 'white' }}
                  >
                    <Icon name="chat" /> Contactar
                  </button>
                  <button
                    className={styles.declineBtn}
                    onClick={() => handleDecline(conn.id)}
                    disabled={actionId === conn.id}
                    title="Desconectar"
                  >
                    <Icon name="link_off" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {activeChatId && (
        <ConnectionChatModal
          connectionId={activeChatId}
          senderType="client"
          chatTitle={`Chat con ${activeChatName}`}
          onClose={() => setActiveChatId(null)}
        />
      )}
    </div>
  );
};
