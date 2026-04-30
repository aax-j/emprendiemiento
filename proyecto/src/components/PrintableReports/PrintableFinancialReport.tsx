import React from 'react';
import styles from './PrintableReports.module.css';

interface PrintableFinancialReportProps {
  workshopInfo?: any;
  dateRange: string;
  stats: {
    totalRevenue: number;
    inventoryCost: number;
    totalExpenses: number;
    netProfit: number;
  };
  expenses: any[];
  repairs: any[];
}

export const PrintableFinancialReport = React.forwardRef<HTMLDivElement, PrintableFinancialReportProps>(
  ({ workshopInfo, dateRange, stats, expenses, repairs }, ref) => {
    return (
      <div id="print-financial" className={styles.printContainer} ref={ref}>
        <div className={styles.printHeader}>
          <div>
            <h1 className={styles.printTitle}>Reporte Financiero</h1>
            <p className={styles.printSubtitle}>Taller: {workshopInfo?.name || 'AutoTech Workshop'}</p>
          </div>
          <div className={styles.printMeta}>
            <p><strong>Fecha Generación:</strong> {new Date().toLocaleDateString('es-CO')}</p>
            <p><strong>Periodo:</strong> {dateRange}</p>
          </div>
        </div>

        <div className={styles.printSection}>
          <h2 className={styles.sectionTitle}>Resumen General</h2>
          <div className={styles.infoGrid}>
            <div>
              <p><strong>Ingresos Totales (Reparaciones Cobradas):</strong> ${stats.totalRevenue.toLocaleString('es-CO')}</p>
              <p><strong>Costo de Inventario Utilizado:</strong> -${stats.inventoryCost.toLocaleString('es-CO')}</p>
              <p><strong>Gastos Operativos Totales:</strong> -${stats.totalExpenses.toLocaleString('es-CO')}</p>
            </div>
            <div>
              <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                <strong>Utilidad Neta (Profit):</strong> ${stats.netProfit.toLocaleString('es-CO')}
              </p>
            </div>
          </div>
        </div>

        {repairs && repairs.length > 0 && (
          <div className={styles.printSection}>
            <h2 className={styles.sectionTitle}>Desglose de Ingresos (Reparaciones)</h2>
            <table className={styles.printTable}>
              <thead>
                <tr>
                  <th>Fecha Completado</th>
                  <th>Vehículo</th>
                  <th>Descripción</th>
                  <th>Ingreso Bruto</th>
                </tr>
              </thead>
              <tbody>
                {repairs.map(r => (
                  <tr key={r.id}>
                    <td>{new Date(r.completed_at || r.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td>{r.vehicles?.plate || 'Desconocido'}</td>
                    <td>{r.description || 'Reparación'}</td>
                    <td style={{ color: '#16a34a', fontWeight: 'bold' }}>${(Number(r.cost) || 0).toLocaleString('es-CO')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {expenses && expenses.length > 0 && (
          <div className={styles.printSection}>
            <h2 className={styles.sectionTitle}>Desglose de Gastos Operativos</h2>
            <table className={styles.printTable}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Categoría</th>
                  <th>Descripción</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(exp => (
                  <tr key={exp.id}>
                    <td>{new Date(exp.date + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td style={{ textTransform: 'capitalize' }}>{exp.category}</td>
                    <td>{exp.description}</td>
                    <td>${exp.amount.toLocaleString('es-CO')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.printFooter}>
          <div className={styles.signatures}>
            <div className={styles.signatureLine}>Revisado por (Firma)</div>
          </div>
        </div>
      </div>
    );
  }
);

PrintableFinancialReport.displayName = 'PrintableFinancialReport';
