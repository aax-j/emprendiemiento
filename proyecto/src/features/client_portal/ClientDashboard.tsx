import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { getVehiclesByClient } from '../../lib/api/vehicles';
import { getClientConnectedWorkshops } from '../../lib/api/clients';
import { Icon } from '../../components/Icon/Icon';
import styles from './client_portal.module.css';

export const ClientDashboard = () => {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal de edición de perfil
  const { refreshProfile } = useAuth();
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    const load = async () => {
      try {
        const [v, w] = await Promise.all([
          getVehiclesByClient(profile.id),
          getClientConnectedWorkshops(profile.id),
        ]);
        setVehicles(v || []);
        setWorkshops(w || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [profile?.id]);

  const handleOpenEditProfile = () => {
    setEditName(profile?.full_name || '');
    setEditPhone(profile?.phone || '');
    setShowEditProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!profile?.id) return;
    setSavingProfile(true);
    try {
      await supabase.from('profiles').update({
        full_name: editName,
        phone: editPhone || null
      }).eq('id', profile.id);
      
      await refreshProfile();
      setShowEditProfile(false);
    } catch (e) {
      console.error(e);
      alert('Error al guardar el perfil');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* Hero con Tag */}
      <div className={styles.heroSection}>
        <div className={styles.heroText}>
          <p className={styles.heroGreeting}>Bienvenido,</p>
          <h1 className={styles.heroName}>
            {profile?.full_name ?? 'Cliente'}
            <button onClick={handleOpenEditProfile} style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', marginLeft: '0.5rem', verticalAlign: 'middle' }}>
              <Icon name="edit" style={{ fontSize: '1.25rem' }} />
            </button>
          </h1>
          <p className={styles.heroSub}>Portal de Gestión Automotriz Personal</p>
        </div>
        <div className={styles.tagHero}>
          <span className={styles.tagHeroLabel}>Tu ID de Cliente</span>
          <span className={styles.tagHeroValue}>{profile?.client_tag ?? '—'}</span>
          <span className={styles.tagHeroHint}>Comparte este código con cualquier taller para conectarte</span>
        </div>
      </div>

      {/* Sección Expandible Editar Perfil */}
      {showEditProfile && (
        <section className={styles.section} style={{ background: 'var(--color-surface-container)', padding: '1.5rem', borderRadius: '1rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className={styles.sectionTitle} style={{ margin: 0 }}>
              <Icon name="manage_accounts" /> Editar Mi Perfil
            </h2>
            <button onClick={() => setShowEditProfile(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-on-surface-variant)' }}>
              <Icon name="close" />
            </button>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Nombre Completo</label>
              <input 
                className={styles.input} 
                value={editName} 
                onChange={e => setEditName(e.target.value)} 
              />
            </div>
            
            <div className={styles.inputGroup}>
              <label className={styles.label}>Teléfono</label>
              <input 
                className={styles.input} 
                value={editPhone} 
                onChange={e => setEditPhone(e.target.value)} 
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button className={styles.primaryBtn} onClick={handleSaveProfile} disabled={savingProfile || !editName}>
              {savingProfile ? 'Guardando…' : 'Guardar Cambios'}
            </button>
            <button className={styles.secondaryBtn} onClick={() => setShowEditProfile(false)}>Cancelar</button>
          </div>
        </section>
      )}

      {/* KPIs */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIconBox} style={{ background: 'rgba(0,73,125,0.1)', color: 'var(--color-primary)' }}>
            <Icon name="directions_car" />
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{loading ? '…' : vehicles.length}</span>
            <span className={styles.kpiLabel}>Vehículos Registrados</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconBox} style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
            <Icon name="handshake" />
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{loading ? '…' : workshops.length}</span>
            <span className={styles.kpiLabel}>Talleres Conectados</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconBox} style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>
            <Icon name="verified_user" />
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>Activo</span>
            <span className={styles.kpiLabel}>Estado de Cuenta</span>
          </div>
        </div>
      </div>

      {/* Mis vehículos (preview) */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <Icon name="directions_car" /> Mis Vehículos
        </h2>
        {loading ? (
          <p className={styles.emptyText}>Cargando...</p>
        ) : vehicles.length === 0 ? (
          <div className={styles.emptyCard}>
            <Icon name="directions_car" style={{ fontSize: '2.5rem', opacity: 0.3 }} />
            <p>Aún no tienes vehículos registrados.<br />Un taller conectado podrá agregarlos por ti.</p>
          </div>
        ) : (
          <div className={styles.vehicleGrid}>
            {vehicles.slice(0, 4).map(v => (
              <div key={v.id} className={styles.vehicleCard}>
                <div className={styles.vehiclePlate}>{v.plate}</div>
                <div className={styles.vehicleInfo}>
                  <span className={styles.vehicleName}>{v.brand} {v.model}</span>
                  <span className={styles.vehicleYear}>{v.year ?? '—'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Talleres conectados (preview) */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <Icon name="storefront" /> Talleres Conectados
        </h2>
        {!loading && workshops.length === 0 ? (
          <div className={styles.emptyCard}>
            <Icon name="storefront" style={{ fontSize: '2.5rem', opacity: 0.3 }} />
            <p>Aún no estás conectado a ningún taller.<br />Explora el directorio para encontrar talleres cercanos.</p>
          </div>
        ) : (
          <div className={styles.workshopList}>
            {workshops.slice(0, 3).map((conn: any) => (
              <div key={conn.id} className={styles.workshopRow}>
                <div className={styles.workshopAvatar}>
                  {conn.workshop?.name?.charAt(0) ?? 'T'}
                </div>
                <div className={styles.workshopMeta}>
                  <span className={styles.workshopName}>{conn.workshop?.name ?? 'Taller'}</span>
                  <span className={styles.workshopBadge}>Smart Sync Activo</span>
                </div>
                <Icon name="check_circle" style={{ color: '#10b981', fontSize: '1.25rem' }} />
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
};
