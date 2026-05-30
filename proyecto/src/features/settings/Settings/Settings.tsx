import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { Icon } from '../../../components/Icon/Icon';
import { getBotApiUrl, setBotApiUrl } from '../../../lib/api/bot';
import styles from './Settings.module.css';

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
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [waConnectError, setWaConnectError] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  // Network / API
  const [botUrlInput, setBotUrlInput] = useState(getBotApiUrl());
  const [savingBotUrl, setSavingBotUrl] = useState(false);
  const [botUrlSuccess, setBotUrlSuccess] = useState(false);

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
    if (!profile?.workshop_id) return;
    try {
      const res = await fetch(`${getBotApiUrl()}/api/status/${profile.workshop_id}`, { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      setWaStatus(data.status as WaStatus);
    } catch {
      setWaStatus('unreachable');
    }
  }, [profile?.workshop_id]);

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

  const handleSaveBotUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBotUrl(true);
    setBotApiUrl(botUrlInput);
    setBotUrlSuccess(true);
    // Refresh status after changing URL
    fetchWaStatus();
    setTimeout(() => {
      setBotUrlSuccess(false);
      setSavingBotUrl(false);
    }, 2000);
  };

  const handleConnectWhatsApp = async () => {
    if (!profile?.workshop_id) return;
    setWaLoading(true);
    setWaConnectError(null);
    setQrError(null);
    try {
      const res = await fetch(`${getBotApiUrl()}/api/connect/${profile.workshop_id}`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) throw new Error(`Error del servidor: ${res.status}`);
      setShowQRModal(true);
      setQrCode(null);

      let errorStreak = 0;
      const pollQR = setInterval(async () => {
        try {
          const qrRes = await fetch(`${getBotApiUrl()}/api/qr/${profile.workshop_id}`, {
            signal: AbortSignal.timeout(3000)
          });
          const data = await qrRes.json();
          errorStreak = 0;
          setQrError(null);
          if (data.qr) setQrCode(data.qr);
          if (data.status === 'ready') {
            clearInterval(pollQR);
            setShowQRModal(false);
            setWaStatus('ready');
          }
        } catch {
          errorStreak++;
          if (errorStreak >= 3) {
            setQrError(`No se puede comunicar con el servidor del bot. Verifica que esté corriendo en: ${getBotApiUrl()}`);
          }
        }
      }, 2000);

      (window as any).settingsQrInterval = pollQR;
    } catch (err: any) {
      const isNetworkErr = err?.message?.includes('fetch') || err?.name === 'TimeoutError';
      setWaConnectError(
        isNetworkErr
          ? 'No se pudo conectar con el servidor del bot. Asegúrate de que esté corriendo con: node server.js (en la carpeta whatsapp-bot)'
          : (err?.message || 'Error desconocido al conectar')
      );
    } finally {
      setWaLoading(false);
    }
  };

  const closeQRModal = () => {
    setShowQRModal(false);
    if ((window as any).settingsQrInterval) clearInterval((window as any).settingsQrInterval);
  };

  const handleDisconnectWhatsApp = async () => {
    if (!profile?.workshop_id) return;
    setWaLoading(true);
    try {
      await fetch(`${getBotApiUrl()}/api/disconnect/${profile.workshop_id}`, { method: 'POST' });
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

      {/* Configuración de Red */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardIconBox} style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-primary)' }}>
            <Icon name="router" />
          </div>
          <div><h2 className={styles.cardTitle}>Configuración de Red del Bot</h2></div>
        </div>
        <form onSubmit={handleSaveBotUrl} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>URL del Servidor del Bot</label>
            <input 
              type="url" 
              className={styles.input} 
              value={botUrlInput} 
              onChange={e => setBotUrlInput(e.target.value)} 
              placeholder="Ej: http://192.168.1.15:3001"
              required 
            />
            <p style={{ fontSize: '0.8rem', color: 'var(--color-on-surface-variant)', marginTop: '0.5rem' }}>
              Para conectar tu teléfono al servidor de tu PC, usa la IP local de tu computadora en lugar de 127.0.0.1.
            </p>
          </div>
          {botUrlSuccess && <div className={styles.successBox}>URL actualizada exitosamente</div>}
          <div className={styles.formFooter}>
            <button type="submit" className={styles.primaryBtn} disabled={savingBotUrl || !botUrlInput}>
              <Icon name={savingBotUrl ? 'sync' : 'save'} className={savingBotUrl ? 'spin' : ''} />
              {savingBotUrl ? 'Actualizando...' : 'Actualizar URL'}
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

          {waStatus === 'unreachable' && (
            <div style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '0.75rem',
              padding: '1rem 1.25rem',
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'flex-start',
              marginTop: '0.75rem'
            }}>
              <Icon name="warning" style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p style={{ margin: 0, fontWeight: 600, color: '#ef4444', fontSize: '0.9rem' }}>Servidor inactivo</p>
                <p style={{ margin: '0.25rem 0 0', color: 'var(--color-on-surface-variant)', fontSize: '0.82rem', lineHeight: 1.5 }}>
                  El bot no está corriendo. Abre una terminal en la carpeta <code style={{ background: 'var(--color-surface-variant)', padding: '0 4px', borderRadius: '4px' }}>whatsapp-bot</code> y ejecuta: <br />
                  <code style={{ background: 'var(--color-surface-variant)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>node server.js</code>
                </p>
              </div>
            </div>
          )}

          {waConnectError && (
            <div style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '0.75rem',
              padding: '1rem 1.25rem',
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'flex-start',
              marginTop: '0.75rem'
            }}>
              <Icon name="error" style={{ color: '#ef4444', flexShrink: 0 }} />
              <p style={{ margin: 0, color: 'var(--color-on-surface-variant)', fontSize: '0.85rem', lineHeight: 1.5 }}>{waConnectError}</p>
            </div>
          )}

          <div className={styles.waActions}>
            <button
              className={styles.whatsappBtn}
              onClick={handleConnectWhatsApp}
              disabled={waLoading || waStatus === 'unreachable'}
              title={waStatus === 'unreachable' ? 'Inicia el servidor primero' : ''}
            >
              {waLoading
                ? <><Icon name="sync" className="spin" /> Conectando...</>
                : waStatus === 'qr' ? 'Ver QR' : 'Conectar WhatsApp'
              }
            </button>
            {waStatus === 'ready' && <button className={`${styles.primaryBtn} ${styles.dangerBtn}`} onClick={handleDisconnectWhatsApp}>Desconectar</button>}
          </div>
        </div>
      </div>

      {showQRModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem', paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div style={{ background: 'var(--color-surface)', padding: '2rem', borderRadius: '1.25rem', maxWidth: '420px', width: '100%', textAlign: 'center', position: 'relative', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', maxHeight: 'calc(95dvh - env(safe-area-inset-top))', overflowY: 'auto' }}>
            <button onClick={closeQRModal} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'var(--color-surface-variant)', border: 'none', cursor: 'pointer', color: 'var(--color-on-surface)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" style={{ fontSize: '1.1rem' }} />
            </button>
            <h2 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '1.2rem' }}>Escanear Código QR</h2>

            {/* Step-by-step instructions */}
            <div style={{ background: 'var(--color-surface-variant)', borderRadius: '0.75rem', padding: '0.875rem', marginBottom: '1.25rem', textAlign: 'left' }}>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-on-surface)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cómo conectar desde tu celular:</p>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--color-on-surface-variant)', lineHeight: 1.6 }}>
                <li>Toca <strong>Descargar QR</strong> abajo para guardarlo en tu galería</li>
                <li>Abre <strong>WhatsApp</strong> en tu celular</li>
                <li>Ve a <strong>Dispositivos vinculados → Vincular dispositivo</strong></li>
                <li>Toca el ícono de <strong>galería/imagen</strong> y selecciona el QR descargado</li>
              </ol>
            </div>

            {qrError ? (
              <div style={{ width: '250px', height: '180px', margin: '0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '1rem', border: '2px dashed #ef4444', borderRadius: '0.75rem', padding: '1.5rem', background: 'rgba(239,68,68,0.05)' }}>
                <Icon name="cloud_off" style={{ fontSize: '2.5rem', color: '#ef4444' }} />
                <p style={{ margin: 0, color: '#ef4444', fontSize: '0.82rem', lineHeight: 1.5 }}>{qrError}</p>
                <button
                  onClick={() => setQrError(null)}
                  style={{ background: 'var(--color-primary)', color: 'white', border: 'none', padding: '0.4rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  Reintentar
                </button>
              </div>
            ) : qrCode ? (
              <>
                <img src={qrCode} alt="WhatsApp QR Code" style={{ width: '220px', height: '220px', margin: '0 auto', display: 'block', borderRadius: '0.75rem', border: '4px solid var(--color-surface-variant)' }} />
                <p style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--color-on-surface-variant)', lineHeight: 1.4 }}>
                  El código se actualiza automáticamente si expira.
                </p>
                {/* Download button */}
                <a
                  href={qrCode}
                  download="autotech-whatsapp-qr.png"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                    marginTop: '1rem', padding: '0.65rem 1.5rem',
                    background: 'var(--color-primary)', color: 'var(--color-on-primary)',
                    borderRadius: '0.6rem', fontWeight: 700, fontSize: '0.9rem',
                    textDecoration: 'none', cursor: 'pointer',
                  }}
                >
                  <Icon name="download" style={{ fontSize: '1.1rem' }} />
                  Descargar QR como imagen
                </a>
              </>
            ) : (
              <div style={{ width: '220px', height: '220px', margin: '0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', border: '2px dashed var(--color-outline)', borderRadius: '0.75rem', color: 'var(--color-on-surface-variant)' }}>
                <Icon name="sync" className="spin" style={{ fontSize: '2.5rem' }} />
                <span style={{ fontSize: '0.9rem' }}>Generando código QR...</span>
                <span style={{ fontSize: '0.78rem', opacity: 0.7 }}>Esto puede tomar unos segundos</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
