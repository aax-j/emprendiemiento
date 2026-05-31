import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getVehiclesByClient, createVehicle, updateVehicle } from '../../lib/api/vehicles';
import { getRepairHistory } from '../../lib/api/repairs';
import { submitReview } from '../../lib/api/workshop_profiles';
import { Icon } from '../../components/Icon/Icon';
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
}

export const VehicleTelemetry = () => {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [history, setHistory] = useState<RepairWithReviewable[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Review modal state
  const [reviewTarget, setReviewTarget] = useState<RepairWithReviewable | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Vehicle modal state
  const [showVehicleModal, setShowVehicleModal] = useState<'add' | 'edit' | null>(null);
  const [vPlate, setVPlate] = useState('');
  const [vBrand, setVBrand] = useState('');
  const [vModel, setVModel] = useState('');
  const [vYear, setVYear] = useState('');
  const [vColor, setVColor] = useState('');
  const [savingVehicle, setSavingVehicle] = useState(false);

  const loadVehicles = () => {
    if (!profile?.id) return;
    getVehiclesByClient(profile.id).then(setVehicles).catch(console.error);
  };

  useEffect(() => {
    loadVehicles();
  }, [profile?.id]);

  const loadHistory = async (vehicleId: string) => {
    setLoadingHistory(true);
    setHistory([]);
    try {
      const data = await getRepairHistory(vehicleId);
      setHistory(data as any);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSelectVehicle = (v: any) => {
    setSelectedVehicle(v);
    loadHistory(v.id);
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
      if (selectedVehicle) loadHistory(selectedVehicle.id);
    } catch (e: any) {
      alert('Error al enviar la reseña: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditVehicle = (v: any) => {
    setVPlate(v.plate);
    setVBrand(v.brand);
    setVModel(v.model);
    setVYear(v.year?.toString() || '');
    setVColor(v.color || '');
    setSelectedVehicle(v);
    setShowVehicleModal('edit');
  };

  const handleOpenAddVehicle = () => {
    setVPlate('');
    setVBrand('');
    setVModel('');
    setVYear('');
    setVColor('');
    setSelectedVehicle(null);
    setShowVehicleModal('add');
  };

  const handleSaveVehicle = async () => {
    if (!profile?.id || !profile?.workshop_id) return;
    setSavingVehicle(true);
    try {
      const payload = {
        plate: vPlate.toUpperCase().trim(),
        brand: vBrand,
        model: vModel,
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
              <p>Cargando historial…</p>
            ) : history.length === 0 ? (
              <div className={styles.emptyCard}>
                <p>No hay órdenes de trabajo registradas para este vehículo.</p>
              </div>
            ) : (
              <div className={styles.historyList}>
                <h3 className={styles.sectionTitle}>
                  Historial · <span style={{ color: 'var(--color-primary)' }}>{selectedVehicle.plate}</span>
                </h3>
                {history.map(h => (
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
              <input 
                className={styles.input} 
                placeholder="ABC-123" 
                value={vPlate} 
                onChange={e => setVPlate(e.target.value)} 
                disabled={showVehicleModal === 'edit'}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Marca</label>
                <input className={styles.input} placeholder="Toyota" value={vBrand} onChange={e => setVBrand(e.target.value)} />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Modelo</label>
                <input className={styles.input} placeholder="Corolla" value={vModel} onChange={e => setVModel(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Año</label>
                <input type="number" className={styles.input} placeholder="2022" value={vYear} onChange={e => setVYear(e.target.value)} />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Color</label>
                <input className={styles.input} placeholder="Blanco" value={vColor} onChange={e => setVColor(e.target.value)} />
              </div>
            </div>

            <div className={styles.modalActions} style={{ marginTop: '1.5rem' }}>
              <button className={styles.secondaryBtn} onClick={() => setShowVehicleModal(null)}>Cancelar</button>
              <button className={styles.primaryBtn} onClick={handleSaveVehicle} disabled={savingVehicle || !vPlate || !vBrand || !vModel}>
                {savingVehicle ? 'Guardando…' : 'Guardar Vehículo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
