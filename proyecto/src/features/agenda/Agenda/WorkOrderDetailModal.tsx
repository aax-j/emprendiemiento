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

  const handleStatusChange = async (newStatus: RepairHistory['status']) => {
    setLoading(true);
    try {
      await updateRepair(event.id, { status: newStatus });
      setStatus(newStatus);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Error al actualizar el estado');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de eliminar este registro?')) return;
    setLoading(true);
    try {
      await deleteRepair(event.id);
      onRefresh();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar');
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
          <button className={styles.dangerBtn} onClick={handleDelete} disabled={loading}>
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
    </div>
  );
};
