import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { getClients, createClient, updateClient, deleteClient, Client } from '../../../lib/api/clients';
import { getVehiclesByClient, Vehicle } from '../../../lib/api/vehicles';
import { Icon } from '../../../components/Icon/Icon';
import styles from './ClientList.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────
type ModalMode = 'add' | 'edit' | 'detail' | null;

// ─── Sub-components ──────────────────────────────────────────────────────────

interface ClientModalProps {
  mode: 'add' | 'edit';
  client?: Client | null;
  workshopId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ClientModal: React.FC<ClientModalProps> = ({ mode, client, workshopId, onClose, onSuccess }) => {
  const [fullName, setFullName] = useState(client?.full_name ?? '');
  const [phone, setPhone] = useState(client?.phone ?? '');
  const [email, setEmail] = useState(client?.email ?? '');
  const [notes, setNotes] = useState(client?.notes ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        full_name: fullName,
        phone: phone || null,
        email: email || null,
        notes: notes || null,
      };
      if (mode === 'add') {
        await createClient(payload, workshopId);
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

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            {error && <div className={styles.errorBox}>{error}</div>}

            <div className={styles.inputGroup}>
              <label className={styles.label}>Nombre Completo *</label>
              <input
                type="text"
                className={styles.input}
                placeholder="Ej: Juan Pérez"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Teléfono</label>
                <input
                  type="tel"
                  className={styles.input}
                  placeholder="+57 300 123 4567"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Correo Electrónico</label>
                <input
                  type="email"
                  className={styles.input}
                  placeholder="juan@ejemplo.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Notas</label>
              <textarea
                className={`${styles.input} ${styles.textarea}`}
                placeholder="Observaciones importantes del cliente..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className={styles.primaryBtn} disabled={loading || !fullName}>
              <Icon name={mode === 'add' ? 'person_add' : 'save'} style={{ fontSize: '1.125rem' }} />
              {loading ? 'Guardando...' : mode === 'add' ? 'Crear Cliente' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
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
            <p className={styles.deleteSubtext}>Esta acción no se puede deshacer y eliminará todos sus vehículos asociados.</p>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={loading}>Cancelar</button>
          <button className={styles.dangerBtn} onClick={handleDelete} disabled={loading}>
            <Icon name="delete" style={{ fontSize: '1.125rem' }} />
            {loading ? 'Eliminando...' : 'Eliminar'}
          </button>
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
  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);

  useEffect(() => {
    getVehiclesByClient(client.id)
      .then(setVehicles)
      .catch(console.error)
      .finally(() => setLoadingVehicles(false));
  }, [client.id]);

  const goToVehicle = () => {
    onClose();
    navigate('/vehicles');
  };

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
                Cliente desde {new Date(client.created_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>

          <div className={styles.detailGrid}>
            <div className={styles.detailCard}>
              <Icon name="phone" style={{ fontSize: '1.25rem', color: 'var(--color-primary)' }} />
              <div>
                <p className={styles.detailCardLabel}>Teléfono</p>
                <p className={styles.detailCardValue}>{client.phone || 'No registrado'}</p>
              </div>
            </div>
            <div className={styles.detailCard}>
              <Icon name="email" style={{ fontSize: '1.25rem', color: 'var(--color-primary)' }} />
              <div>
                <p className={styles.detailCardLabel}>Correo Electrónico</p>
                <p className={styles.detailCardValue}>{client.email || 'No registrado'}</p>
              </div>
            </div>
          </div>

          {client.notes && (
            <div className={styles.detailNotes}>
              <p className={styles.detailCardLabel}>Notas</p>
              <p className={styles.detailNotesText}>{client.notes}</p>
            </div>
          )}

          <div className={styles.vehicleSection}>
            <div className={styles.vehicleSectionHeader}>
              <Icon name="directions_car" style={{ color: 'var(--color-primary)' }} />
              <h4>Vehículos ({vehicles.length})</h4>
            </div>
            {loadingVehicles ? (
              <div className={styles.vehicleEmpty}>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-outline)' }}>Cargando vehículos...</p>
              </div>
            ) : vehicles.length === 0 ? (
              <div className={styles.vehicleEmpty}>
                <Icon name="directions_car" style={{ fontSize: '2rem', opacity: 0.3 }} />
                <p>Este cliente no tiene vehículos registrados.</p>
                <button
                  className={styles.primaryBtn}
                  style={{ marginTop: '0.5rem', fontSize: '0.8125rem', padding: '0.4rem 0.875rem' }}
                  onClick={goToVehicle}
                >
                  <Icon name="add" style={{ fontSize: '1rem' }} />
                  Registrar Vehículo
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem' }}>
                {vehicles.map(v => (
                  <div
                    key={v.id}
                    className={styles.vehicleRow}
                    onClick={goToVehicle}
                    title="Ir al módulo de vehículos"
                  >
                    <span className={styles.vehiclePlateSmall}>{v.plate}</span>
                    <span className={styles.vehicleNameSmall}>{v.brand} {v.model}{v.year ? ` (${v.year})` : ''}</span>
                    <Icon name="chevron_right" style={{ fontSize: '1rem', color: 'var(--color-outline)', marginLeft: 'auto' }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.dangerBtn} onClick={onDelete}>
            <Icon name="delete" style={{ fontSize: '1.125rem' }} />
            Eliminar
          </button>
          <div style={{ flex: 1 }} />
          <button className={styles.cancelBtn} onClick={onClose}>Cerrar</button>
          <button className={styles.primaryBtn} onClick={onEdit}>
            <Icon name="edit" style={{ fontSize: '1.125rem' }} />
            Editar
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const ClientList = () => {
  const { profile } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (profile?.workshop_id) fetchClients();
  }, [profile]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      if (!profile?.workshop_id) return;
      const data = await getClients(profile.workshop_id);
      setClients(data);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedClient) return;
    await deleteClient(selectedClient.id);
    setShowDeleteConfirm(false);
    setModalMode(null);
    setSelectedClient(null);
    await fetchClients();
  };

  const openDetail = (client: Client) => {
    setSelectedClient(client);
    setModalMode('detail');
  };

  const openEdit = (client: Client) => {
    setSelectedClient(client);
    setModalMode('edit');
  };

  const openDeleteConfirm = (client: Client) => {
    setSelectedClient(client);
    setModalMode(null);
    setShowDeleteConfirm(true);
  };

  const closeAll = () => {
    setModalMode(null);
    setShowDeleteConfirm(false);
    setSelectedClient(null);
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  const filteredClients = clients.filter(c =>
    c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone && c.phone.includes(searchTerm)) ||
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className={styles.page}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Gestión de Clientes</h1>
          <p className={styles.pageSubtitle}>{clients.length} clientes registrados en tu taller</p>
        </div>
        <button className={styles.primaryBtn} onClick={() => { setSelectedClient(null); setModalMode('add'); }}>
          <Icon name="person_add" style={{ fontSize: '1.125rem' }} />
          Nuevo Cliente
        </button>
      </div>

      {/* Search & Filters */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Icon name="search" className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Buscar por nombre, teléfono o email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className={styles.clearSearch} onClick={() => setSearchTerm('')}>
              <Icon name="close" style={{ fontSize: '1rem' }} />
            </button>
          )}
        </div>
        <div className={styles.toolbarRight}>
          <span className={styles.resultCount}>{filteredClients.length} resultado{filteredClients.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Cliente</th>
              <th className={styles.th}>Teléfono</th>
              <th className={styles.th}>Correo</th>
              <th className={styles.th}>Registrado</th>
              <th className={styles.th} style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className={styles.skeletonRow}>
                  <td className={styles.td}>
                    <div className={styles.skeletonCell}>
                      <div className={styles.skeletonAvatar} />
                      <div className={styles.skeletonText} style={{ width: '140px' }} />
                    </div>
                  </td>
                  <td className={styles.td}><div className={styles.skeletonText} style={{ width: '100px' }} /></td>
                  <td className={styles.td}><div className={styles.skeletonText} style={{ width: '160px' }} /></td>
                  <td className={styles.td}><div className={styles.skeletonText} style={{ width: '80px' }} /></td>
                  <td className={styles.td} />
                </tr>
              ))
            ) : filteredClients.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className={styles.emptyState}>
                    <Icon name={searchTerm ? 'search_off' : 'group_add'} style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.4 }} />
                    <p className={styles.emptyTitle}>
                      {searchTerm ? 'Sin resultados para tu búsqueda' : 'No hay clientes todavía'}
                    </p>
                    <p className={styles.emptySubtitle}>
                      {searchTerm ? 'Intenta con otro término' : 'Comienza registrando tu primer cliente'}
                    </p>
                    {!searchTerm && (
                      <button className={styles.primaryBtn} style={{ marginTop: '1rem' }} onClick={() => setModalMode('add')}>
                        <Icon name="person_add" style={{ fontSize: '1rem' }} />
                        Agregar Cliente
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredClients.map(client => (
                <tr key={client.id} className={styles.tr} onClick={() => openDetail(client)}>
                  <td className={styles.td}>
                    <div className={styles.clientCell}>
                      <div className={styles.avatar}>{getInitials(client.full_name)}</div>
                      <div>
                        <span className={styles.clientName}>{client.full_name}</span>
                        {client.notes && (
                          <span className={styles.clientNote}>{client.notes.substring(0, 40)}…</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.tdText}>{client.phone || <span className={styles.empty}>—</span>}</span>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.tdText}>{client.email || <span className={styles.empty}>—</span>}</span>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.tdText}>
                      {new Date(client.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </td>
                  <td className={styles.td} onClick={e => e.stopPropagation()}>
                    <div className={styles.actions}>
                      <button
                        className={styles.actionBtn}
                        title="Ver detalle"
                        onClick={() => openDetail(client)}
                      >
                        <Icon name="visibility" style={{ fontSize: '1.125rem' }} />
                      </button>
                      <button
                        className={styles.actionBtn}
                        title="Editar"
                        onClick={() => openEdit(client)}
                      >
                        <Icon name="edit" style={{ fontSize: '1.125rem' }} />
                      </button>
                      <button
                        className={`${styles.actionBtn} ${styles.dangerActionBtn}`}
                        title="Eliminar"
                        onClick={() => openDeleteConfirm(client)}
                      >
                        <Icon name="delete" style={{ fontSize: '1.125rem' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {(modalMode === 'add' || modalMode === 'edit') && profile?.workshop_id && (
        <ClientModal
          mode={modalMode}
          client={selectedClient}
          workshopId={profile.workshop_id}
          onClose={closeAll}
          onSuccess={fetchClients}
        />
      )}

      {modalMode === 'detail' && selectedClient && (
        <ClientDetail
          client={selectedClient}
          onClose={closeAll}
          onEdit={() => openEdit(selectedClient)}
          onDelete={() => openDeleteConfirm(selectedClient)}
        />
      )}

      {showDeleteConfirm && selectedClient && (
        <DeleteConfirm
          client={selectedClient}
          onClose={closeAll}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
};
