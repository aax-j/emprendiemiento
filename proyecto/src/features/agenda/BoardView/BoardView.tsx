import { RepairHistory } from '../../../lib/api/repairs';
import { Icon } from '../../../components/Icon/Icon';
import styles from './BoardView.module.css';

interface BoardViewProps {
  events: (RepairHistory & { vehicles?: any })[];
  onSelectEvent: (event: RepairHistory & { vehicles?: any }) => void;
}

const COLUMN_CONFIG = [
  { id: 'pendiente',   label: 'Pendientes',    icon: 'schedule' },
  { id: 'en_proceso',  label: 'En Proceso',    icon: 'build' },
  { id: 'completado',  label: 'Completados',   icon: 'check_circle' },
];

export const BoardView: React.FC<BoardViewProps> = ({ events, onSelectEvent }) => {
  const getOrdersByStatus = (status: string) => {
    return events.filter(wo => wo.status === status);
  };

  return (
    <div className={styles.container}>
      {COLUMN_CONFIG.map(col => {
        const orders = getOrdersByStatus(col.id);
        return (
          <div key={col.id} className={styles.column}>
            <div className={styles.colHeader}>
              <Icon name={col.icon} style={{ fontSize: '1rem', color: 'var(--color-outline)' }} />
              <h3 className={styles.colTitle}>{col.label}</h3>
              <span className={styles.count}>{orders.length}</span>
            </div>

            <div className={styles.cardList}>
              {orders.map(order => (
                <div 
                  key={order.id} 
                  className={styles.card}
                  onClick={() => onSelectEvent(order)}
                >
                  <div className={styles.cardHeader}>
                    <span className={styles.plate}>{order.vehicles?.plate}</span>
                    <span className={styles.time}>
                      {new Date(order.start_date || order.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                  
                  <div>
                    <p className={styles.client}>{order.vehicles?.clients.full_name}</p>
                    <p className={styles.vehicleInfo}>{order.vehicles?.brand} {order.vehicles?.model}</p>
                  </div>

                  {order.description && (
                    <p className={styles.desc}>{order.description}</p>
                  )}

                  <div className={styles.cardFooter}>
                    <div className={`${styles.statusDot} ${styles[`dot_${order.status}`]}`} />
                  </div>
                </div>
              ))}
              {orders.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-outline)', fontSize: '0.8125rem' }}>
                  Sin reparaciones
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
