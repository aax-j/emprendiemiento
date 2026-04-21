import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { getClients, createClient, Client } from '../../../lib/api/clients';
import { getVehiclesByClient, Vehicle, createVehicle } from '../../../lib/api/vehicles';
import { createRepair } from '../../../lib/api/repairs';
import { Icon } from '../../../components/Icon/Icon';
import styles from './ScheduleModal.module.css';

interface ScheduleModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: Date;
}

export const ScheduleModal: React.FC<ScheduleModalProps> = ({ onClose, onSuccess, initialDate }) => {
  const { profile } = useAuth();
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Form State
  const [clientSearch, setClientSearch] = useState('');
  const [clients, setClients]           = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientResults, setShowResults] = useState(false);

  const [vehicles, setVehicles]         = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  
  const [scheduledDate, setScheduledDate] = useState(
    initialDate ? initialDate.toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)
  );
  const [description, setDescription]     = useState('');

  // Quick Client Creation State
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [newClientName, setNewClientName]   = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');

  // Quick Vehicle Creation State
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  const [newVehiclePlate, setNewVehiclePlate] = useState('');
  const [newVehicleBrand, setNewVehicleBrand] = useState('');
  const [newVehicleModel, setNewVehicleModel] = useState('');

  // Search Clients
  useEffect(() => {
    if (clientSearch.length > 1 && !selectedClient) {
      const fetchClients = async () => {
        try {
          const all = await getClients(profile!.workshop_id);
          const filtered = all.filter(c => 
            c.full_name.toLowerCase().includes(clientSearch.toLowerCase()) ||
            c.phone?.includes(clientSearch)
          );
          setClients(filtered);
          setShowResults(true);
        } catch (err) {
          console.error(err);
        }
      };
      fetchClients();
    } else {
      setShowResults(false);
    }
  }, [clientSearch, selectedClient, profile]);

  // Fetch Vehicles when client is selected
  useEffect(() => {
    if (selectedClient) {
      getVehiclesByClient(selectedClient.id).then(setVehicles).catch(console.error);
    } else {
      setVehicles([]);
    }
  }, [selectedClient]);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const c = await createClient({ 
        full_name: newClientName, 
        phone: newClientPhone || null,
        email: null,
        notes: null
      }, profile!.workshop_id);
      setSelectedClient(c);
      setClientSearch(c.full_name);
      setIsAddingClient(false);
      setIsAddingVehicle(true); // Automatically offer to add a vehicle for new client
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !profile) return;
    setLoading(true);
    try {
      const v = await createVehicle({
        plate: newVehiclePlate.toUpperCase(),
        brand: newVehicleBrand,
        model: newVehicleModel,
        year: null,
        color: null,
        notes: null,
        client_id: selectedClient.id,
      }, profile.workshop_id);
      
      const updatedVehicles = await getVehiclesByClient(selectedClient.id);
      setVehicles(updatedVehicles);
      setSelectedVehicle(v.id);
      setIsAddingVehicle(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle || !profile) return;
    setLoading(true);
    try {
      const dateObj = new Date(scheduledDate);
      const timeString = dateObj.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
      const startDateString = scheduledDate.split('T')[0];
      
      const formattedDescription = `[${timeString}] - ${description || 'Cita agendada'}`;

      await createRepair({
        vehicle_id: selectedVehicle,
        workshop_id: profile.workshop_id,
        status: 'pendiente',
        description: formattedDescription,
        cost: null,
        start_date: startDateString,
        delivery_date: null
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Agendar Nueva Reparación</h3>
          <button className={styles.closeBtn} onClick={onClose}><Icon name="close" /></button>
        </div>

        <div className={styles.body}>
          {error && <div className={styles.errorBox}>{error}</div>}

          {/* Client Selection */}
          {!isAddingClient ? (
            <div className={styles.formGroup}>
              <div className={styles.searchHeader}>
                <label className={styles.label}>Cliente</label>
                <button 
                  className={styles.quickAddBtn}
                  onClick={() => setIsAddingClient(true)}
                >
                  <Icon name="person_add" style={{ fontSize: '1rem' }} />
                  Nuevo Cliente
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Buscar por nombre o teléfono..."
                  value={clientSearch}
                  onChange={e => {
                    setClientSearch(e.target.value);
                    if (selectedClient) setSelectedClient(null);
                  }}
                />
                {showClientResults && clients.length > 0 && (
                  <div className={styles.resultsList}>
                    {clients.map(c => (
                      <div 
                        key={c.id} 
                        className={styles.resultItem}
                        onClick={() => {
                          setSelectedClient(c);
                          setClientSearch(c.full_name);
                          setShowResults(false);
                        }}
                      >
                        <span className={styles.resultName}>{c.full_name}</span>
                        <span className={styles.resultMeta}>{c.phone || 'Sin teléfono'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.formGroup} style={{ padding: '1rem', border: '1px dashed var(--color-primary)', borderRadius: 'var(--radius-md)' }}>
              <div className={styles.searchHeader}>
                <label className={styles.label} style={{ color: 'var(--color-primary)' }}>Registro Rápido de Cliente</label>
                <button className={styles.quickAddBtn} onClick={() => setIsAddingClient(false)}>Cancelar</button>
              </div>
              <div className={styles.grid}>
                <input 
                  type="text" 
                  className={styles.input} 
                  placeholder="Nombre Completo" 
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                />
                <input 
                  type="text" 
                  className={styles.input} 
                  placeholder="Teléfono" 
                  value={newClientPhone}
                  onChange={e => setNewClientPhone(e.target.value)}
                />
              </div>
              <button 
                className={styles.primaryBtn} 
                style={{ marginTop: '0.5rem', width: '100%', fontSize: '0.875rem' }}
                onClick={handleCreateClient}
                disabled={!newClientName || loading}
              >
                Crear y Seleccionar Cliente
              </button>
            </div>
          )}

          {/* Vehicle Selection */}
          {!isAddingVehicle ? (
            <div className={styles.formGroup}>
              <div className={styles.searchHeader}>
                <label className={styles.label}>Vehículo</label>
                {selectedClient && (
                  <button 
                    className={styles.quickAddBtn}
                    onClick={() => setIsAddingVehicle(true)}
                  >
                    <Icon name="add_circle" style={{ fontSize: '1rem' }} />
                    Nuevo Vehículo
                  </button>
                )}
              </div>
              <select 
                className={styles.select}
                value={selectedVehicle}
                onChange={e => setSelectedVehicle(e.target.value)}
                disabled={!selectedClient}
              >
                <option value="">{selectedClient ? 'Seleccionar vehículo...' : 'Primero selecciona un cliente'}</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.plate} - {v.brand} {v.model}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className={styles.formGroup} style={{ padding: '1rem', border: '1px dashed var(--color-primary)', borderRadius: 'var(--radius-md)' }}>
              <div className={styles.searchHeader}>
                <label className={styles.label} style={{ color: 'var(--color-primary)' }}>Registro Rápido de Vehículo</label>
                <button className={styles.quickAddBtn} onClick={() => setIsAddingVehicle(false)}>Cancelar</button>
              </div>
              <div className={styles.quickRegGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Placa / Matrícula</label>
                  <input 
                    type="text" 
                    className={styles.input} 
                    placeholder="ABC-123" 
                    value={newVehiclePlate}
                    onChange={e => setNewVehiclePlate(e.target.value.toUpperCase())}
                  />
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Marca</label>
                    <input 
                      type="text" 
                      className={styles.input} 
                      placeholder="Ej: Toyota" 
                      value={newVehicleBrand}
                      onChange={e => setNewVehicleBrand(e.target.value)}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Modelo</label>
                    <input 
                      type="text" 
                      className={styles.input} 
                      placeholder="Ej: Corolla" 
                      value={newVehicleModel}
                      onChange={e => setNewVehicleModel(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <button 
                className={styles.primaryBtn} 
                style={{ marginTop: '0.5rem', width: '100%', fontSize: '0.875rem' }}
                onClick={handleCreateVehicle}
                disabled={!newVehiclePlate || !newVehicleBrand || loading}
              >
                Crear y Seleccionar Vehículo
              </button>
            </div>
          )}

          {/* Date & Time */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Fecha y Hora Agendada</label>
            <input
              type="datetime-local"
              className={styles.input}
              value={scheduledDate}
              onChange={e => setScheduledDate(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Razón de la Reparación / Notas</label>
            <textarea
              className={styles.textarea}
              placeholder="Describa el problema o el servicio solicitado..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.secondaryBtn} onClick={onClose}>Cancelar</button>
          <button 
            className={styles.primaryBtn} 
            onClick={handleSubmit}
            disabled={loading || !selectedVehicle || !scheduledDate}
          >
            {loading ? 'Agendando...' : 'Agendar Cita'}
          </button>
        </div>
      </div>
    </div>
  );
};
