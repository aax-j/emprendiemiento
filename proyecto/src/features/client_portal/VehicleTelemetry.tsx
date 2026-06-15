import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getVehiclesByClient, createVehicle, updateVehicle } from '../../lib/api/vehicles';
import { getRepairHistory } from '../../lib/api/repairs';
import { submitReview } from '../../lib/api/workshop_profiles';
import { supabase } from '../../lib/supabase';
import { Icon } from '../../components/Icon/Icon';
import CameraScanner from '../vehicles/VehicleRegistration/CameraScanner';
import { CAR_BRANDS, CAR_BRANDS_AND_MODELS } from '../vehicles/VehicleRegistration/carData';
import styles from './client_portal.module.css';

interface RepairWithReviewable {
  id: string;
  description: string;
  status: string;
  cost: number | null;
  start_date: string | null;
  completed_at: string | null;
  created_at: string;
  workshop_id: string;
  can_review?: boolean;
  workshop?: { name: string };
}

export const VehicleTelemetry = () => {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [history, setHistory] = useState<RepairWithReviewable[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'maintenance'>('history');

  // Maintenance state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [maintConfig, setMaintConfig] = useState({ type: 'Cambio de Aceite', months: 6, km: 5000 });
  const [maintRecord, setMaintRecord] = useState({ type: 'Cambio de Aceite', km: '', notes: '' });
  const [savingMaint, setSavingMaint] = useState(false);

  // Review modal state
  const [reviewTarget, setReviewTarget] = useState<RepairWithReviewable | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Vehicle modal state
  const [showVehicleModal, setShowVehicleModal] = useState<'add' | 'edit' | null>(null);
  const [vPlate, setVPlate] = useState('');
  
  const [selectedBrand, setSelectedBrand] = useState('');
  const [customBrand, setCustomBrand] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [customModel, setCustomModel] = useState('');
  
  const [vYear, setVYear] = useState('');
  const [vColor, setVColor] = useState('');
  const [savingVehicle, setSavingVehicle] = useState(false);
  const plateInputRef = useRef<HTMLInputElement>(null);

  const loadVehicles = () => {
    if (!profile?.id) return;
    getVehiclesByClient(profile.id).then(setVehicles).catch(console.error);
  };

  useEffect(() => {
    loadVehicles();
  }, [profile?.id]);

  const loadHistory = async (vehicleId: string, plate?: string) => {
    setLoadingHistory(true);
    setHistory([]);
    try {
      const data = await getRepairHistory(vehicleId, plate);
      setHistory(data as any);
      
      // Load notifications for this vehicle
      const { data: notifs } = await supabase
        .from('notificaciones')
        .select('*')
        .eq('id_vehiculo', vehicleId)
        .eq('leido', false);
      if (notifs) setNotifications(notifs);

    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSaveMaintConfig = async () => {
    if (!profile?.id || !selectedVehicle) return;
    setSavingMaint(true);
    try {
      const payload = {
        id_usuario: profile.id,
        id_vehiculo: selectedVehicle.id,
        tipo_mantenimiento: maintConfig.type,
        meses_intervalo: maintConfig.months,
        km_intervalo: maintConfig.km
      };
      await fetch('http://localhost:5000/api/maintenance/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      alert('Configuración guardada exitosamente');
    } catch (e: any) {
      alert('Error guardando configuración');
    } finally {
      setSavingMaint(false);
    }
  };

  const handleSaveMaintRecord = async () => {
    if (!profile?.id || !selectedVehicle || !maintRecord.km) return;
    setSavingMaint(true);
    try {
      const payload = {
        id_usuario: profile.id,
        id_vehiculo: selectedVehicle.id,
        tipo_mantenimiento: maintRecord.type,
        kilometraje: parseInt(maintRecord.km),
        notas: maintRecord.notes
      };
      await fetch('http://localhost:5000/api/maintenance/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      alert('Registro guardado exitosamente');
      setMaintRecord({ ...maintRecord, km: '', notes: '' });
    } catch (e: any) {
      alert('Error guardando registro');
    } finally {
      setSavingMaint(false);
    }
  };

  const markNotificationRead = async (id: string) => {
    await supabase.from('notificaciones').update({ leido: true }).eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleSelectVehicle = (v: any) => {
    setSelectedVehicle(v);
    loadHistory(v.id, v.plate);
  };

  const handleSubmitReview = async () => {
    if (!reviewTarget || !profile?.id) return;
    setSubmitting(true);
    try {
      await submitReview({
        workshop_id: reviewTarget.workshop_id,
        client_id: profile.id,
        repair_id: reviewTarget.id,
        rating,
        comment: comment.trim() || null,
      });
      setReviewTarget(null);
      setRating(5);
      setComment('');
      // Recargar historial para marcar la reseña emitida
      if (selectedVehicle) loadHistory(selectedVehicle.id, selectedVehicle.plate);
    } catch (e: any) {
      alert('Error al enviar la reseña: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditVehicle = (v: any) => {
    setVPlate(v.plate);
    
    const initialBrandIsCustom = v.brand && !CAR_BRANDS.includes(v.brand);
    setSelectedBrand(initialBrandIsCustom ? 'Otro' : (v.brand || ''));
    setCustomBrand(initialBrandIsCustom ? v.brand : '');

    const initialModelList = CAR_BRANDS_AND_MODELS[initialBrandIsCustom ? 'Otro' : v.brand] || [];
    const initialModelIsCustom = v.model && !initialModelList.includes(v.model);
    setSelectedModel(initialModelIsCustom ? 'Otro' : (v.model || ''));
    setCustomModel(initialModelIsCustom ? v.model : '');

    setVYear(v.year?.toString() || '');
    setVColor(v.color || '');
    setSelectedVehicle(v);
    setShowVehicleModal('edit');
  };

  const handleOpenAddVehicle = () => {
    setVPlate('');
    setSelectedBrand('');
    setCustomBrand('');
    setSelectedModel('');
    setCustomModel('');
    setVYear('');
    setVColor('');
    setSelectedVehicle(null);
    setShowVehicleModal('add');
  };

  const handleSaveVehicle = async () => {
    if (!profile?.id || !profile?.workshop_id) return;
    setSavingVehicle(true);
    try {
      const finalBrand = selectedBrand === 'Otro' ? customBrand : selectedBrand;
      const finalModel = selectedModel === 'Otro' ? customModel : selectedModel;

      const payload = {
        plate: vPlate.toUpperCase().trim(),
        brand: finalBrand,
        model: finalModel,
        year: vYear ? parseInt(vYear) : null,
        color: vColor || null,
        notes: selectedVehicle?.notes || null,
        last_oil_change: selectedVehicle?.last_oil_change || null,
        client_id: profile.id,
      };

      if (showVehicleModal === 'add') {
        const newV = await createVehicle(payload, profile.workshop_id);
        setSelectedVehicle(newV);
      } else if (selectedVehicle) {
        await updateVehicle(selectedVehicle.id, {
          brand: payload.brand,
          model: payload.model,
          year: payload.year,
          color: payload.color,
        });
      }
      setShowVehicleModal(null);
      loadVehicles();
    } catch (e: any) {
      alert('Error al guardar vehículo: ' + e.message);
    } finally {
      setSavingVehicle(false);
    }
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      open: 'Abierta', in_progress: 'En Proceso', completed: 'Completada',
      completado: 'Completada', en_proceso: 'En Proceso', pendiente: 'Pendiente', cancelado: 'Cancelada'
    };
    return map[s] ?? s;
  };

  const statusColor = (s: string) => {
    if (s.includes('complet')) return '#10b981';
    if (s.includes('proceso') || s === 'in_progress') return '#f59e0b';
    if (s.includes('cancel')) return '#ef4444';
    return 'var(--color-outline)';
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Mis Vehículos</h1>
          <p className={styles.pageSub}>Historial clínico e historial de reparaciones de cada auto</p>
        </div>
        <button className={styles.primaryBtn} onClick={handleOpenAddVehicle}>
          <Icon name="add" /> Agregar Vehículo
        </button>
      </div>

      {vehicles.length === 0 ? (
        <div className={styles.emptyCard}>
          <Icon name="directions_car" style={{ fontSize: '3rem', opacity: 0.3 }} />
          <p>Aún no tienes vehículos registrados en tu cuenta.</p>
        </div>
      ) : (
        <div className={styles.telemetryLayout}>
          {/* Lista de vehículos */}
          <div className={styles.vehicleSidebar}>
            <h3 className={styles.sidebarTitle}>Selecciona un Vehículo</h3>
            {vehicles.map(v => (
              <div
                key={v.id}
                className={`${styles.vehicleSelectCard} ${selectedVehicle?.id === v.id ? styles.vehicleSelectActive : ''}`}
                onClick={() => handleSelectVehicle(v)}
              >
                <div className={styles.vehiclePlate}>{v.plate}</div>
                <div>
                  <div className={styles.vehicleName}>{v.brand} {v.model}</div>
                  <div className={styles.vehicleYear}>{v.year ?? '—'} · {v.color ?? ''}</div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleOpenEditVehicle(v); }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-outline)', cursor: 'pointer', padding: '0.25rem' }}
                >
                  <Icon name="edit" style={{ fontSize: '1.25rem' }} />
                </button>
              </div>
            ))}
          </div>

          {/* Historial */}
          <div className={styles.historyPanel}>
            {!selectedVehicle ? (
              <div className={styles.emptyCard} style={{ height: '100%' }}>
                <Icon name="touch_app" style={{ fontSize: '2.5rem', opacity: 0.3 }} />
                <p>Selecciona un vehículo para ver su historial</p>
              </div>
            ) : loadingHistory ? (
              <p>Cargando información…</p>
            ) : (
              <div className={styles.historyList}>
                <h3 className={styles.sectionTitle} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <span style={{ color: 'var(--color-primary)' }}>{selectedVehicle.plate}</span>
                  <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', marginLeft: 'auto' }}>
                    <button 
                      onClick={() => setActiveTab('history')}
                      style={{ padding: '6px 12px', border: 'none', background: activeTab === 'history' ? 'var(--primary-color)' : 'transparent', color: activeTab === 'history' ? 'white' : 'inherit', cursor: 'pointer' }}
                    >Historial</button>
                    <button 
                      onClick={() => setActiveTab('maintenance')}
                      style={{ padding: '6px 12px', border: 'none', background: activeTab === 'maintenance' ? 'var(--primary-color)' : 'transparent', color: activeTab === 'maintenance' ? 'white' : 'inherit', cursor: 'pointer' }}
                    >Mantenimiento Preventivo</button>
                  </div>
                </h3>
                
                {/* Panel de Alertas Críticas */}
                {notifications.length > 0 && (
                  <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {notifications.map(n => (
                      <div key={n.id} style={{ padding: '1rem', background: '#fee2e2', borderLeft: '4px solid #ef4444', borderRadius: '4px', color: '#991b1b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>⚠️ ALERTA: </strong> {n.mensaje}
                        </div>
                        <button onClick={() => markNotificationRead(n.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#991b1b' }}>
                          <Icon name="check_circle" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'history' && (
                  <>
                  {history.length === 0 ? (
                    <div className={styles.emptyCard}><p>No hay órdenes de trabajo registradas.</p></div>
                  ) : history.map(h => (
                    <div key={h.id} className={styles.historyCard}>
                    <div className={styles.historyCardTop}>
                      <div>
                        <span
                          className={styles.historyStatus}
                          style={{ background: statusColor(h.status) + '20', color: statusColor(h.status) }}
                        >
                          {statusLabel(h.status)}
                        </span>
                        <span className={styles.historyDate}>
                          {h.start_date
                            ? new Date(h.start_date).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })
                            : new Date(h.created_at).toLocaleDateString('es-EC')}
                        </span>
                      </div>
                      {h.cost != null && (
                        <span className={styles.historyCost}>${Number(h.cost).toFixed(2)}</span>
                      )}
                    </div>
                    <p className={styles.historyDescription}>{h.description}</p>
                    {(h as any).workshops?.name && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--color-outline)', margin: '0.5rem 0 0 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Icon name="storefront" style={{ fontSize: '0.9rem' }} />
                        Realizado en: {(h as any).workshops.name}
                      </p>
                    )}
                    {(h.status === 'completado' || h.status === 'completed') && (
                      <button
                        className={styles.reviewBtn}
                        onClick={() => setReviewTarget(h)}
                      >
                        <Icon name="star" /> Calificar Taller
                      </button>
                    )}
                  </div>
                ))}
                  </>
                )}

                {activeTab === 'maintenance' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className={styles.historyCard}>
                      <h4>Configurar Alertas (Intervalos)</h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Recibe notificaciones automáticas cuando se venza el plazo.</p>
                      <div className={styles.inputGroup}>
                        <label className={styles.label}>Tipo de Servicio</label>
                        <select className={styles.input} value={maintConfig.type} onChange={e => setMaintConfig({...maintConfig, type: e.target.value})}>
                          <option>Cambio de Aceite</option>
                          <option>Revisión Técnica / Matrícula</option>
                          <option>Líquido de Frenos</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <div className={styles.inputGroup} style={{ flex: 1 }}>
                          <label className={styles.label}>Avisar cada (Meses)</label>
                          <input type="number" className={styles.input} value={maintConfig.months} onChange={e => setMaintConfig({...maintConfig, months: parseInt(e.target.value)})} />
                        </div>
                        <div className={styles.inputGroup} style={{ flex: 1 }}>
                          <label className={styles.label}>O cada (Km)</label>
                          <input type="number" className={styles.input} value={maintConfig.km} onChange={e => setMaintConfig({...maintConfig, km: parseInt(e.target.value)})} />
                        </div>
                      </div>
                      <button className={styles.primaryBtn} style={{ marginTop: '1rem', width: '100%' }} onClick={handleSaveMaintConfig} disabled={savingMaint}>
                        Guardar Alerta
                      </button>
                    </div>

                    <div className={styles.historyCard}>
                      <h4>Registrar Servicio Realizado</h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Guarda el último kilometraje para reiniciar el cronómetro.</p>
                      <div className={styles.inputGroup}>
                        <label className={styles.label}>Tipo de Servicio</label>
                        <select className={styles.input} value={maintRecord.type} onChange={e => setMaintRecord({...maintRecord, type: e.target.value})}>
                          <option>Cambio de Aceite</option>
                          <option>Revisión Técnica / Matrícula</option>
                          <option>Líquido de Frenos</option>
                        </select>
                      </div>
                      <div className={styles.inputGroup} style={{ marginTop: '1rem' }}>
                        <label className={styles.label}>Kilometraje Actual</label>
                        <input type="number" className={styles.input} value={maintRecord.km} onChange={e => setMaintRecord({...maintRecord, km: e.target.value})} placeholder="Ej. 120500" />
                      </div>
                      <button className={styles.primaryBtn} style={{ marginTop: '1rem', width: '100%', background: '#10b981' }} onClick={handleSaveMaintRecord} disabled={savingMaint}>
                        Registrar Mantenimiento
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de reseña */}
      {reviewTarget && (
        <div className="mobile-modal-overlay" onClick={() => setReviewTarget(null)}>
          <div className={styles.reviewModal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Calificar Servicio</h2>
            <p className={styles.modalSub}>"{reviewTarget.description.slice(0, 80)}…"</p>

            <div className={styles.starSelector}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} className={styles.starBtn} onClick={() => setRating(n)}>
                  <Icon
                    name={n <= rating ? 'star' : 'star_border'}
                    style={{ fontSize: '2rem', color: n <= rating ? '#f59e0b' : 'var(--color-outline)', transition: 'color 0.15s' }}
                  />
                </button>
              ))}
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Comentario (opcional)</label>
              <textarea
                className={styles.textarea}
                rows={3}
                placeholder="Cuéntanos sobre tu experiencia…"
                value={comment}
                onChange={e => setComment(e.target.value)}
              />
            </div>

            <div className={styles.modalActions}>
              <button className={styles.secondaryBtn} onClick={() => setReviewTarget(null)}>Cancelar</button>
              <button className={styles.primaryBtn} onClick={handleSubmitReview} disabled={submitting}>
                {submitting ? 'Enviando…' : 'Enviar Reseña'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Agregar/Editar Vehículo */}
      {showVehicleModal && (
        <div className="mobile-modal-overlay" onClick={() => setShowVehicleModal(null)}>
          <div className={styles.reviewModal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>{showVehicleModal === 'add' ? 'Registrar Vehículo' : 'Editar Vehículo'}</h2>
            
            <div className={styles.inputGroup} style={{ marginTop: '1rem' }}>
              <label className={styles.label}>Placa / Matrícula</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  ref={plateInputRef}
                  className={styles.input}
                  placeholder="ABC-123"
                  value={vPlate}
                  onChange={e => setVPlate(e.target.value.toUpperCase())}
                  disabled={showVehicleModal === 'edit'}
                  style={{ flex: 1 }}
                />
                {showVehicleModal === 'add' && /android|iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase()) && (
                  <CameraScanner
                    onScanSuccess={(scanned) => setVPlate(scanned)}
                    inputRef={plateInputRef}
                  />
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
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
                  disabled={showVehicleModal === 'edit'}
                >
                  <option value="">Selecciona la marca...</option>
                  {CAR_BRANDS.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
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
                  disabled={!selectedBrand || showVehicleModal === 'edit'}
                >
                  <option value="">Selecciona el modelo...</option>
                  {(CAR_BRANDS_AND_MODELS[selectedBrand === 'Otro' ? 'Otro' : selectedBrand] || []).map(model => (
                    <option key={model} value={model}>{model}</option>
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
                  />
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Año</label>
                <input type="number" className={styles.input} placeholder="2022" value={vYear} min="1900" max={new Date().getFullYear() + 1} onChange={e => setVYear(e.target.value)} />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Color</label>
                <input className={styles.input} placeholder="Blanco" value={vColor} onChange={e => setVColor(e.target.value)} />
              </div>
            </div>

            <div className={styles.modalActions} style={{ marginTop: '1.5rem' }}>
              <button className={styles.secondaryBtn} onClick={() => setShowVehicleModal(null)}>Cancelar</button>
              <button className={styles.primaryBtn} onClick={handleSaveVehicle} disabled={savingVehicle || !vPlate || !selectedBrand || !selectedModel || (selectedBrand === 'Otro' && !customBrand) || (selectedModel === 'Otro' && !customModel)}>
                {savingVehicle ? 'Guardando…' : 'Guardar Vehículo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
