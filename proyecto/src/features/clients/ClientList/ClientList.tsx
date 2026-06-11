import { useState, useEffect } from 'react';
import { getBotApiUrl } from '../../../lib/api/bot';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { 
  getClients, createClient, updateClient, deleteClient, Client,
  searchClientByTag, sendConnectionInvite, getWorkshopPendingInvites, acceptConnectionInvite, declineConnectionInvite
} from '../../../lib/api/clients';
import { getVehiclesByClient, Vehicle } from '../../../lib/api/vehicles';
import { Icon } from '../../../components/Icon/Icon';
import { ConnectionChatModal } from '../../../components/ConnectionChatModal/ConnectionChatModal';
import styles from './ClientList.module.css';

const COUNTRY_CODES = [
  { code: '593', flag: '🇪🇨', name: 'Ecuador' },
  { code: '57', flag: '🇨🇴', name: 'Colombia' },
  { code: '51', flag: '🇵🇪', name: 'Perú' },
  { code: '54', flag: '🇦🇷', name: 'Argentina' },
  { code: '56', flag: '🇨🇱', name: 'Chile' },
  { code: '52', flag: '🇲🇽', name: 'México' },
  { code: '34', flag: '🇪🇸', name: 'España' },
  { code: '1', flag: '🇺🇸', name: 'USA' },
];

const formatPhoneDisplay = (phone: string | null) => {
  if (!phone) return null;
  const matched = COUNTRY_CODES.find(c => phone.startsWith(c.code));
  if (matched) {
    const number = phone.replace(matched.code, '');
    return `+${matched.code} ${number}`;
  }
  return `+${phone}`;
};

type ModalMode = 'add' | 'edit' | 'detail' | null;

