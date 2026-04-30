import { useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import styles from './FinanceDashboard.module.css';
import { getExpenses } from '../../../lib/api/expenses';
import { getVehicles, VehicleWithClient } from '../../../lib/api/vehicles';
import { getRepairHistory, RepairHistory } from '../../../lib/api/repairs';
import { PrintableFinancialReport } from '../../../components/PrintableReports/PrintableFinancialReport';
import { PrintableVehicleReport } from '../../../components/PrintableReports/PrintableVehicleReport';
import { PrintableClientReport } from '../../../components/PrintableReports/PrintableClientReport';
import { getRepairItems } from '../../../lib/api/inventory';
import { generateAndSavePDF } from '../../../lib/pdf';
import { getClients, Client } from '../../../lib/api/clients';

interface ReportsTabProps {
  workshopId: string;
  repairsData: any[]; // All repairs passed from parent to calculate financial stats
}

export const ReportsTab: React.FC<ReportsTabProps> = ({ workshopId, repairsData }) => {
  const [loading, setLoading] = useState(false);
  const [printType, setPrintType] = useState<'financial' | 'vehicle' | 'client' | null>(null);
  
  // Financial Report State
  const [finStartDate, setFinStartDate] = useState('');
  const [finEndDate, setFinEndDate] = useState('');
  const [finReportData, setFinReportData] = useState<any>(null);

  // Vehicle/Client Report State
  const [clients, setClients] = useState<Client[]>([]);
  const [allVehicles, setAllVehicles] = useState<VehicleWithClient[]>([]);
  
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  
  const [vehReportData, setVehReportData] = useState<{ vehicle: VehicleWithClient, history: RepairHistory[] } | null>(null);
  const [clientReportData, setClientReportData] = useState<{ client: Client, vehicles: VehicleWithClient[], history: RepairHistory[] } | null>(null);

  // Fetch initial data
  useState(() => {
    const fetchData = async () => {
      try {
        const [c, v] = await Promise.all([
          getClients(workshopId),
          getVehicles(workshopId)
        ]);
        setClients(c);
        setAllVehicles(v);
      } catch (e) {
        console.error(e);
      }
    };
    fetchData();
  });

  const handleGenerateFinancial = async () => {
    if (!finStartDate || !finEndDate) return alert('Selecciona ambas fechas.');
    setLoading(true);
    try {
      // 1. Get expenses in range
      const expenses = await getExpenses(workshopId, finStartDate, finEndDate);
      
      // 2. Filter repairs in range
      const start = new Date(finStartDate).getTime();
      // End of day
      const end = new Date(finEndDate + 'T23:59:59').getTime();
      
      const filteredRepairs = repairsData.filter(r => {
        const time = new Date(r.completed_at || r.created_at).getTime();
        return time >= start && time <= end && r.status === 'completado';
      });

      // 3. Calculate revenue and inventory cost
      let totalRevenue = 0;
      let inventoryCost = 0;
      
      for (const repair of filteredRepairs) {
        totalRevenue += (Number(repair.cost) || 0);
        // Get items for this repair to calculate cost
        const items = await getRepairItems(repair.id);
        const repInvCost = items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
        inventoryCost += repInvCost;
      }

      // 4. Calculate total expenses
      const totalExpenses = expenses.reduce((acc, exp) => acc + Number(exp.amount), 0);
      
      // 5. Calculate net profit
      const netProfit = totalRevenue - inventoryCost - totalExpenses;

      setFinReportData({
        dateRange: `${finStartDate} al ${finEndDate}`,
        stats: { totalRevenue, inventoryCost, totalExpenses, netProfit },
        expenses,
        repairs: filteredRepairs
      });
      
      setPrintType('financial');
      setTimeout(async () => {
        try {
          await generateAndSavePDF('print-financial', `Reporte_Financiero_${finStartDate}.pdf`);
        } catch (e) {
          console.error('Error saving PDF', e);
          alert('Hubo un error al generar el PDF. Verifica los permisos.');
        } finally {
          setPrintType(null);
        }
      }, 500);

    } catch (err) {
      console.error(err);
      setLoading(false);
    } 
  };

  const handleGenerateVehicleReport = async () => {
    if (!selectedVehicleId) return;
    const vehicle = allVehicles.find(v => v.id === selectedVehicleId);
    if (!vehicle) return;
    
    setLoading(true);
    try {
      const history = await getRepairHistory(vehicle.id);
      setVehReportData({ vehicle, history });
      
      setPrintType('vehicle');
      setTimeout(async () => {
        try {
          await generateAndSavePDF('print-vehicle', `Historial_${vehicle.plate}.pdf`);
        } catch (e) {
          console.error('Error saving PDF', e);
          alert('Hubo un error al generar el PDF. Verifica los permisos.');
        } finally {
          setPrintType(null);
        }
      }, 500);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleGenerateClientReport = async () => {
    if (!selectedClientId) return;
    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return;

    setLoading(true);
    try {
      const clientVehicles = allVehicles.filter(v => v.client_id === selectedClientId);
      let fullHistory: RepairHistory[] = [];
      
      for (const v of clientVehicles) {
        const hist = await getRepairHistory(v.id);
        const histWithVehicle = hist.map(h => ({ ...h, vehicles: v }));
        fullHistory = [...fullHistory, ...histWithVehicle];
      }
      
      fullHistory.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setClientReportData({ client, vehicles: clientVehicles, history: fullHistory });
      setPrintType('client');
      
      setTimeout(async () => {
        try {
          await generateAndSavePDF('print-client', `Reporte_Cliente_${client.full_name.replace(/\s+/g, '_')}.pdf`);
        } catch (e) {
          console.error('Error saving PDF', e);
          alert('Hubo un error al generar el PDF.');
        } finally {
          setPrintType(null);
        }
      }, 500);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredVehicles = selectedClientId 
    ? allVehicles.filter(v => v.client_id === selectedClientId)
    : allVehicles;

  return (
    <div className={styles.reportsContainer}>
      <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem' }}>Generación de Reportes</h2>
      
      <div className={styles.reportOptionsGrid}>
        
        {/* Financial Report Card */}
        <div className={styles.reportCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className={styles.kpiIconBox} style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', width: '48px', height: '48px' }}>
              <Icon name="monitoring" style={{ fontSize: '1.5rem' }} />
            </div>
            <div>
              <h3>Reporte Financiero</h3>
              <p>Resumen de ingresos, gastos y utilidad</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Desde</label>
              <input type="date" className={styles.input} value={finStartDate} onChange={e => setFinStartDate(e.target.value)} />
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Hasta</label>
              <input type="date" className={styles.input} value={finEndDate} onChange={e => setFinEndDate(e.target.value)} />
            </div>
            <button 
              className={styles.primaryBtn} 
              style={{ justifyContent: 'center' }}
              onClick={handleGenerateFinancial}
              disabled={loading || !finStartDate || !finEndDate}
            >
              <Icon name="print" />
              Generar Reporte Financiero
            </button>
          </div>
        </div>

        {/* Vehicle Report Card */}
        <div className={styles.reportCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className={styles.kpiIconBox} style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', width: '48px', height: '48px' }}>
              <Icon name="directions_car" style={{ fontSize: '1.5rem' }} />
            </div>
            <div>
              <h3>Reporte de Vehículo</h3>
              <p>Historial completo de un vehículo</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Filtrar por Cliente</label>
              <select 
                className={styles.input}
                value={selectedClientId}
                onChange={e => {
                  setSelectedClientId(e.target.value);
                  setSelectedVehicleId(''); // Reset vehicle when client changes
                }}
              >
                <option value="">-- Todos los Clientes --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            </div>
            
            <div className={styles.inputGroup}>
              <label className={styles.label}>Seleccionar Vehículo</label>
              <select 
                className={styles.input}
                value={selectedVehicleId}
                onChange={e => {
                  setSelectedVehicleId(e.target.value);
                  // Auto-select client if a vehicle is chosen directly
                  const v = allVehicles.find(veh => veh.id === e.target.value);
                  if (v && v.client_id !== selectedClientId) {
                    setSelectedClientId(v.client_id);
                  }
                }}
              >
                <option value="">-- Seleccionar Vehículo --</option>
                {filteredVehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.plate} - {v.brand} {v.model}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button 
                className={styles.primaryBtn} 
                onClick={handleGenerateVehicleReport}
                disabled={loading || !selectedVehicleId}
                style={{ flex: 1, padding: '0.5rem', fontSize: '0.9rem' }}
              >
                <Icon name="print" />
                Auto
              </button>
              
              <button 
                className={styles.secondaryBtn} 
                onClick={handleGenerateClientReport}
                disabled={loading || !selectedClientId}
                style={{ flex: 1, padding: '0.5rem', fontSize: '0.9rem' }}
              >
                <Icon name="groups" />
                Cliente
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Hidden Print Areas */}
      <div style={{ display: 'none' }}>
        {/* We unhide them in CSS @media print by making the .printContainer visible absolute */}
      </div>
      
      {printType === 'financial' && finReportData && (
        <PrintableFinancialReport 
          dateRange={finReportData.dateRange}
          stats={finReportData.stats}
          expenses={finReportData.expenses}
          repairs={finReportData.repairs}
        />
      )}

      {printType === 'vehicle' && vehReportData && (
        <PrintableVehicleReport 
          vehicle={vehReportData.vehicle}
          history={vehReportData.history}
        />
      )}

      {printType === 'client' && clientReportData && (
        <PrintableClientReport 
          client={clientReportData.client}
          vehicles={clientReportData.vehicles}
          history={clientReportData.history}
        />
      )}
      
    </div>
  );
};
