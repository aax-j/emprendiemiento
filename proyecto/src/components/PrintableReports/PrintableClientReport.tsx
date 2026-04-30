import React from 'react';
import styles from './PrintableReports.module.css';

interface PrintableClientReportProps {
  workshopInfo?: any;
  client: any;
  vehicles: any[];
  history: any[];
}

export const PrintableClientReport = React.forwardRef<HTMLDivElement, PrintableClientReportProps>(
  ({ workshopInfo, client, vehicles, history }, ref) => {
    
    return (
      <div id="print-client" className={styles.printContainer} ref={ref}>
        <div className={styles.printHeader}>
          <div>
            <h1 className={styles.printTitle}>Reporte General de Cliente</h1>
            <p className={styles.printSubtitle}>Taller: {workshopInfo?.name || 'AutoTech Workshop'}</p>
          </div>
          <div className={styles.printMeta}>
            <p><strong>Fecha:</strong> {new Date().toLocaleDateString('es-CO')}</p>
          </div>
        </div>

        <div className={styles.printSection}>
          <h2 className={styles.sectionTitle}>Datos del Cliente</h2>
          <div className={styles.infoGrid}>
            <div>
              <p><strong>Nombre:</strong> {client.full_name}</p>
              <p><strong>Teléfono:</strong> {client.phone || 'N/A'}</p>
            </div>
            <div>
              <p><strong>Email:</strong> {client.email || 'N/A'}</p>
              <p><strong>Vehículos Registrados:</strong> {vehicles.length}</p>
            </div>
          </div>
        </div>

        <div className={styles.printSection}>
          <h2 className={styles.sectionTitle}>Vehículos Registrados</h2>
          <table className={styles.printTable}>
            <thead>
              <tr>
                <th>Placa</th>
                <th>Marca/Modelo</th>
                <th>Año</th>
                <th>Color</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map(v => (
                <tr key={v.id}>
                  <td><strong>{v.plate}</strong></td>
                  <td>{v.brand} {v.model}</td>
                  <td>{v.year}</td>
                  <td>{v.color || 'N/A'}</td>
                </tr>
              ))}
              {vehicles.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center' }}>No hay vehículos registrados</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.printSection}>
          <h2 className={styles.sectionTitle}>Historial de Reparaciones (Todos los vehículos)</h2>
          <table className={styles.printTable}>
            <thead>
              <tr>
                <th>Fecha Ingreso</th>
                <th>Vehículo</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th>Costo</th>
              </tr>
            </thead>
            <tbody>
              {history.map(repair => (
                <tr key={repair.id}>
                  <td>{new Date(repair.created_at).toLocaleDateString('es-CO')}</td>
                  <td><strong>{repair.vehicles?.plate}</strong></td>
                  <td>{repair.description}</td>
                  <td style={{ textTransform: 'capitalize' }}>{repair.status}</td>
                  <td>{repair.cost ? `$${Number(repair.cost).toLocaleString('es-CO')}` : 'Por definir'}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center' }}>No hay historial de reparaciones</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.printFooter}>
          <div className={styles.signatures}>
            <div className={styles.signatureLine}>Firma del Taller</div>
            <div className={styles.signatureLine}>Firma del Cliente</div>
          </div>
        </div>
      </div>
    );
  }
);

PrintableClientReport.displayName = 'PrintableClientReport';
