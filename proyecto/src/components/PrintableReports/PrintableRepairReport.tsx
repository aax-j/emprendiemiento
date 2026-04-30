import React from 'react';
import styles from './PrintableReports.module.css';
import { RepairHistory } from '../../lib/api/repairs';
import { RepairItem } from '../../lib/api/inventory';

interface PrintableRepairReportProps {
  repair: RepairHistory & { vehicles?: any };
  repairItems: RepairItem[];
  workshopInfo?: any; // To show workshop name/logo in the future
}

export const PrintableRepairReport = React.forwardRef<HTMLDivElement, PrintableRepairReportProps>(
  ({ repair, repairItems, workshopInfo }, ref) => {
    
    const calculateTotalInventoryCost = () => {
      return repairItems.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
    };

    const inventoryCost = calculateTotalInventoryCost();

    return (
      <div id="print-repair" className={styles.printContainer} ref={ref}>
        <div className={styles.printHeader}>
          <div>
            <h1 className={styles.printTitle}>Reporte de Reparación</h1>
            <p className={styles.printSubtitle}>Taller: {workshopInfo?.name || 'AutoTech Workshop'}</p>
          </div>
          <div className={styles.printMeta}>
            <p><strong>Fecha:</strong> {new Date().toLocaleDateString('es-CO')}</p>
            <p><strong>ID Reparación:</strong> {repair.id.slice(0, 8).toUpperCase()}</p>
            <p><strong>Estado:</strong> {repair.status.toUpperCase()}</p>
          </div>
        </div>

        <div className={styles.printSection}>
          <h2 className={styles.sectionTitle}>Información del Vehículo y Cliente</h2>
          <div className={styles.infoGrid}>
            <div>
              <p><strong>Placa:</strong> {repair.vehicles?.plate}</p>
              <p><strong>Marca/Modelo:</strong> {repair.vehicles?.brand} {repair.vehicles?.model} ({repair.vehicles?.year})</p>
            </div>
            <div>
              <p><strong>Cliente:</strong> {repair.vehicles?.clients?.full_name}</p>
              <p><strong>Teléfono:</strong> {repair.vehicles?.clients?.phone || 'N/A'}</p>
            </div>
          </div>
        </div>

        <div className={styles.printSection}>
          <h2 className={styles.sectionTitle}>Detalles de la Reparación</h2>
          <p><strong>Descripción:</strong> {repair.description || 'Sin descripción'}</p>
          <p><strong>Fecha Inicio:</strong> {repair.start_date ? new Date(repair.start_date).toLocaleDateString('es-CO') : 'N/A'}</p>
          <p><strong>Fecha Finalización:</strong> {repair.completed_at ? new Date(repair.completed_at).toLocaleDateString('es-CO') : 'N/A'}</p>
        </div>

        {repairItems.length > 0 && (
          <div className={styles.printSection}>
            <h2 className={styles.sectionTitle}>Inventario y Repuestos Utilizados</h2>
            <table className={styles.printTable}>
              <thead>
                <tr>
                  <th>Ítem</th>
                  <th>Cantidad</th>
                  <th>Precio Unitario</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {repairItems.map(item => (
                  <tr key={item.id}>
                    <td>{item.inventory?.name || 'Item Desconocido'}</td>
                    <td>{item.quantity}</td>
                    <td>${item.unit_price.toLocaleString('es-CO')}</td>
                    <td>${(item.quantity * item.unit_price).toLocaleString('es-CO')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.printFooter}>
          <div className={styles.totalsBox}>
            <p><strong>Costo de Repuestos:</strong> ${inventoryCost.toLocaleString('es-CO')}</p>
            <p><strong>Costo Total (Mano de obra + Repuestos):</strong> ${(repair.cost || 0).toLocaleString('es-CO')}</p>
          </div>
          <div className={styles.signatures}>
            <div className={styles.signatureLine}>Firma del Taller</div>
            <div className={styles.signatureLine}>Firma del Cliente</div>
          </div>
        </div>
      </div>
    );
  }
);

PrintableRepairReport.displayName = 'PrintableRepairReport';
