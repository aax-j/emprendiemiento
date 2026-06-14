import { useState, useEffect, useRef } from 'react';
import { getBotApiUrl } from '../../../lib/api/bot';
import { useBlocker } from 'react-router-dom';
import { writeTextFile, readTextFile, BaseDirectory, mkdir } from '@tauri-apps/plugin-fs';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { getWorkshopPublicProfile, upsertWorkshopPublicProfile } from '../../../lib/api/workshop_profiles';
import { Icon } from '../../../components/Icon/Icon';
import styles from './Customization.module.css';

interface FlowStep {
  response: string;
  action: 'READ_PLATE' | 'READ_SERVICE' | 'READ_DATE' | 'READ_TIME' | 'NONE';
}

interface ChatbotResponse {
  id: string;
  question: string;
  keywords: string;
  steps: FlowStep[];
}

const DEFAULT_RESPONSES: ChatbotResponse[] = [
  {
    id: 'default-booking',
    question: 'Agendar turno',
    keywords: 'agendar, cita, turno, mantenimiento, reservar, nueva, agendar cita, pedir turno',
    steps: [
      { response: '¡Hola! Para agendar tu cita, por favor envíame el número de tu placa (ej: ABC-1234).', action: 'READ_PLATE' },
      { response: '✅ Placa registrada. Ahora, dime el tipo de servicio que deseas realizar (ej: Cambio de aceite o revisión general).', action: 'READ_SERVICE' },
      { response: 'Entendido. ¿Para qué fecha deseas el turno? (Ejemplo: 25/10).', action: 'READ_DATE' },
      { response: 'Finalmente, dime la hora preferida (Ejemplo: 14:30 o 2pm).', action: 'READ_TIME' },
      { response: '✨ ¡Todo listo! Tu cita ha sido agendada en nuestro sistema. Un asesor confirmará los detalles pronto.', action: 'NONE' }
    ]
  },
  {
    id: 'default-status',
    question: 'Estado de reparación',
    keywords: 'estado, avance, listo, terminado, reparación, cómo va',
    steps: [
      { response: 'Consultaré el sistema de inmediato. Por favor, escribe el número de placa de tu vehículo.', action: 'READ_PLATE' },
      { response: '🔍 Buscando en el sistema... Consultando el estado actual de tu vehículo.', action: 'NONE' }
    ]
  },
  {
    id: 'default-history',
    question: 'Historial clínico',
    keywords: 'historial, registros, clínica, pasado, arreglos, antes',
    steps: [
      { response: 'Con gusto. Escribe el número de placa y te enviaré un resumen del historial clínico registrado en nuestro taller.', action: 'READ_PLATE' },
      { response: '📋 Generando historial... En un momento se te enviará un PDF con todos los registros encontrados.', action: 'NONE' }
    ]
  },
  {
    id: 'default-location',
    question: 'Ubicación y horario',
    keywords: 'dirección, dónde, ubicación, llegar, horario, abierto, Riobamba',
    steps: [
      { response: '(Mensaje automático con ubicación y horario configurados arriba)', action: 'NONE' }
    ]
  },
  {
    id: 'default-human',
    question: 'Hablar con humano',
    keywords: 'humano, persona, asesor, técnico, hablar, alguien',
    steps: [
      { response: 'Entendido. En un momento un asesor técnico revisará este chat para atenderte personalmente. Por favor, espera un instante.', action: 'NONE' }
    ]
  },
  {
    id: 'default-oil',
    question: 'Próximo cambio de aceite',
    keywords: 'próximo, cuándo, toca, fecha, recordatorio, cambio, aceite',
    steps: [
      { response: 'Si ingresas tu número de placa, puedo verificar la fecha recomendada según tu última visita.', action: 'READ_PLATE' },
      { response: '🛢️ Verificando... Comprobando la fecha registrada en nuestro sistema.', action: 'NONE' },
      { response: '✅ ¡Información registrada! Según tus datos, te avisaremos cuando sea tu próximo mantenimiento.', action: 'NONE' }
    ]
  }
];

