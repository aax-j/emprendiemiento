import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { getInventory } from '../../../lib/api/inventory';
import { Icon } from '../../../components/Icon/Icon';
import styles from './FinanceDashboard.module.css';

interface FinanceStats {
  totalRevenue: number;
  pendingRevenue: number;
  inventoryCapital: number;
  completedRepairsCount: number;
  activeRepairsCount: number;
}

interface RecentTransaction {
  id: string;
  vehiclePlate: string;
  description: string;
  cost: number;
  date: string;
}

export const FinanceDashboard = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState<FinanceStats>({
    totalRevenue: 0,
    pendingRevenue: 0,
    inventoryCapital: 0,
    completedRepairsCount: 0,
    activeRepairsCount: 0
  });
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFinanceData = async () => {
    if (!profile?.workshop_id) return;
    setLoading(true);

    try {
      // 1. Fetch repairs
      const { data: repairsData, error: repairsError } = await supabase
        .from('repair_history')
        .select('id, cost, status, completed_at, vehicles(plate)')
        .eq('workshop_id', profile.workshop_id);

      if (repairsError) throw repairsError;

      // 2. Fetch inventory
      const inventoryData = await getInventory(profile.workshop_id);

      // --- Calculate Stats ---
      let totalRev = 0;
      let pendingRev = 0;
      let compCount = 0;
      let actCount = 0;
      const transactions: RecentTransaction[] = [];

      (repairsData || []).forEach((repair: any) => {
        const cost = Number(repair.cost) || 0;
        const status = (repair.status || '').toLowerCase().trim();
        
        if (status === 'completado' || status === 'completada') {
          totalRev += cost;
          compCount++;
          
          if (cost > 0 && repair.completed_at) {
            transactions.push({
              id: repair.id,
              vehiclePlate: repair.vehicles?.plate || 'Desconocido',
              description: 'Cobro por reparación',
              cost: cost,
              date: repair.completed_at
            });
          }
        } else if (status === 'pendiente' || status === 'en_proceso' || status === 'open') {
          pendingRev += cost;
          actCount++;
        }
      });

      // Calculate Inventory Capital
      const invCapital = inventoryData.reduce((acc, item) => acc + (Number(item.price) * Number(item.stock)), 0);

      setStats({
        totalRevenue: totalRev,
        pendingRevenue: pendingRev,
        inventoryCapital: invCapital,
        completedRepairsCount: compCount,
        activeRepairsCount: actCount
      });

      // Sort transactions by date desc
      transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRecentTransactions(transactions.slice(0, 10)); // Top 10

    } catch (error) {
      console.error('Error fetching finance data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, [profile]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Finanzas</h1>
          <p className={styles.subtitle}>Resumen financiero y capital del taller</p>
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingState}>Cargando datos financieros...</div>
      ) : (
        <>
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={`${styles.kpiIconBox} ${styles.iconRevenue}`}>
                <Icon name="attach_money" />
              </div>
              <div className={styles.kpiContent}>
                <p className={styles.kpiLabel}>Ingresos Totales (Cobradas)</p>
                <h3 className={styles.kpiValue}>${stats.totalRevenue.toLocaleString('es-CO')}</h3>
                <p className={styles.kpiContext}>Basado en {stats.completedRepairsCount} reparaciones completadas</p>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={`${styles.kpiIconBox} ${styles.iconPending}`}>
                <Icon name="pending_actions" />
              </div>
              <div className={styles.kpiContent}>
                <p className={styles.kpiLabel}>Ingresos Pendientes / Proyectados</p>
                <h3 className={styles.kpiValue}>${stats.pendingRevenue.toLocaleString('es-CO')}</h3>
                <p className={styles.kpiContext}>Basado en {stats.activeRepairsCount} reparaciones activas</p>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={`${styles.kpiIconBox} ${styles.iconInventory}`}>
                <Icon name="inventory" />
              </div>
              <div className={styles.kpiContent}>
                <p className={styles.kpiLabel}>Capital en Inventario</p>
                <h3 className={styles.kpiValue}>${stats.inventoryCapital.toLocaleString('es-CO')}</h3>
                <p className={styles.kpiContext}>Valor inmovilizado en stock (según precio base)</p>
              </div>
            </div>
          </div>

          <div className={styles.contentGrid}>
            <div className={styles.tableCard}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>Ingresos Recientes</h3>
                <Icon name="receipt_long" style={{ color: 'var(--color-outline)' }} />
              </div>
              
              {recentTransactions.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No hay ingresos registrados recientemente.</p>
                </div>
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Vehículo</th>
                        <th>Concepto</th>
                        <th style={{ textAlign: 'right' }}>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTransactions.map(t => (
                        <tr key={t.id}>
                          <td>{new Date(t.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                          <td style={{ fontWeight: '600' }}>{t.vehiclePlate}</td>
                          <td style={{ color: 'var(--color-outline)' }}>{t.description}</td>
                          <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--color-on-surface)' }}>
                            ${t.cost.toLocaleString('es-CO')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