interface ClientModalProps {
  mode: 'add' | 'edit';
  client?: Client | null;
  workshopId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ClientModal: React.FC<ClientModalProps> = ({ mode, client, workshopId, onClose, onSuccess }) => {
  // Onboarding Híbrido: manual vs sync (solo en modo 'add')
  const [tab, setTab] = useState<'manual' | 'sync'>('manual');
  
  // Manual state
  const [fullName, setFullName] = useState(client?.full_name ?? '');
  const [countryCode, setCountryCode] = useState('593');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(client?.email ?? '');
  const [notes, setNotes] = useState(client?.notes ?? '');
  
  // Sync state
  const [searchTag, setSearchTag] = useState('');
  const [foundClient, setFoundClient] = useState<Client | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (client?.phone) {
      const matched = COUNTRY_CODES.find(c => client.phone!.startsWith(c.code));
      if (matched) {
        setCountryCode(matched.code);
        setPhone(client.phone!.replace(matched.code, ''));
      } else {
        setPhone(client.phone!);
      }
    }
  }, [client]);

  const handleSearchTag = async () => {
    if (!searchTag.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const c = await searchClientByTag(searchTag);
      if (c) {
        setFoundClient(c);
      } else {
        setFoundClient(null);
        setError('No se encontró ningún cliente con ese Tag.');
      }
    } catch (e: any) {
      setError('Error al buscar: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async () => {
    if (!foundClient) return;
    setLoading(true);
    setError(null);
    try {
      await sendConnectionInvite(workshopId, foundClient.id, 'workshop');
      onSuccess();
      onClose();
    } catch (e: any) {
      setError('No se pudo enviar la invitación. Es posible que ya exista una solicitud.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const cleanNumber = phone.replace(/^0+/, '').replace(/\D/g, '');
      const fullPhone = countryCode + cleanNumber;
      const payload = {
        full_name: fullName,
        phone: fullPhone || null,
        email: email || null,
        notes: notes || null,
      };

      if (mode === 'add') {
        const newClient = await createClient(payload, workshopId);
        if (fullPhone && newClient?.id) {
          try {
            const { data: ws } = await supabase.from('workshops').select('name').eq('id', workshopId).single();
            await fetch(`${getBotApiUrl()}/api/send-welcome`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                phone: fullPhone,
                clientName: fullName,
                workshopName: ws?.name || 'nuestro taller',
                clientId: newClient.id,
                workshopId: workshopId
              })
            });
          } catch (botErr) {
            console.error('Bot err:', botErr);
          }
        }
      } else if (client) {
        await updateClient(client.id, payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el cliente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            {mode === 'add' ? 'Nuevo Cliente' : 'Editar Cliente'}
          </h3>
          <button className={styles.closeBtn} onClick={onClose} type="button">
            <Icon name="close" />
          </button>
        </div>

        {mode === 'add' && (
          <div style={{ display: 'flex', gap: '1rem', padding: '0 1.5rem', borderBottom: '1px solid var(--color-ghost-border)' }}>
            <button
              type="button"
              onClick={() => setTab('manual')}
              style={{ padding: '0.75rem 0', background: 'none', border: 'none', borderBottom: tab === 'manual' ? '2px solid var(--color-primary)' : '2px solid transparent', color: tab === 'manual' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)', fontWeight: 600, cursor: 'pointer' }}
            >
              Registro Manual
            </button>
            <button
              type="button"
              onClick={() => setTab('sync')}
              style={{ padding: '0.75rem 0', background: 'none', border: 'none', borderBottom: tab === 'sync' ? '2px solid var(--color-primary)' : '2px solid transparent', color: tab === 'sync' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <Icon name="handshake" style={{ fontSize: '1rem' }} /> Smart Sync
            </button>
          </div>
        )}

        {tab === 'manual' ? (
          <form onSubmit={handleSubmitManual}>
            <div className={styles.modalBody}>
              {error && <div className={styles.errorBox}>{error}</div>}

              <div className={styles.inputGroup}>
                <label className={styles.label}>Nombre Completo *</label>
                <input type="text" className={styles.input} value={fullName} onChange={e => setFullName(e.target.value)} required />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Teléfono</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select value={countryCode} onChange={e => setCountryCode(e.target.value)} className={styles.input} style={{ width: '100px' }}>
                    {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} +{c.code}</option>)}
                  </select>
                  <input type="tel" className={styles.input} value={phone} onChange={e => setPhone(e.target.value)} placeholder="990715214" style={{ flex: 1 }} />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Correo Electrónico</label>
                <input type="email" className={styles.input} value={email} onChange={e => setEmail(e.target.value)} />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Notas</label>
                <textarea className={`${styles.input} ${styles.textarea}`} value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
              <button type="submit" className={styles.primaryBtn} disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar Cliente'}
              </button>
            </div>
          </form>
        ) : (
          <div className={styles.modalBody}>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-on-surface-variant)', margin: '0 0 1rem 0' }}>
              Busca a un usuario registrado en el Portal B2C mediante su <strong>Tag de Cliente</strong> (Ej: AT-1A2B3C) para enviarle una solicitud de conexión.
            </p>
            {error && <div className={styles.errorBox}>{error}</div>}
            <div className={styles.inputGroup}>
              <label className={styles.label}>Tag de Cliente</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  className={styles.input} 
                  placeholder="AT-XXXXXX" 
                  value={searchTag} 
                  onChange={e => setSearchTag(e.target.value.toUpperCase())} 
                  style={{ textTransform: 'uppercase' }}
                />
                <button type="button" className={styles.secondaryBtn} onClick={handleSearchTag} disabled={loading || !searchTag}>
                  <Icon name="search" /> Buscar
                </button>
              </div>
            </div>

            {foundClient && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--color-surface-container-high)', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Icon name="person" /> {foundClient.full_name}
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-on-surface-variant)' }}>
                  Tag: {foundClient.client_tag}
                </p>
                <button 
                  type="button" 
                  className={styles.primaryBtn} 
                  style={{ width: '100%', marginTop: '1rem' }}
                  onClick={handleSendInvite}
                  disabled={loading}
                >
                  <Icon name="send" /> Enviar Invitación
                </button>
              </div>
            )}
            <div className={styles.modalFooter} style={{ borderTop: 'none', padding: '1rem 0 0 0' }}>
              <button type="button" className={styles.cancelBtn} onClick={onClose} style={{ width: '100%' }}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface DeleteConfirmProps {
  client: Client;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const DeleteConfirm: React.FC<DeleteConfirmProps> = ({ client, onClose, onConfirm }) => {
  const [loading, setLoading] = useState(false);
  const handleDelete = async () => {
    setLoading(true);
    await onConfirm();
    setLoading(false);
  };
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Eliminar Cliente</h3>
          <button className={styles.closeBtn} onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.deleteWarning}>
            <Icon name="warning" style={{ fontSize: '2.5rem', color: 'var(--color-error)' }} />
            <p>¿Estás seguro de que deseas eliminar a <strong>{client.full_name}</strong>?</p>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
          <button className={styles.dangerBtn} onClick={handleDelete} disabled={loading}>Eliminar</button>
        </div>
      </div>
    </div>
  );
};

interface ClientDetailProps {
  client: Client;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const ClientDetail: React.FC<ClientDetailProps> = ({ client, onClose, onEdit, onDelete }) => {
  const navigate = useNavigate();
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);

  useEffect(() => {
    getVehiclesByClient(client.id)
      .then(setVehicles)
      .catch(console.error)
      .finally(() => setLoadingVehicles(false));
  }, [client.id]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.detailModal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Ficha del Cliente</h3>
          <button className={styles.closeBtn} onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className={styles.detailBody}>
          <div className={styles.detailHero}>
            <div className={styles.detailAvatar}>{getInitials(client.full_name)}</div>
            <div>
              <h2 className={styles.detailName}>{client.full_name}</h2>
              <p className={styles.detailMeta}>
                {client.sync_status === 'connected' ? 'Cliente B2C Conectado' : 
                 client.sync_status === 'pending_approval' ? 'Invitación Pendiente' : 
                 'Registro Local (Taller)'}
              </p>
            </div>
          </div>
          <div className={styles.detailGrid}>
            <div className={styles.detailCard}>
              <Icon name="phone" style={{ color: 'var(--color-primary)' }} />
              <div>
                <p className={styles.detailCardLabel}>Teléfono</p>
                <p className={styles.detailCardValue}>{formatPhoneDisplay(client.phone) || 'No registrado'}</p>
              </div>
            </div>
            <div className={styles.detailCard}>
              <Icon name="email" style={{ color: 'var(--color-primary)' }} />
              <div>
                <p className={styles.detailCardLabel}>Correo</p>
                <p className={styles.detailCardValue}>{client.email || 'No registrado'}</p>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Icon name="directions_car" style={{ color: 'var(--color-primary)' }} />
              Vehículos ({vehicles.length})
            </h4>
            {loadingVehicles ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--color-outline)' }}>Cargando vehículos...</p>
            ) : vehicles.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {vehicles.map(v => (
                  <div key={v.id} style={{ padding: '0.75rem', background: 'var(--color-surface)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                    <span><strong>{v.plate}</strong> - {v.brand} {v.model}</span>
                    <button onClick={() => { onClose(); navigate('/vehicles'); }} style={{ color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}>Ver más</button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.875rem', color: 'var(--color-outline)' }}>Este cliente no tiene vehículos registrados.</p>
            )}
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.dangerBtn} onClick={onDelete}>Eliminar</button>
          <div style={{ flex: 1 }} />
          <button className={styles.cancelBtn} onClick={onClose}>Cerrar</button>
          <button className={styles.primaryBtn} onClick={onEdit} disabled={client.sync_status === 'connected'}>
            {client.sync_status === 'connected' ? 'Solo lectura' : 'Editar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ClientList = () => {
  const { profile } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChatName, setActiveChatName] = useState<string>('');

  useEffect(() => {
    if (profile?.workshop_id) fetchClients();
  }, [profile]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      if (!profile?.workshop_id) return;
      const [data, invites] = await Promise.all([
        getClients(profile.workshop_id),
        getWorkshopPendingInvites(profile.workshop_id)
      ]);
      setClients(data || []);
      setPendingInvites(invites || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async (connectionId: string) => {
    try {
      await acceptConnectionInvite(connectionId);
      fetchClients();
    } catch (e: any) {
      alert('Error al aceptar solicitud: ' + e.message);
    }
  };

  const handleDeclineInvite = async (connectionId: string) => {
    try {
      await declineConnectionInvite(connectionId);
      fetchClients();
    } catch (e: any) {
      alert('Error al declinar solicitud: ' + e.message);
    }
  };

  const filteredClients = (clients || []).filter(c =>
    c.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone && c.phone.includes(searchTerm))
  );

  const getSyncBadge = (status: string | undefined) => {
    if (status === 'connected') return <span style={{ padding: '0.2rem 0.5rem', background: 'rgba(16,185,129,0.1)', color: '#10b981', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Icon name="check_circle" style={{fontSize: '0.8rem'}}/> B2C Sync</span>;
    if (status === 'pending_approval') return <span style={{ padding: '0.2rem 0.5rem', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Icon name="schedule" style={{fontSize: '0.8rem'}}/> Pendiente</span>;
    return <span style={{ padding: '0.2rem 0.5rem', background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Icon name="person" style={{fontSize: '0.8rem'}}/> Local</span>;
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Gestión de Clientes</h1>
          <p className={styles.pageSubtitle}>{clients.length} clientes registrados</p>
        </div>
        <button className={styles.primaryBtn} onClick={() => { setSelectedClient(null); setModalMode('add'); }}>
          <Icon name="person_add" /> Nuevo Cliente
        </button>
      </div>

      {pendingInvites && pendingInvites.length > 0 && (
        <div style={{ background: 'var(--color-surface-container-high)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.5rem', marginBottom: '1.5rem', border: '1px solid var(--color-ghost-border)' }}>
          <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b' }}>
            <Icon name="mark_email_unread" /> Solicitudes de Conexión Entrantes ({pendingInvites.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {pendingInvites.map(inv => (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{inv.client?.full_name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-outline)' }}>Quiere conectarse a tu taller · ID: {inv.client?.client_tag}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className={styles.secondaryBtn} onClick={() => handleDeclineInvite(inv.id)}>Declinar</button>
                  <button className={styles.primaryBtn} onClick={() => handleAcceptInvite(inv.id)}>Aceptar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Icon name="search" className={styles.searchIcon} />
          <input className={styles.searchInput} placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Cliente</th>
              <th className={styles.th}>Estado</th>
              <th className={styles.th}>Teléfono</th>
              <th className={styles.th}>Correo</th>
              <th className={styles.th} style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-outline)' }}>
                  Cargando clientes...
                </td>
              </tr>
            ) : filteredClients.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-outline)' }}>
                  {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                </td>
              </tr>
            ) : (
              filteredClients.map(client => (
                <tr key={client.id} className={styles.tr} onClick={() => { setSelectedClient(client); setModalMode('detail'); }}>
                  <td className={styles.td}>
                    <div style={{ fontWeight: 600 }}>{client.full_name}</div>
                    {client.client_tag && <div style={{ fontSize: '0.7rem', color: 'var(--color-primary)' }}>ID: {client.client_tag}</div>}
                  </td>
                  <td className={styles.td}>{getSyncBadge(client.sync_status)}</td>
                  <td className={styles.td}>{formatPhoneDisplay(client.phone) || '—'}</td>
                  <td className={styles.td}>{client.email || '—'}</td>
                  <td className={styles.td} style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button 
                        className={styles.actionBtn} 
                        onClick={(e) => { e.stopPropagation(); setSelectedClient(client); setModalMode('detail'); }}
                        title="Ver detalle"
                      >
                        <Icon name="visibility" />
                      </button>
                      {client.sync_status === 'connected' && client.connection_id && (
                        <button 
                          className={styles.actionBtn} 
                          onClick={(e) => { e.stopPropagation(); setActiveChatId(client.connection_id!); setActiveChatName(client.full_name); }}
                          title="Abrir Chat"
                          style={{ color: 'var(--color-primary)' }}
                        >
                          <Icon name="chat" />
                        </button>
                      )}
                      <button 
                        className={styles.actionBtn} 
                        onClick={(e) => { e.stopPropagation(); setSelectedClient(client); setModalMode('edit'); }}
                        title="Editar"
                        disabled={client.sync_status === 'connected'}
                      >
                        <Icon name="edit" />
                      </button>
                      <button 
                        className={`${styles.actionBtn} ${styles.dangerBtn}`} 
                        onClick={(e) => { e.stopPropagation(); setSelectedClient(client); setShowDeleteConfirm(true); }}
                        title="Eliminar / Desconectar"
                        style={{ padding: '4px', minWidth: 'auto', height: 'auto' }}
                      >
                        <Icon name={client.sync_status === 'connected' ? 'link_off' : 'delete'} style={{ fontSize: '1.1rem' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(modalMode === 'add' || modalMode === 'edit') && profile?.workshop_id && (
        <ClientModal mode={modalMode} client={selectedClient} workshopId={profile.workshop_id} onClose={() => setModalMode(null)} onSuccess={fetchClients} />
      )}

      {modalMode === 'detail' && selectedClient && (
        <ClientDetail client={selectedClient} onClose={() => setModalMode(null)} onEdit={() => setModalMode('edit')} onDelete={() => setShowDeleteConfirm(true)} />
      )}

      {showDeleteConfirm && selectedClient && (
        <DeleteConfirm 
          client={selectedClient} 
          onClose={() => setShowDeleteConfirm(false)} 
          onConfirm={async () => { 
            if (selectedClient.sync_status === 'connected' && selectedClient.connection_id) {
              await supabase.from('workshop_clients').delete().eq('id', selectedClient.connection_id);
            } else {
              await deleteClient(selectedClient.id); 
            }
            setShowDeleteConfirm(false); 
            setModalMode(null); 
            fetchClients(); 
          }} 
        />
      )}

      {activeChatId && (
        <ConnectionChatModal
          connectionId={activeChatId}
          senderType="workshop"
          chatTitle={`Chat con ${activeChatName}`}
          onClose={() => setActiveChatId(null)}
        />
      )}
    </div>
  );
};

