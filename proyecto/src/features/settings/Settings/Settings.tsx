import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { Icon } from '../../../components/Icon/Icon';
import styles from './Settings.module.css';

const WA_API = 'http://127.0.0.1:3001/api';

type WaStatus = 'disconnected' | 'initializing' | 'qr' | 'ready' | 'unreachable';

const COUNTRY_CODES = [
  { code: '593', flag: '🇪🇨', name: 'Ecuador' },
  { code: '57', flag: '🇨🇴', name: 'Colombia' },
  { code: '51', flag: '🇵🇪', name: 'Perú' },
  { code: '54', flag: '🇦🇷', name: 'Argentina' },
  { code: '56', flag: '🇨🇱', name: 'Chile' },
  { code: '52', flag: '🇲🇽', name: 'México' },
  { code: '34', flag: '🇪🇸', name: 'España' },
  { code: '1', flag: '🇺🇸', name: 'USA' },
];

export const Settings = () => {
  const { profile, user, refreshProfile } = useAuth();

  // Profile form
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('593');
  
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Workshop name
  const [workshopName, setWorkshopName] = useState('');
  const [workshopLoaded, setWorkshopLoaded] = useState(false);
  const [savingWorkshop, setSavingWorkshop] = useState(false);
  const [workshopSuccess, setWorkshopSuccess] = useState(false);
  const [workshopError, setWorkshopError] = useState<string | null>(null);

  // WhatsApp status
  const [waStatus, setWaStatus] = useState<WaStatus>('disconnected');
  const [waLoading, setWaLoading] = useState(false);

  // Initial load workshop
  useEffect(() => {
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
  }, [profile?.workshop_id]);

  // Sync phone/fullName when profile loads
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      
      // Intentar separar el código de país del número guardado
      const savedPhone = profile.phone ?? '';
      const matchedCountry = COUNTRY_CODES.find(c => savedPhone.startsWith(c.code));
      
      if (matchedCountry) {
        setCountryCode(matchedCountry.code);
        setPhone(savedPhone.replace(matchedCountry.code, ''));
      } else {
        setPhone(savedPhone);
      }
    }
  }, [profile]);

  const fetchWaStatus = useCallback(async () => {
    try {
      const res = await fetch(`${WA_API}/status`, { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      setWaStatus(data.status as WaStatus);
    } catch {
      setWaStatus('unreachable');
    }
  }, []);

  useEffect(() => {
    fetchWaStatus();
    const interval = setInterval(fetchWaStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchWaStatus]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(false);
    try {
      // Limpiar y combinar
      const cleanPhone = phone.replace(/^0+/, '').replace(/\D/g, '');
      const fullPhone = countryCode + cleanPhone;

      const { error } = await supabase
        .from('profiles')
        .update({ 
          full_name: fullName, 
          phone: fullPhone || null 
        })
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

  const handleConnectWhatsApp = async () => {
    setWaLoading(true);
    try {
      await fetch(`${WA_API}/connect`, { method: 'POST' });
      // Usar el plugin de Tauri para abrir el navegador del sistema
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl('http://localhost:3001/qr-page.html');
    } catch (err) {
      console.error('Error opening QR page:', err);
    } finally {
      setWaLoading(false);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    setWaLoading(true);
    try {
      await fetch(`${WA_API}/disconnect`, { method: 'POST' });
      setWaStatus('disconnected');
    } catch {
      setWaStatus('unreachable');
    } finally {
      setWaLoading(false);
    }
  };

  const waLabel: Record<WaStatus, string> = {
    disconnected: 'Desconectado',
    initializing: 'Iniciando…',
    qr: 'Esperando escaneo',
    ready: 'Conectado',
    unreachable: 'Servidor inactivo',
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Cuenta y Configuración</h1>
        <p className={styles.subtitle}>Gestiona tu información personal y los datos del taller</p>
      </div>

      {/* Perfil */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardIconBox}><Icon name="manage_accounts" /></div>
          <div><h2 className={styles.cardTitle}>Perfil de Usuario</h2></div>
        </div>
        <form onSubmit={handleSaveProfile} className={styles.form}>
          <div className={styles.row}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Nombre Completo</label>
              <input type="text" className={styles.input} value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Correo Electrónico</label>
              <input type="email" className={`${styles.input} ${styles.readOnly}`} value={user?.email ?? ''} readOnly />
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Número WhatsApp</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select value={countryCode} onChange={e => setCountryCode(e.target.value)} className={styles.input} style={{ width: '110px' }}>
                  {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} +{c.code}</option>)}
                </select>
                <input type="tel" className={styles.input} value={phone} onChange={e => setPhone(e.target.value)} placeholder="990715214" style={{ flex: 1 }} />
              </div>
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Rol</label>
              <div className={styles.roleChip}><Icon name="admin_panel_settings" /> Administrador</div>
            </div>
          </div>
          {profileError && <div className={styles.errorBox}>{profileError}</div>}
          {profileSuccess && <div className={styles.successBox}>Perfil actualizado</div>}
          <div className={styles.formFooter}>
            <button type="submit" className={styles.primaryBtn} disabled={savingProfile || !fullName}>
              <Icon name={savingProfile ? 'sync' : 'save'} className={savingProfile ? 'spin' : ''} />
              {savingProfile ? 'Guardando...' : 'Guardar Perfil'}
            </button>
          </div>
        </form>
      </div>

      {/* Datos del Taller */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={`${styles.cardIconBox} ${styles.iconWorkshop}`}><Icon name="store" /></div>
          <div><h2 className={styles.cardTitle}>Datos del Taller</h2></div>
        </div>
        <form onSubmit={handleSaveWorkshop} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Nombre del Taller</label>
            <input 
              type="text" 
              className={styles.input} 
              value={workshopName} 
              onChange={e => setWorkshopName(e.target.value)} 
              placeholder={workshopLoaded ? "" : "Cargando..."}
              disabled={!workshopLoaded}
              required 
            />
          </div>
          {workshopError && <div className={styles.errorBox}>{workshopError}</div>}
          {workshopSuccess && <div className={styles.successBox}>Datos del taller actualizados</div>}
          <div className={styles.formFooter}>
            <button type="submit" className={styles.primaryBtn} disabled={savingWorkshop || !workshopName}>
              <Icon name={savingWorkshop ? 'sync' : 'save'} className={savingWorkshop ? 'spin' : ''} />
              {savingWorkshop ? 'Guardando...' : 'Guardar Taller'}
            </button>
          </div>
        </form>
      </div>

      {/* WhatsApp Integration */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={`${styles.cardIconBox} ${styles.iconWhatsApp}`}><Icon name="chat" /></div>
          <div><h2 className={styles.cardTitle}>WhatsApp Bot</h2></div>
        </div>
        <div className={styles.form}>
          <div className={styles.waStatusRow}>
            <span>Estado de conexión</span>
            <span className={`${styles.waBadge} ${styles[`waBadge_${waStatus}`]}`}>{waLabel[waStatus]}</span>
          </div>
          <div className={styles.waActions}>
            <button className={styles.whatsappBtn} onClick={handleConnectWhatsApp} disabled={waLoading}>{waStatus === 'qr' ? 'Ver QR' : 'Conectar WhatsApp'}</button>
            {waStatus === 'ready' && <button className={`${styles.primaryBtn} ${styles.dangerBtn}`} onClick={handleDisconnectWhatsApp}>Desconectar</button>}
          </div>
        </div>
      </div>
    </div>
  );
};
