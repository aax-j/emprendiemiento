import { useState, useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import { writeTextFile, readTextFile, BaseDirectory, mkdir } from '@tauri-apps/plugin-fs';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
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

  // Chatbot state
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
  const [location, setLocation] = useState('Riobamba, Ecuador');
  const [botStatus, setBotStatus] = useState<'connected' | 'disconnected' | 'loading'>('loading');
  const [confirmDialog, setConfirmDialog] = useState<{ show: boolean; title: string; message: string; onConfirm: () => void; isAlert?: boolean } | null>(null);

  // Polling para el estado del bot
  useEffect(() => {
    const checkStatus = async () => {
      if (!profile?.workshop_id) return;
      try {
        const res = await fetch(`http://127.0.0.1:3001/api/status/${profile.workshop_id}`);
        const data = await res.json();
        setBotStatus(data.status === 'ready' ? 'connected' : 'disconnected');
      } catch (e) {
        setBotStatus('disconnected');
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [profile?.workshop_id]);

  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!profile?.workshop_id) return;
    try {
      await fetch(`http://127.0.0.1:3001/api/connect/${profile.workshop_id}`, { method: 'POST' });
      setShowQRModal(true);
      setQrCode(null);
      
      const pollQR = setInterval(async () => {
        try {
          const res = await fetch(`http://127.0.0.1:3001/api/qr/${profile.workshop_id}`);
          const data = await res.json();
          if (data.qr) setQrCode(data.qr);
          if (data.status === 'ready') {
            clearInterval(pollQR);
            setShowQRModal(false);
            setBotStatus('connected');
          }
        } catch(e) {}
      }, 2000);
      
      (window as any).qrInterval = pollQR;
    } catch (e) {
      setConfirmDialog({ show: true, title: 'Error', message: 'No se pudo conectar con el servidor.', onConfirm: () => setConfirmDialog(null), isAlert: true });
    }
  };

  const closeQRModal = () => {
    setShowQRModal(false);
    if ((window as any).qrInterval) clearInterval((window as any).qrInterval);
  };

  const handleDisconnect = async () => {
    if (!profile?.workshop_id) return;
    setConfirmDialog({
      show: true,
      title: 'Desconectar WhatsApp',
      message: '¿Estás seguro de que quieres desconectar el bot? Tendrás que escanear el código QR nuevamente.',
      onConfirm: async () => {
        try {
          await fetch(`http://127.0.0.1:3001/api/disconnect/${profile.workshop_id}`, { method: 'POST' });
          setBotStatus('disconnected');
          setConfirmDialog(null);
        } catch (e) {
          setConfirmDialog({ show: true, title: 'Error', message: 'No se pudo desconectar.', onConfirm: () => setConfirmDialog(null), isAlert: true });
        }
      }
    });
  };

  const resetToDefaults = () => {
    setConfirmDialog({
      show: true,
      title: 'Restablecer Valores',
      message: '¿Estás seguro? Se perderán todos tus cambios personalizados.',
      onConfirm: () => {
        setResponses(DEFAULT_RESPONSES);
        setConfirmDialog(null);
      }
    });
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [originalConfig, setOriginalConfig] = useState<any>(null);

  const isDirty = JSON.stringify({
    oil_change_reminders: oilReminders,
    oil_change_frequency: oilFrequency,
    oil_change_unit: oilUnit,
    responses,
    default_response: defaultResponse,
    business_hours: businessHours,
    location,
  }) !== JSON.stringify(originalConfig);

  // Broadcast dirty state to Sidebar
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('customization-dirty', { detail: isDirty }));
    return () => {
      window.dispatchEvent(new CustomEvent('customization-dirty', { detail: false }));
    };
  }, [isDirty]);

  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      try {
        let loadedConfig = null;
        try {
          const content = await readTextFile('chatbot-config.json', { baseDir: BaseDirectory.AppData });
          loadedConfig = JSON.parse(content);
        } catch (e) {}

        if (loadedConfig) {
          setOilReminders(loadedConfig.oil_change_reminders ?? false);
          setOilFrequency(loadedConfig.oil_change_frequency ?? 6);
          setOilUnit(loadedConfig.oil_change_unit ?? 'meses');
          setResponses(loadedConfig.responses || DEFAULT_RESPONSES);
          setDefaultResponse(loadedConfig.default_response || '');
          if (loadedConfig.business_hours) setBusinessHours(loadedConfig.business_hours);
          if (loadedConfig.location) setLocation(loadedConfig.location);

          setOriginalConfig({
            oil_change_reminders: loadedConfig.oil_change_reminders ?? false,
            oil_change_frequency: loadedConfig.oil_change_frequency ?? 6,
            oil_change_unit: loadedConfig.oil_change_unit ?? 'meses',
            responses: loadedConfig.responses || DEFAULT_RESPONSES,
            default_response: loadedConfig.default_response || '',
            business_hours: loadedConfig.business_hours || businessHours,
            location: loadedConfig.location || location
          });
        } else {
          setOriginalConfig({
            oil_change_reminders: false,
            oil_change_frequency: 6,
            oil_change_unit: 'meses',
            responses: DEFAULT_RESPONSES,
            default_response: defaultResponse,
            business_hours: businessHours,
            location: location
          });
        }
      } catch (err) {
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [profile?.workshop_id]);

  const handleSave = async () => {
    setSaving(true);
    const config = {
      oil_change_reminders: oilReminders,
      oil_change_frequency: oilFrequency,
      oil_change_unit: oilUnit,
      responses,
      default_response: defaultResponse,
      business_hours: businessHours,
      location,
    };

    try {
      if (profile?.workshop_id) {
        await fetch(`http://127.0.0.1:3001/api/config/${profile.workshop_id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        });
      }
      try {
        await mkdir('', { baseDir: BaseDirectory.AppData, recursive: true });
        await writeTextFile('chatbot-config.json', JSON.stringify(config, null, 2), { baseDir: BaseDirectory.AppData });
      } catch (e) {}
      
      setOriginalConfig(config);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setConfirmDialog({ show: true, title: 'Error', message: 'Error al guardar.', onConfirm: () => setConfirmDialog(null), isAlert: true });
    } finally {
      setSaving(false);
    }
  };

  const updateResponse = (index: number, field: string, value: any) => {
    const newResponses = [...responses];
    newResponses[index] = { ...newResponses[index], [field]: value } as any;
    setResponses(newResponses);
  };

  const updateStep = (resIndex: number, stepIndex: number, field: string, value: any) => {
    const newResponses = [...responses];
    const newSteps = [...newResponses[resIndex].steps];
    newSteps[stepIndex] = { ...newSteps[stepIndex], [field]: value } as any;
    newResponses[resIndex].steps = newSteps;
    setResponses(newResponses);
  };

  const addStep = (resIndex: number) => {
    const newResponses = [...responses];
    newResponses[resIndex].steps = [...newResponses[resIndex].steps, { response: '', action: 'NONE' }];
    setResponses(newResponses);
  };

  const removeStep = (resIndex: number, stepIndex: number) => {
    const newResponses = [...responses];
    newResponses[resIndex].steps = newResponses[resIndex].steps.filter((_, i) => i !== stepIndex);
    setResponses(newResponses);
  };

  const addResponse = () => {
    setResponses([{ id: Date.now().toString(), question: 'Nuevo Flujo', keywords: '', steps: [{ response: '', action: 'NONE' }] }, ...responses]);
  };

  const removeResponse = (index: number) => {
    setConfirmDialog({
      show: true,
      title: 'Eliminar Flujo',
      message: '¿Estás seguro de eliminar este flujo?',
      onConfirm: () => {
        setResponses(responses.filter((_, i) => i !== index));
        setConfirmDialog(null);
      }
    });
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
        message: 'Tienes cambios pendientes en la personalización. ¿Qué deseas hacer?',
        onConfirm: async () => {
          await handleSave();
          blocker.proceed();
          setConfirmDialog(null);
        },
        onCancel: () => {
          blocker.proceed();
          setConfirmDialog(null);
        },
        onStay: () => {
          blocker.reset();
          setConfirmDialog(null);
        }
      } as any);
    }
  }, [blocker.state]);

  return (
    <div className={styles.page}>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
          <Icon name="sync" className="spin" /> <span style={{ marginLeft: '1rem' }}>Cargando...</span>
        </div>
      ) : (
        <>
          <div className={styles.header}>
            <h1 className={styles.title}>Personalización</h1>
            <p className={styles.subtitle}>Configura el comportamiento del taller</p>
          </div>

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

          {/* Horario y Ubicación Section */}
          <div className={styles.section}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '0.5rem' }}><Icon name="schedule" /></div>
              <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Horario y Ubicación</h2>
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

              <div className={styles.inputGroup}>
                <label className={styles.label}>Ubicación del Taller</label>
                <input className={styles.input} value={location} onChange={e => setLocation(e.target.value)} placeholder="Dirección o link maps" />
                <p style={{ fontSize: '0.75rem', color: 'var(--color-on-surface-variant)', marginTop: '0.5rem' }}>
                  Esta ubicación será enviada automáticamente por el bot.
                </p>
              </div>
            </div>
          </div>

          {/* Mantenimiento Section */}
          <div className={styles.section}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '0.5rem', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderRadius: '0.5rem' }}><Icon name="oil_barrel" /></div>
              <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Mantenimiento</h2>
            </div>
            
            <div className={styles.form}>
              <div style={{ background: 'var(--color-surface-container-low)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--color-outline-variant)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <input type="checkbox" checked={oilReminders} onChange={e => setOilReminders(e.target.checked)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} id="oilCheck" />
                  <label htmlFor="oilCheck" style={{ cursor: 'pointer' }}>
                    <span className={styles.label} style={{ margin: 0, fontWeight: '600' }}>Activar Recordatorios de Aceite</span>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--color-on-surface-variant)' }}>El bot avisará a los clientes según su última visita.</p>
                  </label>
                </div>
                
                {oilReminders && (
                  <div style={{ marginTop: '1.5rem', paddingLeft: '2.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span className={styles.label} style={{ margin: 0 }}>Frecuencia recomendada:</span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input type="number" className={styles.input} value={oilFrequency} onChange={e => setOilFrequency(parseInt(e.target.value))} style={{ width: '80px' }} />
                      <select className={styles.input} value={oilUnit} onChange={e => setOilUnit(e.target.value)} style={{ width: '110px' }}>
                        <option value="días">Días</option>
                        <option value="meses">Meses</option>
                        <option value="años">Años</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chatbot Section */}
          <div className={styles.section}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '0.5rem', background: 'rgba(37, 211, 102, 0.1)', color: '#25d366', borderRadius: '0.5rem' }}><Icon name="smart_toy" /></div>
              <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Respuestas del Chatbot</h2>
            </div>

            <div className={styles.form}>
              <div className={styles.inputGroup}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-on-surface-variant)' }}>Configura los flujos de conversación automáticos.</p>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={resetToDefaults} style={{ color: '#ef4444', background: 'transparent', border: '1px solid #ef4444', padding: '0.4rem 0.75rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Icon name="history" style={{ fontSize: '1.1rem' }} /> Restablecer Valores
                    </button>
                    <button onClick={addResponse} className={styles.saveBtn} style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>
                      <Icon name="add" style={{ fontSize: '1.1rem' }} /> Añadir Flujo
                    </button>
                  </div>
                </div>

                <div className={styles.responsesList}>
                  {responses.map((res, idx) => (
                    <div key={idx} style={{ border: '1px solid var(--color-outline-variant)', borderRadius: '0.75rem', marginBottom: '1.5rem', overflow: 'hidden', background: 'var(--color-surface)' }}>
                      <div style={{ background: 'var(--color-surface-variant)', padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                          <Icon name="chat_bubble" style={{ fontSize: '1.2rem', color: 'var(--color-primary)' }} />
                          <input value={res.question} onChange={e => updateResponse(idx, 'question', e.target.value)} style={{ background: 'transparent', border: 'none', fontWeight: 'bold', fontSize: '1rem', width: '100%', color: 'var(--color-on-surface)' }} />
                        </div>
                        <button onClick={() => removeResponse(idx)} style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}><Icon name="delete" /></button>
                      </div>
                      <div style={{ padding: '1.25rem' }}>
                        <div className={styles.inputGroup} style={{ marginBottom: '1.5rem' }}>
                          <label className={styles.label}>Palabras clave que activan este flujo</label>
                          <input className={styles.input} value={res.keywords} onChange={e => updateResponse(idx, 'keywords', e.target.value)} placeholder="separadas por comas (ej: agendar, turno...)" />
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {res.steps.map((s, sIdx) => (
                            <div key={sIdx} style={{ display: 'grid', gridTemplateColumns: '1fr 200px 40px', gap: '1rem', alignItems: 'start', padding: '1rem', background: 'var(--color-surface-container-low)', borderRadius: '0.5rem', borderLeft: '4px solid var(--color-primary)' }}>
                              <div className={styles.inputGroup} style={{ marginBottom: 0 }}>
                                <label className={styles.label} style={{ fontSize: '0.75rem' }}>Mensaje {sIdx + 1}</label>
                                {(s.action === 'NONE' && ['default-status', 'default-location', 'default-oil', 'default-history'].includes(res.id)) ? (
                                   <div style={{ background: 'var(--color-surface-container-high)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px dashed var(--color-outline)', color: 'var(--color-on-surface-variant)', fontSize: '0.85rem', fontStyle: 'italic', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                     <Icon name="auto_awesome" style={{ fontSize: '1.1rem' }} />
                                     <span>Este mensaje es dinámico y lo genera el sistema automáticamente.</span>
                                   </div>
                                ) : (
                                   <textarea className={styles.input} value={s.response} onChange={e => updateStep(idx, sIdx, 'response', e.target.value)} rows={2} style={{ fontSize: '0.9rem' }} />
                                )}
                              </div>
                              <div className={styles.inputGroup} style={{ marginBottom: 0 }}>
                                <label className={styles.label} style={{ fontSize: '0.75rem' }}>Acción</label>
                                <select className={styles.input} value={s.action} onChange={e => updateStep(idx, sIdx, 'action', e.target.value)} style={{ fontSize: '0.9rem' }}>
                                  <option value="NONE">Solo responder</option>
                                  <option value="READ_PLATE">Leer Placa</option>
                                  <option value="READ_SERVICE">Leer Servicio</option>
                                  <option value="READ_DATE">Leer Fecha</option>
                                  <option value="READ_TIME">Leer Hora</option>
                                </select>
                              </div>
                              <button onClick={() => removeStep(idx, sIdx)} style={{ marginTop: '1.5rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-on-surface-variant)' }}><Icon name="close" /></button>
                            </div>
                          ))}
                          <button onClick={() => addStep(idx)} style={{ alignSelf: 'flex-start', color: 'var(--color-primary)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Icon name="add_circle" style={{ fontSize: '1.1rem' }} /> Añadir paso
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.inputGroup} style={{ marginTop: '2rem' }}>
                <label className={styles.label}>Respuesta por Defecto (cuando el bot no entiende)</label>
                <textarea className={styles.input} value={defaultResponse} onChange={e => setDefaultResponse(e.target.value)} rows={3} style={{ fontSize: '0.95rem' }} />
              </div>

              <div className={styles.saveRow} style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid var(--color-outline-variant)' }}>
                {isDirty && !success && (
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', fontWeight: '500' }}>
                     <Icon name="warning" />
                     <span>Cambios pendientes de guardar</span>
                   </div>
                )}
                {success && (
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#22c55e', fontWeight: '500' }}>
                     <Icon name="check_circle" />
                     <span>¡Configuración guardada!</span>
                   </div>
                )}
                <button className={styles.saveBtn} onClick={handleSave} disabled={saving} style={{ padding: '0.75rem 2rem', fontSize: '1rem', marginLeft: 'auto' }}>
                  <Icon name={saving ? 'sync' : 'save'} className={saving ? 'spin' : ''} />
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
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
