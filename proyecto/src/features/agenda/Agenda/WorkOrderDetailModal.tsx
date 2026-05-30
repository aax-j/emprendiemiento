import React, { useState } from 'react';
import { updateRepair, deleteRepair, RepairHistory } from '../../../lib/api/repairs';
import { Icon } from '../../../components/Icon/Icon';
import styles from './WorkOrderDetailModal.module.css';

interface WorkOrderDetailModalProps {
  event: RepairHistory & { vehicles?: any };
  onClose: () => void;
  onRefresh: () => void;
  onViewVehicleHistory: (vehicleId: string) => void;
}

export const WorkOrderDetailModal: React.FC<WorkOrderDetailModalProps> = ({ 
  event, onClose, onRefresh, onViewVehicleHistory 
}) => {
  const [status, setStatus] = useState(event.status);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleStatusChange = async (newStatus: RepairHistory['status']) => {
    setLoading(true);
    try {
      await updateRepair(event.id, { status: newStatus });
      setStatus(newStatus);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteRepair(event.id);
      onRefresh();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Detalle de la Cita</h3>
          <button className={styles.closeBtn} onClick={onClose}><Icon name="close" /></button>
        </div>

        <div className={styles.body}>
          {/* Vehicle Info */}
          <div className={styles.section}>
            <label className={styles.label}>Vehículo y Cliente</label>
            <div className={styles.infoCard}>
              <div className={styles.vehicleRow}>
                <span className={styles.plate}>{event.vehicles?.plate}</span>
                <span className={styles.vehicleName}>{event.vehicles?.brand} {event.vehicles?.model}</span>
              </div>
              <div className={styles.clientInfo}>
                <Icon name="person" style={{ fontSize: '1rem' }} />
                <span>{event.vehicles?.clients?.full_name}</span>
                {event.vehicles?.clients?.phone && (
                  <>
                    <span style={{ margin: '0 0.5rem' }}>•</span>
                    <span>{event.vehicles.clients.phone}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Schedule Info */}
          <div className={styles.metaGrid}>
            <div className={styles.section}>
              <label className={styles.label}>Fecha</label>
              <div className={styles.metaItem}>
                <Icon name="calendar_today" style={{ fontSize: '1rem' }} />
                <span>{new Date(event.start_date || event.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
              </div>
            </div>
            <div className={styles.section}>
              <label className={styles.label}>Estado Actual</label>
              <select 
                className={styles.statusSelect}
                value={status}
                onChange={(e) => handleStatusChange(e.target.value as any)}
                disabled={loading}
              >
                <option value="pendiente">Pendiente</option>
                <option value="en_proceso">En Proceso</option>
                <option value="completado">Completado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div className={styles.section}>
              <label className={styles.label}>Notas / Descripción</label>
              <p className={styles.desc}>{event.description}</p>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.dangerBtn} onClick={() => setShowDeleteConfirm(true)} disabled={loading}>
            <Icon name="delete" />
            Eliminar
          </button>
          <div style={{ flex: 1 }} />
          <button 
            className={styles.secondaryBtn} 
            onClick={() => onViewVehicleHistory(event.vehicle_id)}
          >
            <Icon name="history" />
            Ver Historial
          </button>
          <button className={styles.primaryBtn} onClick={onClose}>
            Aceptar
          </button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 1100, padding: '1rem',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{
            background: 'var(--color-surface)',
            borderRadius: '1rem',
            padding: '2rem',
            maxWidth: '360px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            textAlign: 'center',
          }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'rgba(239,68,68,0.1)', color: '#ef4444',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}>
              <Icon name="delete" style={{ fontSize: '1.75rem' }} />
            </div>
            <h3 style={{ margin: '0 0 0.75rem', color: 'var(--color-on-surface)', fontSize: '1.1rem', fontWeight: 700 }}>
              ¿Eliminar esta cita?
            </h3>
            <p style={{ margin: '0 0 1.75rem', color: 'var(--color-on-surface-variant)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Esta acción no se puede deshacer. Se eliminará el registro de{' '}
              <strong>{event.vehicles?.plate}</strong> permanentemente.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  flex: 1, padding: '0.75rem', borderRadius: '0.6rem',
                  border: '1px solid var(--color-outline-variant)',
                  background: 'transparent', color: 'var(--color-on-surface)',
                  fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                style={{
                  flex: 1, padding: '0.75rem', borderRadius: '0.6rem',
                  border: 'none', background: '#ef4444', color: 'white',
                  fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
