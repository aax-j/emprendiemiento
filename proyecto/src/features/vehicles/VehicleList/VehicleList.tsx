import { useState, useEffect, useRef } from 'react';
import { getBotApiUrl } from '../../../lib/api/bot';
import { supabase } from '../../../lib/supabase';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { getClients, Client } from '../../../lib/api/clients';
import {
  getVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  VehicleWithClient,
  getVehicleById,
} from '../../../lib/api/vehicles';
import { Icon } from '../../../components/Icon/Icon';
import { VehicleDetail } from '../VehicleDetail/VehicleDetail';
import CameraScanner from '../VehicleRegistration/CameraScanner';
import { CAR_BRANDS, CAR_BRANDS_AND_MODELS } from '../VehicleRegistration/carData';
import styles from './VehicleList.module.css';

// ─── Vehicle Modal (Add / Edit) ───────────────────────────────────────────────
interface VehicleModalProps {
  mode: 'add' | 'edit';
  vehicle?: VehicleWithClient | null;
  workshopId: string;
  clients: Client[];
  onClose: () => void;
  onSuccess: () => void;
  workshopName: string;
}

const VehicleModal: React.FC<VehicleModalProps> = ({
  mode, vehicle, workshopId, clients, onClose, onSuccess, workshopName,
}) => {
  const [plate, setPlate]         = useState(vehicle?.plate ?? '');
  
  const initialBrand = vehicle?.brand ?? '';
  const initialBrandIsCustom = initialBrand && !CAR_BRANDS.includes(initialBrand);
  const [selectedBrand, setSelectedBrand] = useState(initialBrandIsCustom ? 'Otro' : initialBrand);
  const [customBrand, setCustomBrand]     = useState(initialBrandIsCustom ? initialBrand : '');

  const initialModel = vehicle?.model ?? '';
  const initialModelList = CAR_BRANDS_AND_MODELS[initialBrandIsCustom ? 'Otro' : initialBrand] || [];
  const initialModelIsCustom = initialModel && !initialModelList.includes(initialModel);
  const [selectedModel, setSelectedModel] = useState(initialModelIsCustom ? 'Otro' : initialModel);
  const [customModel, setCustomModel]     = useState(initialModelIsCustom ? initialModel : '');

  const [year, setYear]           = useState(vehicle?.year?.toString() ?? '');
  const [color, setColor]         = useState(vehicle?.color ?? '');
  const [notes, setNotes]         = useState(vehicle?.notes ?? '');
  const [lastOilChange, setLastOilChange] = useState(vehicle?.last_oil_change ?? '');
  const [clientId, setClientId]   = useState(vehicle?.client_id ?? '');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const plateInputRef             = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const finalBrand = selectedBrand === 'Otro' ? customBrand : selectedBrand;
      const finalModel = selectedModel === 'Otro' ? customModel : selectedModel;

      const payload = {
        plate: plate.toUpperCase().trim(),
        brand: finalBrand,
        model: finalModel,
        year: year ? parseInt(year) : null,
        color: color || null,
        notes: notes || null,
        last_oil_change: lastOilChange || null,
        client_id: clientId,
      };
      if (mode === 'add') {
        const newVehicle = await createVehicle(payload, workshopId);
        
        // Disparar mensaje del Bot
        const client = clients.find(c => c.id === clientId);
        if (client?.phone) {
          fetch(`${getBotApiUrl()}/api/send-vehicle-welcome`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: client.phone,
              clientName: client.full_name,
              workshopName: workshopName,
              vehicleBrand: finalBrand,
              vehicleModel: finalModel,
              vehiclePlate: plate.toUpperCase(),
              clientId: clientId,
              workshopId: workshopId,
              vehicleId: newVehicle.id,
              lastOilChange: lastOilChange || null // Pasar la fecha al bot
            })
          }).catch(err => console.error('Error enviando mensaje de vehículo:', err));
        }
      } else if (vehicle) {
        await updateVehicle(vehicle.id, { 
          brand: finalBrand, 
          model: finalModel, 
          year: year ? parseInt(year) : null, 
          color: color || null, 
          notes: notes || null,
          last_oil_change: lastOilChange || null
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      if (err.code === '23505') {
        setError(`La placa ${plate.toUpperCase()} ya está registrada en tu taller.`);
      } else {
        setError(err.message || 'Error al guardar el vehículo');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            {mode === 'add' ? 'Registrar Vehículo' : 'Editar Vehículo'}
          </h3>
          <button className={styles.closeBtn} onClick={onClose}><Icon name="close" /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            {error && <div className={styles.errorBox}>{error}</div>}

            {mode === 'add' && (
              <div className={styles.inputGroup}>
                <label className={styles.label}>Cliente Propietario *</label>
                <select
                  className={styles.input}
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  required
                >
                  <option value="">Seleccionar cliente...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className={styles.plateGroup}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Placa / Matrícula *</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    ref={plateInputRef}
                    type="text"
                    className={`${styles.input} ${styles.plateInput}`}
                    placeholder="ABC-123"
                    value={plate}
                    onChange={e => setPlate(e.target.value.toUpperCase())}
                    required
                    disabled={mode === 'edit'}
                    maxLength={10}
                    autoFocus
                  />
                  {mode === 'add' && (
                    <CameraScanner
                      onScanSuccess={(scanned) => setPlate(scanned)}
                      inputRef={plateInputRef}
                    />
                  )}
                </div>
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Año</label>
                <input
                  type="number"
                  className={styles.input}
                  placeholder="2022"
                  value={year}
                  onChange={e => setYear(e.target.value)}
                  min={1900}
                  max={new Date().getFullYear() + 1}
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.inputGroup} style={{ flex: 1 }}>
                <label className={styles.label}>Marca *</label>
                <select
                  className={styles.input}
                  value={selectedBrand}
                  onChange={(e) => {
                    setSelectedBrand(e.target.value);
                    if (e.target.value !== 'Otro') setCustomBrand('');
                    setSelectedModel(''); // Resetear modelo al cambiar marca
                    setCustomModel('');
                  }}
                  required
                >
                  <option value="">Selecciona la marca...</option>
                  {CAR_BRANDS.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                  <option value="Otro">Otra marca...</option>
                </select>
                {selectedBrand === 'Otro' && (
                  <input 
                    type="text" 
                    className={styles.input} 
                    placeholder="Escribe la marca..." 
                    value={customBrand}
                    onChange={e => setCustomBrand(e.target.value)} 
                    style={{ marginTop: '0.5rem' }}
                    required
                  />
                )}
              </div>
              <div className={styles.inputGroup} style={{ flex: 1 }}>
                <label className={styles.label}>Modelo *</label>
                <select
                  className={styles.input}
                  value={selectedModel}
                  onChange={(e) => {
                    setSelectedModel(e.target.value);
                    if (e.target.value !== 'Otro') setCustomModel('');
                  }}
                  disabled={!selectedBrand}
                  required
                >
                  <option value="">Selecciona el modelo...</option>
                  {(CAR_BRANDS_AND_MODELS[selectedBrand === 'Otro' ? 'Otro' : selectedBrand] || []).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  <option value="Otro">Otro modelo...</option>
                </select>
                {selectedModel === 'Otro' && (
                  <input 
                    type="text" 
                    className={styles.input} 
                    placeholder="Escribe el modelo..." 
                    value={customModel}
                    onChange={e => setCustomModel(e.target.value)} 
                    style={{ marginTop: '0.5rem' }}
                    required
                  />
                )}
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Año</label>
                <input
                  type="number"
                  className={styles.input}
                  placeholder="2022"
                  value={year}
                  onChange={e => setYear(e.target.value)}
                  min="1900"
                  max={new Date().getFullYear() + 1}
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Color</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Rojo, Blanco, Negro..."
                  value={color}
                  onChange={e => setColor(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Último Cambio de Aceite (Opcional)</label>
              <input
                type="date"
                className={styles.input}
                value={lastOilChange}
                onChange={e => setLastOilChange(e.target.value)}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Observaciones del Vehículo</label>
              <textarea
                className={`${styles.input} ${styles.textarea}`}
                placeholder="Estado general, detalles a tener en cuenta..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className={styles.primaryBtn} disabled={loading || (selectedBrand === 'Otro' && !customBrand) || (selectedModel === 'Otro' && !customModel) || !selectedBrand || !selectedModel || (mode === 'add' && (!plate || !clientId))}>
              <Icon name={mode === 'add' ? 'directions_car' : 'save'} style={{ fontSize: '1.125rem' }} />
              {loading ? 'Guardando...' : mode === 'add' ? 'Registrar Vehículo' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Delete Confirm ───────────────────────────────────────────────────────────
const DeleteConfirm = ({
  vehicle, onClose, onConfirm,
}: { vehicle: VehicleWithClient; onClose: () => void; onConfirm: () => Promise<void> }) => {
  const [loading, setLoading] = useState(false);
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Eliminar Vehículo</h3>
          <button className={styles.closeBtn} onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.deleteWarning}>
            <Icon name="warning" style={{ fontSize: '2.5rem', color: 'var(--color-error)' }} />
            <p>¿Eliminar el vehículo <strong>{vehicle.plate}</strong> — {vehicle.brand} {vehicle.model}?</p>
            <p className={styles.deleteSubtext}>Se eliminará también todo su historial de reparaciones.</p>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={loading}>Cancelar</button>
          <button className={styles.dangerBtn} onClick={async () => { setLoading(true); await onConfirm(); }} disabled={loading}>
            <Icon name="delete" style={{ fontSize: '1.125rem' }} />
            {loading ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
type UIMode = 'list' | 'detail';

export const VehicleList = () => {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [vehicles, setVehicles]         = useState<VehicleWithClient[]>([]);
  const [clients, setClients]           = useState<Client[]>([]);
  const [loading, setLoading]           = useState(true);
  const [searchTerm, setSearchTerm]     = useState('');
  const [uiMode, setUiMode]             = useState<UIMode>('list');
  const [selectedVehicle, setSelected]  = useState<VehicleWithClient | null>(null);
  const [showModal, setShowModal]       = useState<'add' | 'edit' | null>(null);
  const [showDelete, setShowDelete]     = useState(false);

  const [workshopName, setWorkshopName] = useState('nuestro taller');

  useEffect(() => {
    if (profile?.workshop_id) {
      fetchAll();
      // Cargar nombre del taller
      supabase.from('workshops').select('name').eq('id', profile.workshop_id).single()
        .then(({ data }) => { if (data?.name) setWorkshopName(data.name); });
    }
  }, [profile]);

  // Handle URL Selection
  useEffect(() => {
    const vehicleId = searchParams.get('id');
    if (vehicleId && profile?.workshop_id) {
      getVehicleById(vehicleId).then(v => {
        setSelected(v);
        setUiMode('detail');
        // Clear param after selecting to avoid re-triggering if not needed
        setSearchParams({}, { replace: true });
      }).catch(console.error);
    }
  }, [searchParams, profile]);

  const fetchAll = async () => {
    if (!profile?.workshop_id) return;
    setLoading(true);
    try {
      const [v, c] = await Promise.all([
        getVehicles(profile.workshop_id),
        getClients(profile.workshop_id),
      ]);
      setVehicles(v);
      setClients(c);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedVehicle) return;
    await deleteVehicle(selectedVehicle.id);
    setShowDelete(false);
    setSelected(null);
    setUiMode('list');
    await fetchAll();
  };

  const filtered = vehicles.filter(v =>
    v.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.clients?.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ─── Detail View
  if (uiMode === 'detail' && selectedVehicle) {
    return (
      <VehicleDetail
        vehicle={selectedVehicle}
        workshopId={profile?.workshop_id || ''}
        onBack={() => { setUiMode('list'); setSelected(null); }}
        onEdit={() => setShowModal('edit')}
        onDelete={() => setShowDelete(true)}
        onUpdated={fetchAll}
        renderEditModal={showModal === 'edit' && (
          <VehicleModal
            mode="edit"
            vehicle={selectedVehicle}
            workshopId={profile?.workshop_id || ''}
            workshopName={workshopName}
            clients={clients}
            onClose={() => setShowModal(null)}
            onSuccess={async () => { await fetchAll(); setShowModal(null); }}
          />
        )}
        renderDeleteModal={showDelete && (
          <DeleteConfirm
            vehicle={selectedVehicle}
            onClose={() => setShowDelete(false)}
            onConfirm={handleDelete}
          />
        )}
      />
    );
  }

  // ─── List View
  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Vehículos</h1>
          <p className={styles.pageSubtitle}>{vehicles.length} vehículos registrados</p>
        </div>
        <button className={styles.primaryBtn} onClick={() => setShowModal('add')}>
          <Icon name="add" style={{ fontSize: '1.125rem' }} />
          Registrar Vehículo
        </button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Icon name="search" className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Buscar por placa, marca, modelo o cliente..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className={styles.clearSearch} onClick={() => setSearchTerm('')}>
              <Icon name="close" style={{ fontSize: '1rem' }} />
            </button>
          )}
        </div>
        <span className={styles.resultCount}>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Placa</th>
              <th className={styles.th}>Vehículo</th>
              <th className={styles.th}>Año</th>
              <th className={styles.th}>Cliente</th>
              <th className={styles.th}>Últ. Aceite</th>
              <th className={styles.th}>Color</th>
              <th className={styles.th} style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td className={styles.td}><div className={styles.skeletonText} style={{ width: '70px' }} /></td>
                  <td className={styles.td}><div className={styles.skeletonText} style={{ width: '140px' }} /></td>
                  <td className={styles.td}><div className={styles.skeletonText} style={{ width: '40px' }} /></td>
                  <td className={styles.td}><div className={styles.skeletonText} style={{ width: '120px' }} /></td>
                  <td className={styles.td}><div className={styles.skeletonText} style={{ width: '60px' }} /></td>
                  <td className={styles.td} />
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className={styles.emptyState}>
                    <Icon name={searchTerm ? 'search_off' : 'directions_car'} style={{ fontSize: '3rem', opacity: 0.4 }} />
                    <p className={styles.emptyTitle}>
                      {searchTerm ? 'Sin resultados' : 'No hay vehículos registrados'}
                    </p>
                    <p className={styles.emptySubtitle}>
                      {searchTerm ? 'Intenta otra búsqueda' : 'Registra el primer vehículo de tu taller'}
                    </p>
                    {!searchTerm && (
                      <button className={styles.primaryBtn} style={{ marginTop: '1rem' }} onClick={() => setShowModal('add')}>
                        <Icon name="add" style={{ fontSize: '1rem' }} />
                        Registrar Vehículo
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map(v => (
                <tr
                  key={v.id}
                  className={styles.tr}
                  onClick={() => { setSelected(v); setUiMode('detail'); }}
                >
                  <td className={styles.td}>
                    <span className={styles.plateChip}>{v.plate}</span>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.vehicleName}>{v.brand} {v.model}</span>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.tdMuted}>{v.year ?? '—'}</span>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.clientCell}>
                      <Icon name="person" style={{ fontSize: '1rem', color: 'var(--color-outline)' }} />
                      <span className={styles.tdMuted}>{v.clients?.full_name ?? '—'}</span>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.tdMuted}>
                      {v.last_oil_change ? new Date(v.last_oil_change + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '—'}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.tdMuted}>{v.color ?? '—'}</span>
                  </td>
                  <td className={styles.td} onClick={e => e.stopPropagation()}>
                    <div className={styles.actions}>
                      <button className={styles.actionBtn} title="Ver detalle" onClick={() => { setSelected(v); setUiMode('detail'); }}>
                        <Icon name="visibility" style={{ fontSize: '1.125rem' }} />
                      </button>
                      <button className={styles.actionBtn} title="Editar" onClick={() => { setSelected(v); setShowModal('edit'); }}>
                        <Icon name="edit" style={{ fontSize: '1.125rem' }} />
                      </button>
                      <button className={`${styles.actionBtn} ${styles.dangerActionBtn}`} title="Eliminar" onClick={() => { setSelected(v); setShowDelete(true); }}>
                        <Icon name="delete" style={{ fontSize: '1.125rem' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && profile?.workshop_id && (
        <VehicleModal
          mode={showModal}
          vehicle={selectedVehicle}
          workshopId={profile.workshop_id}
          workshopName={workshopName}
          clients={clients}
          onClose={() => { setShowModal(null); setSelected(null); }}
          onSuccess={fetchAll}
        />
      )}
      {showDelete && selectedVehicle && (
        <DeleteConfirm
          vehicle={selectedVehicle}
          onClose={() => { setShowDelete(false); setSelected(null); }}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
};
