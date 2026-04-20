import { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { Icon } from '../../../components/Icon/Icon';
import styles from './Settings.module.css';

export const Settings = () => {
  const { profile, user, refreshProfile } = useAuth();

  // Profile form
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Workshop name (fetched separately)
  const [workshopName, setWorkshopName] = useState('');
  const [workshopLoaded, setWorkshopLoaded] = useState(false);
  const [savingWorkshop, setSavingWorkshop] = useState(false);
  const [workshopSuccess, setWorkshopSuccess] = useState(false);
  const [workshopError, setWorkshopError] = useState<string | null>(null);

  // Load workshop name lazily on first render
  useState(() => {
    if (!profile?.workshop_id) return;
    supabase
      .from('workshops')
      .select('name')
      .eq('id', profile.workshop_id)
      .single()
      .then(({ data }) => {
        if (data) {
          setWorkshopName(data.name);
          setWorkshopLoaded(true);
        }
      });
  });

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(false);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      setProfileError(err.message || 'Error al guardar');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveWorkshop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.workshop_id) return;
    setSavingWorkshop(true);
    setWorkshopError(null);
    setWorkshopSuccess(false);
    try {
      const { error } = await supabase
        .from('workshops')
        .update({ name: workshopName })
        .eq('id', profile.workshop_id);
      if (error) throw error;
      setWorkshopSuccess(true);
      setTimeout(() => setWorkshopSuccess(false), 3000);
    } catch (err: any) {
      setWorkshopError(err.message || 'Error al guardar');
    } finally {
      setSavingWorkshop(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Cuenta y Configuración</h1>
        <p className={styles.subtitle}>Gestiona tu información personal y los datos del taller</p>
      </div>

      {/* Account Info */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardIconBox}>
            <Icon name="manage_accounts" />
          </div>
          <div>
            <h2 className={styles.cardTitle}>Perfil de Usuario</h2>
            <p className={styles.cardDesc}>Tu información personal en la plataforma</p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className={styles.form}>
          <div className={styles.row}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Nombre Completo</label>
              <input
                type="text"
                className={styles.input}
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Tu nombre completo"
                required
              />
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Correo Electrónico</label>
              <input
                type="email"
                className={`${styles.input} ${styles.readOnly}`}
                value={user?.email ?? ''}
                readOnly
                title="El correo no se puede modificar desde aquí"
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Rol</label>
              <div className={styles.roleChip}>
                <Icon name={profile?.role === 'admin' ? 'admin_panel_settings' : 'engineering'} style={{ fontSize: '1rem' }} />
                {profile?.role === 'admin' ? 'Administrador' : 'Mecánico'}
              </div>
            </div>
          </div>

          {profileError && <div className={styles.errorBox}>{profileError}</div>}
          {profileSuccess && (
            <div className={styles.successBox}>
              <Icon name="check_circle" style={{ fontSize: '1rem' }} />
              Perfil actualizado correctamente
            </div>
          )}

          <div className={styles.formFooter}>
            <button type="submit" className={styles.primaryBtn} disabled={savingProfile || !fullName}>
              <Icon name="save" style={{ fontSize: '1.125rem' }} />
              {savingProfile ? 'Guardando...' : 'Guardar Perfil'}
            </button>
          </div>
        </form>
      </div>

      {/* Workshop Info */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={`${styles.cardIconBox} ${styles.iconWorkshop}`}>
            <Icon name="store" />
          </div>
          <div>
            <h2 className={styles.cardTitle}>Datos del Taller</h2>
            <p className={styles.cardDesc}>Información pública de tu negocio</p>
          </div>
        </div>

        <form onSubmit={handleSaveWorkshop} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Nombre del Taller</label>
            <input
              type="text"
              className={styles.input}
              value={workshopName}
              onChange={e => setWorkshopName(e.target.value)}
              placeholder={workshopLoaded ? '' : 'Cargando...'}
              disabled={!workshopLoaded}
              required
            />
          </div>

          {workshopError && <div className={styles.errorBox}>{workshopError}</div>}
          {workshopSuccess && (
            <div className={styles.successBox}>
              <Icon name="check_circle" style={{ fontSize: '1rem' }} />
              Datos del taller actualizados
            </div>
          )}

          <div className={styles.formFooter}>
            <button type="submit" className={styles.primaryBtn} disabled={savingWorkshop || !workshopName || !workshopLoaded}>
              <Icon name="save" style={{ fontSize: '1.125rem' }} />
              {savingWorkshop ? 'Guardando...' : 'Guardar Taller'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
