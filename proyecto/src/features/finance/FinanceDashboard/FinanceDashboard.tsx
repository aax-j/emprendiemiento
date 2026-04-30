import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { getInventory, getRepairItems } from '../../../lib/api/inventory';
import { getExpenses } from '../../../lib/api/expenses';
import { Icon } from '../../../components/Icon/Icon';
import styles from './FinanceDashboard.module.css';

// Sub-components
import { ExpensesTab } from './ExpensesTab';
import { ReportsTab } from './ReportsTab';

interface FinanceStats {
  totalRevenue: number;
  pendingRevenue: number;
  inventoryCapital: number;
  totalExpenses: number;
  inventoryCost: number; // Cost of inventory used in completed repairs
  netProfit: number;
  completedRepairsCount: number;
  activeRepairsCount: number;
}

interface RecentTransaction {
  id: string;
  vehiclePlate: string;
  description: string;
  cost: number;
  date: string;
  type: 'income' | 'expense';
}

export const FinanceDashboard = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'resumen' | 'gastos' | 'reportes'>('resumen');
  
  const [stats, setStats] = useState<FinanceStats>({
    totalRevenue: 0,
    pendingRevenue: 0,
    inventoryCapital: 0,
    totalExpenses: 0,
    inventoryCost: 0,
    netProfit: 0,
    completedRepairsCount: 0,
    activeRepairsCount: 0
  });
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [rawRepairs, setRawRepairs] = useState<any[]>([]);

  const fetchFinanceData = async () => {
    if (!profile?.workshop_id) return;
    setLoading(true);

    try {
      // 1. Fetch repairs
      const { data: repairsData, error: repairsError } = await supabase
        .from('repair_history')
        .select('*, vehicles(plate)')
        .eq('workshop_id', profile.workshop_id);

      if (repairsError) throw repairsError;
      setRawRepairs(repairsData || []);

      // 2. Fetch inventory
      const inventoryData = await getInventory(profile.workshop_id);

      // 3. Fetch expenses
      const expensesData = await getExpenses(profile.workshop_id);

      // --- Calculate Stats ---
      let totalRev = 0;
      let pendingRev = 0;
      let invCost = 0;
      let compCount = 0;
      let actCount = 0;
      const transactions: RecentTransaction[] = [];

      // Calculate total expenses
      const totalExp = expensesData.reduce((acc, exp) => acc + Number(exp.amount), 0);

      for (const repair of (repairsData || [])) {
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
              date: repair.completed_at,
              type: 'income'
            });
          }

          // Calculate inventory cost for this completed repair
          const rItems = await getRepairItems(repair.id);
          const rInvCost = rItems.reduce((acc, item) => acc + (item.quantity * (item.unit_cost || 0)), 0);
          invCost += rInvCost;

        } else if (status === 'pendiente' || status === 'en_proceso' || status === 'open') {
          pendingRev += cost;
          actCount++;
        }
      }

      // Add expenses to recent transactions
      expensesData.forEach(exp => {
        transactions.push({
          id: exp.id,
          vehiclePlate: 'N/A',
          description: `Gasto: ${exp.category} - ${exp.description}`,
          cost: Number(exp.amount),
          date: exp.date,
          type: 'expense'
        });
      });

      // Calculate Inventory Capital (current stock) using base cost
      const invCapital = inventoryData.reduce((acc, item) => acc + ((item.cost || 0) * Number(item.stock)), 0);

      // Calculate Net Profit
      const profit = totalRev - invCost - totalExp;

      setStats({
        totalRevenue: totalRev,
        pendingRevenue: pendingRev,
        inventoryCapital: invCapital,
        totalExpenses: totalExp,
        inventoryCost: invCost,
        netProfit: profit,
        completedRepairsCount: compCount,
        activeRepairsCount: actCount
      });

      // Sort transactions by date desc
      transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRecentTransactions(transactions.slice(0, 15)); // Top 15

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
          <h1 className={styles.title}>Finanzas y Reportes</h1>
          <p className={styles.subtitle}>Gestión financiera, gastos y generación de reportes del taller</p>
        </div>
        
        <div className={styles.tabsContainer}>
          <button 
            className={`${styles.tabButton} ${activeTab === 'resumen' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('resumen')}
          >
            <Icon name="dashboard" />
            Resumen General
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'gastos' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('gastos')}
          >
            <Icon name="receipt_long" />
            Gastos
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'reportes' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('reportes')}
          >
            <Icon name="summarize" />
            Reportes
          </button>
        </div>
      </div>

      {activeTab === 'gastos' && profile?.workshop_id && (
        <ExpensesTab workshopId={profile.workshop_id} onExpensesChanged={fetchFinanceData} />
      )}

      {activeTab === 'reportes' && profile?.workshop_id && (
        <ReportsTab workshopId={profile.workshop_id} repairsData={rawRepairs} />
      )}

      {activeTab === 'resumen' && (
        loading ? (
          <div className={styles.loadingState}>Cargando datos financieros...</div>
        ) : (
          <>
            <div className={styles.kpiGrid}>
              <div className={styles.kpiCard}>
                <div className={`${styles.kpiIconBox} ${styles.iconRevenue}`}>
                  <Icon name="attach_money" />
                </div>
                <div className={styles.kpiContent}>
                  <p className={styles.kpiLabel}>Ingresos Brutos (Reparaciones)</p>
                  <h3 className={styles.kpiValue}>${stats.totalRevenue.toLocaleString('es-CO')}</h3>
                  <p className={styles.kpiContext}>{stats.completedRepairsCount} reparaciones completadas</p>
                </div>
              </div>

              <div className={styles.kpiCard}>
                <div className={`${styles.kpiIconBox} ${styles.iconExpense}`}>
                  <Icon name="money_off" />
                </div>
                <div className={styles.kpiContent}>
                  <p className={styles.kpiLabel}>Gastos Operativos + Repuestos</p>
                  <h3 className={styles.kpiValue}>${(stats.totalExpenses + stats.inventoryCost).toLocaleString('es-CO')}</h3>
                  <p className={styles.kpiContext}>
                    Gastos: ${stats.totalExpenses.toLocaleString('es-CO')} | Repuestos: ${stats.inventoryCost.toLocaleString('es-CO')}
                  </p>
                </div>
              </div>

              <div className={styles.kpiCard}>
                <div className={`${styles.kpiIconBox} ${styles.iconProfit}`}>
                  <Icon name="account_balance_wallet" />
                </div>
                <div className={styles.kpiContent}>
                  <p className={styles.kpiLabel}>Utilidad Neta (Profit)</p>
                  <h3 className={styles.kpiValue} style={{ color: stats.netProfit >= 0 ? '#16a34a' : '#ef4444' }}>
                    ${stats.netProfit.toLocaleString('es-CO')}
                  </h3>
                  <p className={styles.kpiContext}>Ingresos - (Gastos + Repuestos)</p>
                </div>
              </div>

              <div className={styles.kpiCard}>
                <div className={`${styles.kpiIconBox} ${styles.iconInventory}`}>
                  <Icon name="inventory" />
                </div>
                <div className={styles.kpiContent}>
                  <p className={styles.kpiLabel}>Capital en Inventario Actual</p>
                  <h3 className={styles.kpiValue}>${stats.inventoryCapital.toLocaleString('es-CO')}</h3>
                  <p className={styles.kpiContext}>Valor inmovilizado en stock</p>
                </div>
              </div>
            </div>

            <div className={styles.contentGrid}>
              <div className={styles.tableCard}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>Últimos Movimientos</h3>
                  <Icon name="history" style={{ color: 'var(--color-outline)' }} />
                </div>
                
                {recentTransactions.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p>No hay movimientos registrados recientemente.</p>
                  </div>
                ) : (
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Tipo</th>
                          <th>Vehículo / Categoría</th>
                          <th>Descripción</th>
                          <th style={{ textAlign: 'right' }}>Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentTransactions.map(t => (
                          <tr key={t.id + t.type}>
                            <td>{new Date(t.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                            <td>
                              <span style={{ 
                                padding: '4px 8px', 
                                borderRadius: '4px', 
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                backgroundColor: t.type === 'income' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                color: t.type === 'income' ? '#16a34a' : '#ef4444'
                              }}>
                                {t.type === 'income' ? 'Ingreso' : 'Gasto'}
                              </span>
                            </td>
                            <td style={{ fontWeight: '600' }}>{t.vehiclePlate}</td>
                            <td style={{ color: 'var(--color-outline)' }}>{t.description}</td>
                            <td style={{ 
                              textAlign: 'right', 
                              fontWeight: '700', 
                              color: t.type === 'income' ? '#16a34a' : '#ef4444' 
                            }}>
                              {t.type === 'income' ? '+' : '-'}${t.cost.toLocaleString('es-CO')}
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
        )
      )}
    </div>
  );
};
