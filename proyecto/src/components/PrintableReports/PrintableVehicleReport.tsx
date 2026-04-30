import React from 'react';
import styles from './PrintableReports.module.css';
import { VehicleWithClient } from '../../lib/api/vehicles';
import { RepairHistory } from '../../lib/api/repairs';

interface PrintableVehicleReportProps {
  workshopInfo?: any;
  vehicle: VehicleWithClient;
  history: RepairHistory[];
}

export const PrintableVehicleReport = React.forwardRef<HTMLDivElement, PrintableVehicleReportProps>(
  ({ workshopInfo, vehicle, history }, ref) => {
    
    const completedRepairs = history.filter(h => h.status === 'completado');

    return (
      <div id="print-vehicle" className={styles.printContainer} ref={ref}>
        <div className={styles.printHeader}>
          <div>
            <h1 className={styles.printTitle}>Reporte General de Vehículo</h1>
            <p className={styles.printSubtitle}>Taller: {workshopInfo?.name || 'AutoTech Workshop'}</p>
          </div>
          <div className={styles.printMeta}>
            <p><strong>Fecha Generación:</strong> {new Date().toLocaleDateString('es-CO')}</p>
          </div>
        </div>

        <div className={styles.printSection}>
          <h2 className={styles.sectionTitle}>Información del Vehículo y Cliente</h2>
          <div className={styles.infoGrid}>
            <div>
              <p><strong>Placa:</strong> {vehicle.plate}</p>
              <p><strong>Marca/Modelo:</strong> {vehicle.brand} {vehicle.model} ({vehicle.year || 'N/A'})</p>
              <p><strong>Color:</strong> {vehicle.color || 'N/A'}</p>
            </div>
            <div>
              <p><strong>Cliente:</strong> {vehicle.clients?.full_name}</p>
              <p><strong>Teléfono:</strong> {vehicle.clients?.phone || 'N/A'}</p>
              <p><strong>Email:</strong> {vehicle.clients?.email || 'N/A'}</p>
            </div>
          </div>
        </div>

        <div className={styles.printSection}>
          <h2 className={styles.sectionTitle}>Resumen de Historial</h2>
          <div className={styles.infoGrid}>
            <div>
              <p><strong>Total de Registros:</strong> {history.length}</p>
              <p><strong>Reparaciones Completadas:</strong> {completedRepairs.length}</p>
            </div>
            <div>
              <p><strong>Último Aceite:</strong> {vehicle.last_oil_change ? new Date(vehicle.last_oil_change + 'T00:00:00').toLocaleDateString('es-CO') : 'No registrado'}</p>
            </div>
          </div>
        </div>

        {history.length > 0 && (
          <div className={styles.printSection}>
            <h2 className={styles.sectionTitle}>Historial de Reparaciones Detallado</h2>
            <table className={styles.printTable}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Estado</th>
                  <th>Costo</th>
                </tr>
              </thead>
              <tbody>
                {history.map(repair => (
                  <tr key={repair.id}>
                    <td>{new Date(repair.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td>{repair.description}</td>
                    <td style={{ textTransform: 'capitalize' }}>{repair.status}</td>
                    <td>{repair.cost !== null ? `$${repair.cost.toLocaleString('es-CO')}` : 'N/A'}</td>
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

PrintableVehicleReport.displayName = 'PrintableVehicleReport';
