import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { getWorkshopPublicProfile, getWorkshopReviews, submitReview } from '../../lib/api/workshop_profiles';
import {
  sendConnectionInvite,
  getClientConnectedWorkshops,
} from '../../lib/api/clients';
import { Icon } from '../../components/Icon/Icon';
import styles from './client_portal.module.css';

export const WorkshopDetails = () => {
  const { workshopId } = useParams<{ workshopId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [workshop, setWorkshop] = useState<any | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending' | 'connected'>('none');
  const [sendingInvite, setSendingInvite] = useState(false);

  // Review state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (!workshopId || !profile?.id) return;
    const load = async () => {
      try {
        const [wp, rev, connected] = await Promise.all([
          getWorkshopPublicProfile(workshopId),
          getWorkshopReviews(workshopId),
          getClientConnectedWorkshops(profile.id),
        ]);
        setWorkshop(wp);
        setReviews(rev);

        const isConnected = connected.some((c: any) => c.workshop_id === workshopId);
        if (isConnected) {
          setConnectionStatus('connected');
        } else {
          // Check for any pending invite in either direction
          const { data: pendingRows } = await supabase
            .from('workshop_clients')
            .select('id, status')
            .eq('workshop_id', workshopId)
            .eq('client_id', profile.id)
            .in('status', ['pending_client_approval', 'pending_workshop_approval']);

          if (pendingRows && pendingRows.length > 0) {
            setConnectionStatus('pending');
          } else {
            setConnectionStatus('none');
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [workshopId, profile?.id]);

  const handleConnect = async () => {
    if (!workshopId || !profile?.id) return;
    setSendingInvite(true);
    try {
      await sendConnectionInvite(workshopId, profile.id, 'client');
      setConnectionStatus('pending');
    } catch (e: any) {
      alert('Error al enviar solicitud: ' + e.message);
    } finally {
      setSendingInvite(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!workshopId || !profile?.id) return;
    setSubmittingReview(true);
    try {
      await submitReview({
        workshop_id: workshopId,
        client_id: profile.id,
        rating,
        comment: comment.trim() || null,
        // repair_id is omitted; it will auto-generate in the API to bypass NOT NULL
      } as any);
      
      setShowReviewModal(false);
      setRating(5);
      setComment('');
      
      // Reload reviews and workshop profile
      const [wp, rev] = await Promise.all([
        getWorkshopPublicProfile(workshopId),
        getWorkshopReviews(workshopId),
      ]);
      setWorkshop(wp);
      setReviews(rev);
    } catch (e: any) {
      alert('Error al enviar la reseña: ' + e.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  const renderStars = (rating: number) =>
    Array.from({ length: 5 }, (_, i) => (
      <Icon key={i} name={i < Math.round(rating) ? 'star' : 'star_border'}
        style={{ fontSize: '1rem', color: '#f59e0b' }} />
    ));

  if (loading) return <div className={styles.page}><p>Cargando perfil del taller…</p></div>;
  if (!workshop) return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate(-1)}>
        <Icon name="arrow_back" /> Volver
      </button>
      <p>Taller no encontrado.</p>
    </div>
  );

  return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate(-1)}>
        <Icon name="arrow_back" /> Volver al Directorio
      </button>

      {/* Header del taller */}
      <div className={styles.detailHero}>
        <div className={styles.detailAvatarLg}>
          {workshop.logo_url
            ? <img src={workshop.logo_url} alt={workshop.name} className={styles.workshopLogoImg} />
            : <span>{workshop.name?.charAt(0)}</span>
          }
        </div>
        <div className={styles.detailHeroInfo}>
          <h1 className={styles.pageTitle}>{workshop.name}</h1>
          <div className={styles.ratingRow} style={{ marginTop: '0.25rem' }}>
            {renderStars(workshop.average_rating ?? 0)}
            <span className={styles.ratingCount}>{workshop.average_rating?.toFixed(1)} ({workshop.ratings_count} reseñas)</span>
          </div>
          {workshop.address && (
            <p className={styles.detailAddress}>
              <Icon name="location_on" style={{ fontSize: '1rem' }} /> {workshop.address}
            </p>
          )}
          {workshop.description && <p className={styles.detailDescription}>{workshop.description}</p>}
        </div>

        {/* Botón de conexión */}
        <div className={styles.connectionActions}>
          {connectionStatus === 'connected' && (
            <div className={styles.connectedBadge}>
              <Icon name="check_circle" /> Conectado
            </div>
          )}
          {connectionStatus === 'pending' && (
            <div className={styles.pendingBadge}>
              <Icon name="schedule" /> Solicitud Enviada
            </div>
          )}
          {connectionStatus === 'none' && (
            <button className={styles.primaryBtn} onClick={handleConnect} disabled={sendingInvite}>
              <Icon name="person_add" />
              {sendingInvite ? 'Enviando…' : 'Conectarme con este Taller'}
            </button>
          )}
        </div>
      </div>

      {/* Servicios */}
      {workshop.services_catalogue?.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}><Icon name="build" /> Servicios Ofertados</h2>
          <div className={styles.servicesGrid}>
            {workshop.services_catalogue.map((s: any, i: number) => (
              <div key={i} className={styles.serviceCard}>
                <span className={styles.serviceCardName}>{s.name}</span>
                {s.price > 0 && <span className={styles.serviceCardPrice}>${s.price}</span>}
                {s.description && <span className={styles.serviceCardDesc}>{s.description}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Promociones */}
      {workshop.promotions?.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}><Icon name="local_offer" /> Promociones Activas</h2>
          <div className={styles.promoList}>
            {workshop.promotions.map((p: any, i: number) => (
              <div key={i} className={styles.promoCard}>
                <div className={styles.promoCardLeft}>
                  <span className={styles.promoTitle}>{p.title}</span>
                  <span className={styles.promoDesc}>{p.description}</span>
                </div>
                {p.discount && <span className={styles.discountBadge}>{p.discount}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Reseñas */}
      <section className={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}><Icon name="reviews" /> Reseñas de Clientes</h2>
          <button className={styles.secondaryBtn} onClick={() => setShowReviewModal(true)}>
            <Icon name="edit_note" /> Escribir Reseña
          </button>
        </div>
        {reviews.length === 0 ? (
          <div className={styles.emptyCard}>
            <p>Aún no hay reseñas para este taller.</p>
          </div>
        ) : (
          <div className={styles.reviewList}>
            {reviews.map(r => (
              <div key={r.id} className={styles.reviewCard}>
                <div className={styles.reviewHeader}>
                  <div className={styles.reviewAvatar}>
                    {r.client?.full_name?.charAt(0) ?? 'C'}
                  </div>
                  <div>
                    <span className={styles.reviewName}>{r.client?.full_name ?? 'Cliente'}</span>
                    <div className={styles.ratingRow}>{renderStars(r.rating)}</div>
                  </div>
                  <span className={styles.reviewDate}>
                    {new Date(r.created_at).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                {r.comment && <p className={styles.reviewComment}>{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal de reseña */}
      {showReviewModal && (
        <div className="mobile-modal-overlay" onClick={() => setShowReviewModal(false)}>
          <div className={styles.reviewModal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Calificar Taller</h2>
            <p className={styles.modalSub}>Comparte tu experiencia con {workshop.name}</p>

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
                rows={4}
                placeholder="¿Cómo fue la atención, calidad del trabajo y los tiempos de entrega?"
                value={comment}
                onChange={e => setComment(e.target.value)}
              />
            </div>

            <div className={styles.modalActions}>
              <button className={styles.secondaryBtn} onClick={() => setShowReviewModal(false)}>Cancelar</button>
              <button className={styles.primaryBtn} onClick={handleSubmitReview} disabled={submittingReview}>
                {submittingReview ? 'Enviando…' : 'Enviar Reseña'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
