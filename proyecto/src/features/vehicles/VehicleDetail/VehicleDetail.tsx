import { useState, useEffect } from 'react';
import { VehicleWithClient } from '../../../lib/api/vehicles';
import { getRepairHistory, createRepair, updateRepair, deleteRepair, RepairHistory } from '../../../lib/api/repairs';
import { getRepairItems, saveRepairItems, RepairItem } from '../../../lib/api/inventory';
import { RepairItemsManager } from './RepairItemsManager';

import { Icon } from '../../../components/Icon/Icon';
import styles from './VehicleDetail.module.css';

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string, icon: string, cls: string }> = {
  pendiente:   { label: 'Pendiente',   icon: 'radio_button_unchecked', cls: 'open' },
  en_proceso:  { label: 'En Proceso',  icon: 'pending',                cls: 'inProgress' },
  completado:  { label: 'Completado',  icon: 'check_circle',           cls: 'completed' },
  cancelado:   { label: 'Cancelado',   icon: 'cancel',                 cls: 'open' },
};

const fmt = (date: string | null) =>
  date ? new Date(date + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ─── Add / Edit Repair Modal ──────────────────────────────────────────────────
interface RepairModalProps {
  vehicleId: string;
  workshopId: string;
  repair?: RepairHistory | null;
  onClose: () => void;
  onSuccess: () => void;
}

const RepairModal: React.FC<RepairModalProps> = ({ vehicleId, workshopId, repair, onClose, onSuccess }) => {
  const [description, setDescription]   = useState(repair?.description ?? '');
  const [status, setStatus]             = useState<RepairHistory['status']>(repair?.status ?? 'pendiente');
  const [cost, setCost]                 = useState(repair?.cost?.toString() ?? '');
  const [startDate, setStartDate]       = useState(repair?.start_date ?? '');
  const [deliveryDate, setDeliveryDate] = useState(repair?.delivery_date ?? '');
  const [items, setItems]               = useState<Omit<RepairItem, 'id' | 'repair_id' | 'inventory'>[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  useEffect(() => {
    if (repair) {
      getRepairItems(repair.id).then(data => {
        setItems(data.map(d => ({
          inventory_id: d.inventory_id,
          quantity: d.quantity,
          unit_price: d.unit_price,
          _name: d.inventory?.name,
          _type: d.inventory?.item_type
        } as any)));
      }).catch(console.error);
    }
  }, [repair]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        description,
        status,
        cost: cost ? parseFloat(cost) : null,
        start_date: startDate || null,
        delivery_date: deliveryDate || null,
      };
      let savedRepairId = repair?.id;
      if (repair) {
        await updateRepair(repair.id, payload);
      } else {
        const newRepair = await createRepair({
          vehicle_id: vehicleId,
          workshop_id: workshopId,
          ...payload,
        });
        savedRepairId = newRepair.id;
      }
      
      // Save items
      if (savedRepairId) {
        await saveRepairItems(savedRepairId, items);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{repair ? 'Editar Reparación' : 'Nueva Reparación'}</h3>
          <button className={styles.closeBtn} onClick={onClose}><Icon name="close" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            {error && <div className={styles.errorBox}>{error}</div>}

            <div className={styles.inputGroup}>
              <label className={styles.label}>Descripción del Trabajo *</label>
              <textarea
                className={`${styles.input} ${styles.textarea}`}
                placeholder="Ej: Cambio de aceite y filtro, revisión de frenos delanteros..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                required
                autoFocus
              />
            </div>

            {/* Fechas */}
            <div className={styles.formRow}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Fecha de Inicio</label>
                <input
                  type="date"
                  className={styles.input}
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Fecha de Entrega Estimada</label>
                <input
                  type="date"
                  className={styles.input}
                  value={deliveryDate}
                  onChange={e => setDeliveryDate(e.target.value)}
                  min={startDate || undefined}
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Estado</label>
                <select className={styles.input} value={status} onChange={e => setStatus(e.target.value as RepairHistory['status'])}>
                  <option value="pendiente">Pendiente</option>
                  <option value="en_proceso">En Proceso</option>
                  <option value="completado">Completado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Costo (opcional)</label>
                <input
                  type="number"
                  className={styles.input}
                  placeholder="0.00"
                  value={cost}
                  onChange={e => setCost(e.target.value)}
                  min={0}
                  step="0.01"
                />
              </div>
            </div>

            <RepairItemsManager 
              workshopId={workshopId}
              items={items}
              onChange={setItems}
              onCostChange={(newTotal) => setCost(newTotal.toString())}
            />
          </div>
          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={loading}>Cancelar</button>
            <button type="submit" className={styles.primaryBtn} disabled={loading || !description}>
              <Icon name={repair ? 'save' : 'build'} style={{ fontSize: '1.125rem' }} />
              {loading ? 'Guardando...' : repair ? 'Guardar Cambios' : 'Crear Registro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Main VehicleDetail ───────────────────────────────────────────────────────
interface VehicleDetailProps {
  vehicle: VehicleWithClient;
  workshopId: string;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUpdated: () => void;
  renderEditModal?: React.ReactNode;
  renderDeleteModal?: React.ReactNode;
}

export const VehicleDetail: React.FC<VehicleDetailProps> = ({
  vehicle, workshopId, onBack, onEdit, onDelete, renderEditModal, renderDeleteModal,
}) => {
  const [history, setHistory]                   = useState<RepairHistory[]>([]);
  const [loadingHistory, setLoadingHistory]     = useState(true);
  const [showRepairModal, setShowRepairModal]   = useState(false);
  const [editingRepair, setEditingRepair]       = useState<RepairHistory | null>(null);

  useEffect(() => { fetchHistory(); }, [vehicle.id]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await getRepairHistory(vehicle.id);
      setHistory(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDeleteRepair = async (id: string) => {
    if (!confirm('¿Eliminar este registro de reparación?')) return;
    await deleteRepair(id);
    await fetchHistory();
  };

  return (
    <div className={styles.page}>
      {/* Top Bar */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBack}>
          <Icon name="arrow_back" style={{ fontSize: '1.25rem' }} />
          Volver a Vehículos
        </button>
        <div className={styles.topBarActions}>
          <button className={styles.secondaryBtn} onClick={onEdit}>
            <Icon name="edit" style={{ fontSize: '1.125rem' }} />
            Editar
          </button>
          <button className={styles.dangerBtn} onClick={onDelete}>
            <Icon name="delete" style={{ fontSize: '1.125rem' }} />
            Eliminar
          </button>
        </div>
      </div>

      <div className={styles.layout}>
        {/* Left: Vehicle Info */}
        <aside className={styles.sidebar}>
          <div className={styles.vehicleHero}>
            <div className={styles.vehicleIcon}>
              <Icon name="directions_car" style={{ fontSize: '2.5rem' }} />
            </div>
            <div className={styles.plateDisplay}>{vehicle.plate}</div>
            <h2 className={styles.vehicleTitle}>{vehicle.brand} {vehicle.model}</h2>
            {vehicle.year && <p className={styles.vehicleYear}>{vehicle.year}</p>}
          </div>

          <div className={styles.infoSection}>
            <h4 className={styles.sectionLabel}>Datos del Vehículo</h4>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}><span className={styles.infoKey}>Marca</span><span className={styles.infoValue}>{vehicle.brand}</span></div>
              <div className={styles.infoItem}><span className={styles.infoKey}>Modelo</span><span className={styles.infoValue}>{vehicle.model}</span></div>
              {vehicle.year && <div className={styles.infoItem}><span className={styles.infoKey}>Año</span><span className={styles.infoValue}>{vehicle.year}</span></div>}
              {vehicle.color && <div className={styles.infoItem}><span className={styles.infoKey}>Color</span><span className={styles.infoValue}>{vehicle.color}</span></div>}
            </div>
          </div>

          {vehicle.notes && (
            <div className={styles.infoSection}>
              <h4 className={styles.sectionLabel}>Observaciones</h4>
              <p className={styles.notesText}>{vehicle.notes}</p>
            </div>
          )}

          <div className={styles.infoSection}>
            <h4 className={styles.sectionLabel}>Propietario</h4>
            <div className={styles.clientCard}>
              <div className={styles.clientAvatar}>
                {vehicle.clients?.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
              <div>
                <p className={styles.clientName}>{vehicle.clients?.full_name}</p>
                {vehicle.clients?.phone && <p className={styles.clientContact}>{vehicle.clients.phone}</p>}
                {vehicle.clients?.email && <p className={styles.clientContact}>{vehicle.clients.email}</p>}
              </div>
            </div>
          </div>

          <div className={styles.infoSection}>
            <h4 className={styles.sectionLabel}>Estadísticas</h4>
            <div className={styles.statsRow}>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{history.length}</span>
                <span className={styles.statLabel}>Total</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{history.filter(h => h.status === 'completado').length}</span>
                <span className={styles.statLabel}>Completadas</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{history.filter(h => h.status === 'pendiente' || h.status === 'en_proceso').length}</span>
                <span className={styles.statLabel}>Activas</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Right: Repair History */}
        <main className={styles.mainArea}>
          <div className={styles.historyHeader}>
            <div>
              <h3 className={styles.historyTitle}>Historial de Reparaciones</h3>
              <p className={styles.historySubtitle}>Registro completo de trabajos realizados en este vehículo</p>
            </div>
            <button className={styles.primaryBtn} onClick={() => { setEditingRepair(null); setShowRepairModal(true); }}>
              <Icon name="add" style={{ fontSize: '1.125rem' }} />
              Nueva Reparación
            </button>
          </div>

          {loadingHistory ? (
            <div className={styles.historyLoading}>
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className={styles.skeletonCard} />)}
            </div>
          ) : history.length === 0 ? (
            <div className={styles.historyEmpty}>
              <Icon name="build_circle" style={{ fontSize: '3.5rem', opacity: 0.3 }} />
              <p className={styles.emptyTitle}>Sin historial de reparaciones</p>
              <p className={styles.emptySubtitle}>Registra el primer trabajo realizado en este vehículo</p>
              <button className={styles.primaryBtn} style={{ marginTop: '1rem' }} onClick={() => { setEditingRepair(null); setShowRepairModal(true); }}>
                <Icon name="add" style={{ fontSize: '1rem' }} />
                Agregar Primera Reparación
              </button>
            </div>
          ) : (
            <div className={styles.timeline}>
              {history.map((repair, idx) => {
                const cfg = STATUS_CONFIG[repair.status];
                return (
                  <div key={repair.id} className={styles.timelineItem}>
                    <div className={styles.timelineConnector}>
                      <div className={`${styles.timelineDot} ${styles[`dot_${cfg.cls}`]}`}>
                        <Icon name={cfg.icon} style={{ fontSize: '1rem' }} />
                      </div>
                      {idx < history.length - 1 && <div className={styles.timelineLine} />}
                    </div>

                    <div className={styles.repairCard}>
                      <div className={styles.repairCardTop}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                          <span className={`${styles.statusChip} ${styles[`chip_${cfg.cls}`]}`}>{cfg.label}</span>
                          <span className={styles.repairDate}>
                            Registrado: {new Date(repair.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className={styles.repairActions}>
                          <button className={styles.iconActionBtn} title="Editar" onClick={() => { setEditingRepair(repair); setShowRepairModal(true); }}>
                            <Icon name="edit" style={{ fontSize: '1rem' }} />
                          </button>
                          <button className={`${styles.iconActionBtn} ${styles.dangerIconBtn}`} title="Eliminar" onClick={() => handleDeleteRepair(repair.id)}>
                            <Icon name="delete" style={{ fontSize: '1rem' }} />
                          </button>
                        </div>
                      </div>

                      <p className={styles.repairDesc}>{repair.description}</p>

                      {/* Dates row */}
                      {(repair.start_date || repair.delivery_date) && (
                        <div className={styles.repairDates}>
                          {repair.start_date && (
                            <span className={styles.dateChip}>
                              <Icon name="play_arrow" style={{ fontSize: '0.875rem' }} />
                              Inicio: {fmt(repair.start_date)}
                            </span>
                          )}
                          {repair.delivery_date && (
                            <span className={`${styles.dateChip} ${styles.dateChipDelivery}`}>
                              <Icon name="schedule_send" style={{ fontSize: '0.875rem' }} />
                              Entrega: {fmt(repair.delivery_date)}
                            </span>
                          )}
                        </div>
                      )}

                      <div className={styles.repairMeta}>
                        {repair.cost !== null && (
                          <span className={styles.repairCost}>
                            <Icon name="payments" style={{ fontSize: '0.875rem' }} />
                            ${repair.cost.toLocaleString('es-CO')}
                          </span>
                        )}
                        {repair.completed_at && (
                          <span className={styles.repairCompleted}>
                            <Icon name="check_circle" style={{ fontSize: '0.875rem' }} />
                            Completado el {new Date(repair.completed_at).toLocaleDateString('es-CO')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {showRepairModal && (
        <RepairModal
          vehicleId={vehicle.id}
          workshopId={workshopId}
          repair={editingRepair}
          onClose={() => { setShowRepairModal(false); setEditingRepair(null); }}
          onSuccess={fetchHistory}
        />
      )}
      {renderEditModal}
      {renderDeleteModal}
    </div>
  );
};