export const Customization = () => {
  const { profile } = useAuth();
  const themeContext = useTheme();

  // --- Public Storefront State ---
  const [logoUrl, setLogoUrl] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [mapLocation, setMapLocation] = useState<{lat: number, lng: number} | null>(null);
  const [services, setServices] = useState<Array<{name: string, price: number, description: string}>>([]);
  const [promotions, setPromotions] = useState<Array<{title: string, description: string, discount: string}>>([]);

  // --- Chatbot State ---
  const [oilReminders, setOilReminders] = useState(false);
  const [oilFrequency, setOilFrequency] = useState(6);
  const [oilUnit, setOilUnit] = useState('meses'); 
  const [responses, setResponses] = useState<ChatbotResponse[]>(DEFAULT_RESPONSES);
  const [defaultResponse, setDefaultResponse] = useState('Lo siento, no entiendo tu pregunta. En un momento un asesor del taller se pondrá en contacto contigo.');
  const [businessHours, setBusinessHours] = useState({
    monFri: { start: '08:00', end: '18:00' },
    sat: { start: '08:00', end: '13:00', enabled: true },
    sun: { start: '08:00', end: '13:00', enabled: false }
  });
  
  const [confirmDialog, setConfirmDialog] = useState<{ show: boolean; title: string; message: string; onConfirm: () => void; onCancel?: () => void; onStay?: () => void; isAlert?: boolean } | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [originalConfig, setOriginalConfig] = useState<any>(null);
  const [originalStorefront, setOriginalStorefront] = useState<any>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Initialize Map
  useEffect(() => {
    if (!loading && mapRef.current && !leafletMapRef.current) {
      const initMap = () => {
        const L = (window as any).L;
        if (!L) {
          setTimeout(initMap, 500);
          return;
        }
        
        const center = mapLocation ? [mapLocation.lat, mapLocation.lng] : [-1.6635, -78.6536];
        const map = L.map(mapRef.current).setView(center, 14);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19,
        }).addTo(map);

        if (mapLocation) {
          markerRef.current = L.marker(center).addTo(map);
        }

        map.on('click', (e: any) => {
          const { lat, lng } = e.latlng;
          setMapLocation({ lat, lng });
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
          } else {
            markerRef.current = L.marker([lat, lng]).addTo(map);
          }
        });

        leafletMapRef.current = map;
      };

      if (!(window as any).L) {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = initMap;
        document.head.appendChild(script);

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      } else {
        initMap();
      }
    }
  }, [loading]);

  useEffect(() => {
    if (leafletMapRef.current && mapLocation && markerRef.current) {
      markerRef.current.setLatLng([mapLocation.lat, mapLocation.lng]);
      leafletMapRef.current.setView([mapLocation.lat, mapLocation.lng]);
    }
  }, [mapLocation]);

  const isDirty = JSON.stringify({
    oil_change_reminders: oilReminders,
    oil_change_frequency: oilFrequency,
    oil_change_unit: oilUnit,
    responses,
    default_response: defaultResponse,
    business_hours: businessHours,
    location: address,
  }) !== JSON.stringify(originalConfig) || 
  JSON.stringify({
    logoUrl, description, address, mapLocation, services, promotions
  }) !== JSON.stringify(originalStorefront);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('customization-dirty', { detail: isDirty }));
    return () => {
      window.dispatchEvent(new CustomEvent('customization-dirty', { detail: false }));
    };
  }, [isDirty]);

  useEffect(() => {
    const fetchData = async () => {
      if (!profile?.workshop_id) return;
      setLoading(true);
      try {
        let loadedConfig = null;
        try {
          const content = await readTextFile('chatbot-config.json', { baseDir: BaseDirectory.AppData });
          loadedConfig = JSON.parse(content);
        } catch (e) {}

        const publicProfile = await getWorkshopPublicProfile(profile.workshop_id);

        const parsedConfig = {
          oil_change_reminders: loadedConfig?.oil_change_reminders ?? false,
          oil_change_frequency: loadedConfig?.oil_change_frequency ?? 6,
          oil_change_unit: loadedConfig?.oil_change_unit ?? 'meses',
          responses: loadedConfig?.responses || DEFAULT_RESPONSES,
          default_response: loadedConfig?.default_response || 'Lo siento, no entiendo tu pregunta.',
          business_hours: loadedConfig?.business_hours || businessHours,
          location: loadedConfig?.location || publicProfile?.address || '',
        };

        setOilReminders(parsedConfig.oil_change_reminders);
        setOilFrequency(parsedConfig.oil_change_frequency);
        setOilUnit(parsedConfig.oil_change_unit);
        setResponses(parsedConfig.responses);
        setDefaultResponse(parsedConfig.default_response);
        setBusinessHours(parsedConfig.business_hours);
        setOriginalConfig(parsedConfig);
        
        const parsedStorefront = {
          logoUrl: publicProfile?.logo_url || '',
          description: publicProfile?.description || '',
          address: publicProfile?.address || loadedConfig?.location || '',
          mapLocation: publicProfile?.location || null,
          services: (publicProfile?.services_catalogue || []).map((s: any) => ({...s, description: s.description || ''})),
          promotions: (publicProfile?.promotions || []).map((p: any) => ({...p, discount: p.discount || ''}))
        };

        setLogoUrl(parsedStorefront.logoUrl);
        setDescription(parsedStorefront.description);
        setAddress(parsedStorefront.address);
        setMapLocation(parsedStorefront.mapLocation);
        setServices(parsedStorefront.services);
        setPromotions(parsedStorefront.promotions);
        setOriginalStorefront(parsedStorefront);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [profile?.workshop_id]);

  const handleSave = async (): Promise<boolean> => {
    if (!profile?.workshop_id) return false;
    setSaving(true);
    
    const config = {
      oil_change_reminders: oilReminders,
      oil_change_frequency: oilFrequency,
      oil_change_unit: oilUnit,
      responses,
      default_response: defaultResponse,
      business_hours: businessHours,
      location: address,
    };

    const storefrontData = {
      logoUrl, description, address, mapLocation, services, promotions
    };

    try {
      await fetch(`${getBotApiUrl()}/api/config/${profile.workshop_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      }).catch(e => console.error("Bot API error:", e));

      try {
        await writeTextFile('chatbot-config.json', JSON.stringify(config, null, 2), { baseDir: BaseDirectory.AppData });
      } catch (e) {
        console.error("Local file save error:", e);
      }
      
      let locationPayload = null;
      if (mapLocation) {
        locationPayload = { lat: mapLocation.lat, lng: mapLocation.lng };
      }

      await upsertWorkshopPublicProfile(profile.workshop_id, {
        logo_url: logoUrl || null,
        description: description || null,
        address: address || null,
        services_catalogue: services,
        promotions: promotions,
        location: locationPayload
      });
      
      setOriginalConfig({ ...config });
      setOriginalStorefront({ ...storefrontData });
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      return true;
    } catch (err) {
      console.error("Save error:", err);
      setConfirmDialog({ show: true, title: 'Error', message: 'Error al guardar.', onConfirm: () => setConfirmDialog(null), isAlert: true });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state === 'blocked') {
      setConfirmDialog({
        show: true,
        title: 'Cambios sin guardar',
        message: 'Tienes cambios pendientes. ¿Qué deseas hacer?',
        onConfirm: async () => {
          const success = await handleSave();
          if (success) {
            blocker.proceed();
            setConfirmDialog(null);
          }
        },
        onCancel: () => {
          blocker.proceed();
          setConfirmDialog(null);
        },
        onStay: () => {
          blocker.reset();
          setConfirmDialog(null);
        }
      });
    }
  }, [blocker.state]);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('La geolocalización no está soportada por tu navegador.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setMapLocation({ lat: latitude, lng: longitude });
        if (leafletMapRef.current) {
          leafletMapRef.current.setView([latitude, longitude], 16);
        }
      },
      (error) => {
        console.error("Error obteniendo ubicación:", error);
        alert('No se pudo obtener tu ubicación. Por favor, asegúrate de dar permisos de ubicación.');
      },
      { enableHighAccuracy: true }
    );
  };

  const addService = () => setServices([...services, { name: '', price: 0, description: '' }]);
  const updateService = (idx: number, field: string, val: any) => {
    const s = [...services];
    s[idx] = { ...s[idx], [field]: val };
    setServices(s);
  };
  const removeService = (idx: number) => setServices(services.filter((_, i) => i !== idx));

  const addPromo = () => setPromotions([...promotions, { title: '', description: '', discount: '' }]);
  const updatePromo = (idx: number, field: string, val: any) => {
    const p = [...promotions];
    p[idx] = { ...p[idx], [field]: val };
    setPromotions(p);
  };
  const removePromo = (idx: number) => setPromotions(promotions.filter((_, i) => i !== idx));

  return (
    <div className={styles.page}>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
          <Icon name="sync" className="spin" /> <span style={{ marginLeft: '1rem' }}>Cargando configuración...</span>
        </div>
      ) : (
        <>
          <div className={styles.header} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 className={styles.title}>Personalización</h1>
              <p className={styles.subtitle}>Configura tu escaparate comercial y respuestas automáticas</p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {success && (
                <div className={styles.successBox}>
                  <Icon name="check_circle" /> Guardado
                </div>
              )}
              <button 
                onClick={handleSave}
                disabled={!isDirty || saving}
                style={{ 
                  background: isDirty ? 'var(--color-primary)' : 'var(--color-surface-container-high)', 
                  color: isDirty ? 'white' : 'var(--color-on-surface-variant)', 
                  border: 'none', 
                  padding: '0.75rem 1.5rem', 
                  borderRadius: '0.5rem', 
                  fontWeight: 'bold', 
                  cursor: (isDirty && !saving) ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: isDirty ? '0 4px 6px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <Icon name={saving ? "sync" : "save"} className={saving ? "spin" : ""} /> 
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>

          {/* Theme */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Tema de la Aplicación</h2>
            <div className={styles.themeGrid}>
              <button className={`${styles.themeCard} ${themeContext.theme === 'light' ? styles.selected : ''}`} onClick={() => themeContext.setTheme('light')}>
                <div className={styles.themePreview} data-preview="light"><div className={styles.previewSidebar} /><div className={styles.previewContent}><div className={styles.previewBar} /><div className={styles.previewCard} /></div></div>
                <div className={styles.themeInfo}><div className={styles.themeNameRow}><Icon name="light_mode" /><span>Modo Claro</span></div></div>
              </button>
              <button className={`${styles.themeCard} ${themeContext.theme === 'dark' ? styles.selected : ''}`} onClick={() => themeContext.setTheme('dark')}>
                <div className={styles.themePreview} data-preview="dark"><div className={styles.previewSidebar} style={{ background: '#1c2022' }} /><div className={styles.previewContent} style={{ background: '#0f1416' }}><div className={styles.previewBar} style={{ background: '#1c2022' }} /><div className={styles.previewCard} style={{ background: '#1c2022' }} /></div></div>
                <div className={styles.themeInfo}><div className={styles.themeNameRow}><Icon name="dark_mode" /><span>Modo Oscuro</span></div></div>
              </button>
            </div>
          </div>

          {/* Escaparate Comercial (B2C) */}
          <div className={styles.section}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '0.5rem', background: 'var(--color-primary-container)', color: 'var(--color-primary)', borderRadius: '0.5rem' }}><Icon name="storefront" /></div>
              <div>
                <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Escaparate Comercial (Portal Cliente B2C)</h2>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--color-on-surface-variant)' }}>La información que verán los clientes en el directorio AutoTech.</p>
              </div>
            </div>

            <div className={styles.form}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>URL del Logo</label>
                <input className={styles.input} value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://ejemplo.com/logo.png" />
                {logoUrl && (
                  <div style={{ marginTop: '0.5rem', width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', background: '#ccc' }}>
                    <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => (e.currentTarget.style.display = 'none')} />
                  </div>
                )}
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Descripción del Taller</label>
                <textarea className={styles.input} value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Cuéntale a tus clientes por qué elegirte..." />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Dirección Física</label>
                <input className={styles.input} value={address} onChange={e => setAddress(e.target.value)} placeholder="Av. Principal y Secundaria..." />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Ubicación en el Mapa (Haz clic para marcar)</label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <div ref={mapRef} style={{ width: '100%', height: '300px', borderRadius: '8px', border: '1px solid var(--color-outline-variant)' }} />
                  <button 
                    onClick={(e) => { e.preventDefault(); handleGetLocation(); }} 
                    style={{
                      position: 'absolute',
                      bottom: '10px',
                      right: '10px',
                      zIndex: 1000,
                      background: 'white',
                      border: '2px solid rgba(0,0,0,0.2)',
                      borderRadius: '4px',
                      padding: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      color: '#333'
                    }}
                    title="Usar mi ubicación actual"
                  >
                    <Icon name="my_location" />
                  </button>
                </div>
                {mapLocation && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-primary)', marginTop: '0.5rem' }}>
                    Marcador fijado en: {mapLocation.lat.toFixed(5)}, {mapLocation.lng.toFixed(5)}
                  </p>
                )}
              </div>

              <div className={styles.inputGroup} style={{ marginTop: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <label className={styles.label} style={{ margin: 0 }}>Catálogo de Servicios</label>
                  <button onClick={addService} style={{ background: 'transparent', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', padding: '0.25rem 0.75rem', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer' }}>+ Añadir</button>
                </div>
                {services.map((s, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px auto', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <input className={styles.input} value={s.name} onChange={e => updateService(idx, 'name', e.target.value)} placeholder="Nombre (ej. Cambio de aceite)" />
                      <input className={styles.input} value={s.description} onChange={e => updateService(idx, 'description', e.target.value)} placeholder="Breve descripción..." style={{ fontSize: '0.8rem' }} />
                    </div>
                    <input type="number" className={styles.input} value={s.price} onChange={e => updateService(idx, 'price', Number(e.target.value))} placeholder="Precio $" />
                    <button onClick={() => removeService(idx)} style={{ padding: '0.5rem', color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}><Icon name="delete" /></button>
                  </div>
                ))}
              </div>

              <div className={styles.inputGroup} style={{ marginTop: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <label className={styles.label} style={{ margin: 0 }}>Promociones Especiales</label>
                  <button onClick={addPromo} style={{ background: 'transparent', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', padding: '0.25rem 0.75rem', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer' }}>+ Añadir</button>
                </div>
                {promotions.map((p, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <input className={styles.input} value={p.title} onChange={e => updatePromo(idx, 'title', e.target.value)} placeholder="Título (ej. Chequeo Gratis)" />
                      <input className={styles.input} value={p.description} onChange={e => updatePromo(idx, 'description', e.target.value)} placeholder="Descripción..." style={{ fontSize: '0.8rem' }} />
                    </div>
                    <input className={styles.input} value={p.discount} onChange={e => updatePromo(idx, 'discount', e.target.value)} placeholder="Badge (ej. 20% OFF)" />
                    <button onClick={() => removePromo(idx)} style={{ padding: '0.5rem', color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}><Icon name="delete" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Horario y Chatbot settings */}
          <div className={styles.section}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '0.5rem' }}><Icon name="schedule" /></div>
              <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Horario (Escaparate)</h2>
            </div>
            
            <div className={styles.form}>
              <div style={{ background: 'var(--color-surface-container-low)', padding: '1.5rem', borderRadius: '0.75rem', marginBottom: '1.5rem', border: '1px solid var(--color-outline-variant)' }}>
                <label className={styles.label}>Lunes a Viernes</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="time" className={styles.input} value={businessHours.monFri.start} onChange={e => setBusinessHours({...businessHours, monFri: {...businessHours.monFri, start: e.target.value}})} />
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>a</span>
                  <input type="time" className={styles.input} value={businessHours.monFri.end} onChange={e => setBusinessHours({...businessHours, monFri: {...businessHours.monFri, end: e.target.value}})} />
                </div>
                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '2rem' }}>
                  <div className={styles.inputGroup} style={{ marginBottom: 0 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={businessHours.sat.enabled} onChange={e => setBusinessHours({...businessHours, sat: {...businessHours.sat, enabled: e.target.checked}})} /> 
                      <span className={styles.label} style={{ margin: 0 }}>Atender Sábados</span>
                    </label>
                    {businessHours.sat.enabled && (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                        <input type="time" className={styles.input} value={businessHours.sat.start} onChange={e => setBusinessHours({...businessHours, sat: {...businessHours.sat, start: e.target.value}})} />
                        <input type="time" className={styles.input} value={businessHours.sat.end} onChange={e => setBusinessHours({...businessHours, sat: {...businessHours.sat, end: e.target.value}})} />
                      </div>
                    )}
                  </div>
                  <div className={styles.inputGroup} style={{ marginBottom: 0 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={businessHours.sun.enabled} onChange={e => setBusinessHours({...businessHours, sun: {...businessHours.sun, enabled: e.target.checked}})} />
                      <span className={styles.label} style={{ margin: 0 }}>Atender Domingos</span>
                    </label>
                    {businessHours.sun.enabled && (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                        <input type="time" className={styles.input} value={businessHours.sun.start} onChange={e => setBusinessHours({...businessHours, sun: {...businessHours.sun, start: e.target.value}})} />
                        <input type="time" className={styles.input} value={businessHours.sun.end} onChange={e => setBusinessHours({...businessHours, sun: {...businessHours.sun, end: e.target.value}})} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>



          {confirmDialog?.show && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
              <div style={{ background: 'var(--color-surface)', padding: '2rem', borderRadius: '1rem', maxWidth: '400px' }}>
                <h3>{confirmDialog.title}</h3>
                <p>{confirmDialog.message}</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                  {confirmDialog.onStay ? (
                    <>
                      <button onClick={confirmDialog.onStay} style={{ background: 'transparent', border: '1px solid var(--color-outline)', padding: '0.5rem 1rem', borderRadius: '0.5rem' }}>Seguir editando</button>
                      <button onClick={confirmDialog.onCancel} style={{ color: '#ef4444', background: 'transparent', border: 'none', padding: '0.5rem 1rem' }}>Descartar</button>
                      <button onClick={confirmDialog.onConfirm} style={{ background: 'var(--color-primary)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.5rem' }}>Guardar y Salir</button>
                    </>
                  ) : (
                    <>
                      {!confirmDialog.isAlert && <button onClick={() => setConfirmDialog(null)}>Cancelar</button>}
                      <button onClick={confirmDialog.onConfirm} style={{ background: confirmDialog.isAlert ? '#ef4444' : 'var(--color-primary)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.5rem' }}>Confirmar</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
