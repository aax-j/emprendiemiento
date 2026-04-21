import { useState, useEffect } from 'react';
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
      { response: '✅ Placa registrada. Ahora, mándame el tipo de servicio que deseas realizar (ej: Cambio de aceite o revisión general).', action: 'READ_SERVICE' },
      { response: 'Entendido. Por favor, dime la fecha en la que deseas el turno (ej: Lunes 25 de Octubre).', action: 'READ_DATE' },
      { response: 'Finalmente, dime la hora preferida (ej: 16:00 o 4pm).', action: 'READ_TIME' },
      { response: '✨ ¡Todo listo! Gracias, tu cita ha sido agendada. Un asesor confirmará los detalles pronto.', action: 'NONE' }
    ]
  },
  {
    id: 'default-status',
    question: 'Estado de reparación',
    keywords: 'estado, avance, listo, terminado, reparación, cómo va',
    steps: [
      { response: 'Consultaré el sistema de inmediato. Por favor, escribe el número de placa de tu vehículo.', action: 'READ_PLATE' },
      { response: '🔍 Buscando... Tu vehículo se encuentra actualmente en fase de revisión técnica. Te avisaremos en cuanto esté listo.', action: 'NONE' }
    ]
  },
  {
    id: 'default-history',
    question: 'Historial clínico',
    keywords: 'historial, registros, clínica, pasado, arreglos, antes',
    steps: [
      { response: 'Con gusto. Escribe el número de placa y te enviaré un resumen del historial clínico de tu vehículo registrado en nuestro taller.', action: 'READ_PLATE' },
      { response: '📋 Generando historial... He encontrado registros de tus últimas 3 visitas. Un asesor te enviará el PDF detallado en un momento.', action: 'NONE' }
    ]
  },
  {
    id: 'default-location',
    question: 'Ubicación y horario',
    keywords: 'dirección, dónde, ubicación, llegar, horario, abierto, Riobamba',
    steps: [
      { response: 'Estamos ubicados en Riobamba. Atendemos de lunes a viernes (08:00 - 18:00) y sábados (08:00 - 13:00). ¿Te gustaría que te envíe la ubicación de Google Maps?', action: 'NONE' }
    ]
  },
  {
    id: 'default-human',
    question: 'Hablar con humano',
    keywords: 'humano, persona, asesor, técnico, hablar, alguien',
    steps: [
      { response: 'Entendido. En un momento un asesor técnico revisará este chat para atenderte de forma personalizada. Por favor, espera un instante.', action: 'NONE' }
    ]
  },
  {
    id: 'default-oil',
    question: 'Próximo cambio de aceite',
    keywords: 'próximo, cuándo, toca, fecha, recordatorio, cambio, aceite',
    steps: [
      { response: 'Si ingresas tu número de placa, puedo verificar la fecha recomendada según tu última visita al taller.', action: 'READ_PLATE' },
      { response: '🛢️ Verificando... Según mis registros, tu próximo cambio de aceite debería ser en aproximadamente 2 meses. ¿Te gustaría agendar una cita preventiva?', action: 'NONE' }
    ]
  }
];

export const Customization = () => {
  const { profile } = useAuth();
  const themeContext = useTheme();

  // Chatbot state
  const [oilReminders, setOilReminders] = useState(false);
  const [oilFrequency, setOilFrequency] = useState(6);
  const [oilUnit, setOilUnit] = useState('meses'); // 'días' | 'meses' | 'años'
  const [responses, setResponses] = useState<ChatbotResponse[]>(DEFAULT_RESPONSES);
  const [defaultResponse, setDefaultResponse] = useState('Lo siento, no entiendo tu pregunta. En un momento un asesor del taller se pondrá en contacto contigo.');
  const [botStatus, setBotStatus] = useState<'connected' | 'disconnected' | 'loading'>('loading');
  
  // Polling para el estado del bot
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('http://127.0.0.1:3001/status');
        const data = await res.json();
        setBotStatus(data.status === 'ready' ? 'connected' : 'disconnected');
      } catch (e) {
        setBotStatus('disconnected');
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const resetToDefaults = () => {
    if (confirm('¿Estás seguro de que quieres restablecer todas las respuestas a los valores de fábrica? Perderás tus cambios personalizados.')) {
      setResponses(DEFAULT_RESPONSES);
    }
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [originalConfig, setOriginalConfig] = useState<any>(null);

  // Detectar si hay cambios sin guardar
  const isDirty = JSON.stringify({
    oil_change_reminders: oilReminders,
    oil_change_frequency: oilFrequency,
    oil_change_unit: oilUnit,
    responses,
    default_response: defaultResponse,
  }) !== JSON.stringify(originalConfig);

  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      try {
        let loadedConfig = null;
        try {
          const configPath = 'chatbot-config.json';
          const content = await readTextFile(configPath, { baseDir: BaseDirectory.AppData });
          loadedConfig = JSON.parse(content);
        } catch (e) {
          /* 
          // Comentado temporalmente hasta que la tabla exista en Supabase
          if (profile?.workshop_id) {
            const { data } = await supabase
              .from('chatbot_config')
              .select('*')
              .eq('workshop_id', profile.workshop_id)
              .single();
            if (data) loadedConfig = data;
          }
          */
        }

        if (loadedConfig) {
          // Migración: Asegurar que todas las respuestas tengan 'steps'
          if (loadedConfig.responses) {
            loadedConfig.responses = loadedConfig.responses.map((r: any) => ({
              id: r.id || Math.random().toString(36).substr(2, 9),
              question: r.question || 'Sin título',
              keywords: r.keywords || '',
              steps: r.steps || [
                { 
                  response: r.response || 'Sin respuesta', 
                  action: r.action === 'BOOKING' ? 'READ_PLATE' : 'NONE' 
                }
              ]
            }));
          }

          setOilReminders(loadedConfig.oil_change_reminders ?? false);
          setOilFrequency(loadedConfig.oil_change_frequency ?? 6);
          setOilUnit(loadedConfig.oil_change_unit ?? 'meses');
          setResponses(loadedConfig.responses || DEFAULT_RESPONSES);
          setDefaultResponse(loadedConfig.default_response || '');
          
          setOriginalConfig({
            oil_change_reminders: loadedConfig.oil_change_reminders,
            oil_change_frequency: loadedConfig.oil_change_frequency || loadedConfig.oil_change_frequency_days || 6,
            oil_change_unit: loadedConfig.oil_change_unit || 'meses',
            responses: loadedConfig.responses || DEFAULT_RESPONSES,
            default_response: loadedConfig.default_response || '',
          });
        } else {
          // Si es totalmente nuevo, el original es el default
          setOriginalConfig({
            oil_change_reminders: false,
            oil_change_frequency: 6,
            oil_change_unit: 'meses',
            responses: DEFAULT_RESPONSES,
            default_response: defaultResponse,
          });
        }
      } catch (err) {
        console.error('Error cargando configuración:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [profile?.workshop_id]);

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);

    const config = {
      oil_change_reminders: oilReminders,
      oil_change_frequency: oilFrequency,
      oil_change_unit: oilUnit,
      responses,
      default_response: defaultResponse,
      updated_at: new Date().toISOString()
    };

    try {
      /* 
      // 1. Guardar Supabase (Comentado hasta que la tabla exista)
      if (profile?.workshop_id) {
        const dbConfig = { 
          ...config, 
          workshop_id: profile.workshop_id,
          oil_change_frequency_days: oilFrequency 
        };
        const { error } = await supabase
          .from('chatbot_config')
          .upsert(dbConfig, { onConflict: 'workshop_id' });
        
        if (error) {
          console.error('Error en Supabase:', error);
          // throw new Error(`Error en base de datos: ${error.message}`);
        }
      }
      */

      // 2. Guardar LOCAL (Copia de respaldo)
      try {
        try { await mkdir('', { baseDir: BaseDirectory.AppData, recursive: true }); } catch(e) {}
        await writeTextFile('chatbot-config.json', JSON.stringify(config, null, 2), {
          baseDir: BaseDirectory.AppData,
        });
      } catch (err: any) {
        console.warn('No se pudo guardar archivo local:', err);
        // No lanzamos error aquí para que al menos se guarde en Supabase
      }

      setOriginalConfig({
        oil_change_reminders: oilReminders,
        oil_change_frequency: oilFrequency,
        oil_change_unit: oilUnit,
        responses: [...responses],
        default_response: defaultResponse,
      });
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error crítico al guardar:', err);
      alert(err.message || 'Error al guardar la configuración');
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
    if (confirm('¿Estás seguro de eliminar este flujo completo?')) {
      const newResponses = responses.filter((_, i) => i !== index);
      setResponses(newResponses);
    }
  };

  return (
    <div className={styles.page}>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', fontSize: '1.2rem', color: 'var(--color-on-surface-variant)' }}>
          <Icon name="sync" className="spin" style={{ marginRight: '0.5rem' }} /> Cargando configuración...
        </div>
      ) : (
        <>
          <div className={styles.header}>
            <h1 className={styles.title}>Personalización</h1>
            <p className={styles.subtitle}>Ajusta la apariencia y el comportamiento de tu taller</p>
          </div>

          {/* Banner de Estado del Bot */}
          {botStatus === 'disconnected' && (
            <div style={{ 
              background: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid #ef4444', 
              color: '#ef4444', 
              padding: '1rem', 
              borderRadius: '0.75rem', 
              marginBottom: '2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <Icon name="report_problem" style={{ fontSize: '1.5rem' }} />
              <div>
                <strong style={{ display: 'block' }}>¡WhatsApp Desconectado!</strong>
                <span style={{ fontSize: '0.9rem' }}>El bot no puede responder mensajes. Por favor, asegúrate de haber escaneado el código QR y que el teléfono tenga internet.</span>
              </div>
            </div>
          )}

          {botStatus === 'connected' && (
            <div style={{ 
              background: 'rgba(34, 197, 94, 0.1)', 
              border: '1px solid #22c55e', 
              color: '#22c55e', 
              padding: '0.5rem 1rem', 
              borderRadius: '2rem', 
              marginBottom: '2rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.8rem',
              fontWeight: 'bold'
            }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} className="pulse" />
              Bot de WhatsApp Activo
            </div>
          )}

      {/* Tema Section */}
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

      {/* Chatbot Section */}
      <div className={styles.section}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ padding: '0.5rem', background: 'rgba(37, 211, 102, 0.1)', color: '#25d366', borderRadius: '0.5rem' }}><Icon name="smart_toy" /></div>
          <h2 className={styles.sectionTitle}>Personaliza Chatbot para tus Clientes</h2>
        </div>

        <div className={styles.form}>
          <div style={{ background: 'var(--color-background)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--color-outline-variant)' }}>
            <div className={styles.switchRow} style={{ justifyContent: 'flex-start', gap: '1.5rem' }}>
              <input type="checkbox" checked={oilReminders} onChange={e => setOilReminders(e.target.checked)} style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: 'var(--color-primary)' }} />
              <div className={styles.switchLabelBox}>
                <span className={styles.switchTitle}>Recordatorios de cambio de aceite</span>
                <span className={styles.switchDesc}>Enviar mensajes automáticos cuando toque mantenimiento.</span>
              </div>
            </div>

            {oilReminders && (
              <div className={styles.inputGroup} style={{ marginTop: '1.25rem', paddingLeft: '3.5rem' }}>
                <label className={styles.label}>¿Cada cuánto tiempo enviar el recordatorio?</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="number" className={styles.input} value={oilFrequency} onChange={e => setOilFrequency(parseInt(e.target.value))} min="1" style={{ width: '100px' }} />
                  <select className={styles.input} value={oilUnit} onChange={e => setOilUnit(e.target.value)} style={{ width: '120px', cursor: 'pointer' }}>
                    <option value="días">Días</option>
                    <option value="meses">Meses</option>
                    <option value="años">Años</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className={styles.inputGroup}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <label className={styles.label}>Preguntas y Respuestas Automáticas</label>
                {responses.length === 0 && (
                  <p style={{ color: '#f59e0b', fontSize: '0.8125rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Icon name="warning" style={{ fontSize: '1rem' }} /> No tienes preguntas guardadas. El bot usará la respuesta por defecto.
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className={styles.saveBtn} onClick={resetToDefaults} style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444' }}>
                  <Icon name="history" style={{ fontSize: '1.125rem' }} /> Restablecer Valores
                </button>
                <button className={styles.saveBtn} onClick={addResponse} style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem', backgroundColor: 'var(--color-surface-variant)', color: 'var(--color-on-surface-variant)' }}>
                  <Icon name="add" style={{ fontSize: '1.125rem' }} /> Añadir Pregunta
                </button>
              </div>
            </div>
            
            <div className={styles.responsesList}>
              {responses.map((res, resIndex) => (
                <div key={resIndex} className={styles.responseItem} style={{ marginBottom: '2rem', border: '1px solid var(--color-outline-variant)' }}>
                  <div className={styles.responseHeader} style={{ background: 'var(--color-surface-variant)', padding: '0.75rem 1rem', borderRadius: '0.5rem 0.5rem 0 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                      <Icon name="account_tree" style={{ color: 'var(--color-primary)' }} />
                      <input value={res.question} onChange={e => updateResponse(resIndex, 'question', e.target.value)} className={styles.input} style={{ background: 'transparent', border: 'none', fontWeight: 'bold', width: '100%' }} placeholder="Nombre del Flujo" />
                    </div>
                    <button onClick={() => removeResponse(resIndex)} style={{ color: '#ef4444' }} className={styles.iconBtn}><Icon name="delete" /></button>
                  </div>

                  <div style={{ padding: '1rem' }}>
                    <div className={styles.inputGroup} style={{ marginBottom: '1.5rem' }}>
                      <label className={styles.label}>Palabras que activan este flujo (separadas por coma)</label>
                      <input className={styles.input} value={res.keywords} onChange={e => updateResponse(resIndex, 'keywords', e.target.value)} placeholder="agendar, turno, cita..." />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <label className={styles.label} style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>Pasos de la Conversación</label>
                      
                      {res.steps.map((step, stepIndex) => (
                        <div key={stepIndex} style={{ display: 'grid', gridTemplateColumns: '1fr 200px 40px', gap: '1rem', alignItems: 'start', padding: '1rem', background: 'var(--color-surface-container-low)', borderRadius: '0.5rem', borderLeft: '4px solid var(--color-primary)' }}>
                          <div className={styles.inputGroup}>
                            <label className={styles.label} style={{ fontSize: '0.7rem' }}>Mensaje del Bot (Paso {stepIndex + 1})</label>
                            <textarea className={styles.input} value={step.response} onChange={e => updateStep(resIndex, stepIndex, 'response', e.target.value)} rows={2} placeholder="Escribe lo que dirá el bot..." />
                          </div>
                          <div className={styles.inputGroup}>
                            <label className={styles.label} style={{ fontSize: '0.7rem' }}>Acción tras este paso</label>
                            <select className={styles.input} value={step.action} onChange={e => updateStep(resIndex, stepIndex, 'action', e.target.value)}>
                              <option value="NONE">Solo responder</option>
                              <option value="READ_PLATE">Leer Placa</option>
                              <option value="READ_SERVICE">Leer Servicio</option>
                              <option value="READ_DATE">Leer Fecha</option>
                              <option value="READ_TIME">Leer Hora</option>
                            </select>
                          </div>
                          <button onClick={() => removeStep(resIndex, stepIndex)} style={{ marginTop: '1.5rem', color: '#94a3b8' }}><Icon name="close" /></button>
                        </div>
                      ))}

                      <button onClick={() => addStep(resIndex)} className={styles.saveBtn} style={{ background: 'transparent', color: 'var(--color-primary)', border: '1px dashed var(--color-primary)', padding: '0.5rem' }}>
                        <Icon name="add" /> Añadir Paso a la Conversación
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Respuesta de Ayuda (Default)</label>
            <textarea className={styles.input} value={defaultResponse} onChange={e => setDefaultResponse(e.target.value)} rows={3} />
          </div>

          <div className={styles.saveRow}>
            {isDirty && !success && (
              <div style={{ color: '#f59e0b', fontSize: '0.875rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: 'auto' }}>
                <Icon name="warning" /> Tienes cambios pendientes de guardar
              </div>
            )}
            {success && <div className={styles.successBox} style={{ marginRight: '1rem' }}><Icon name="check_circle" /> Guardado</div>}
            <button className={styles.saveBtn} onClick={handleSave} disabled={saving}><Icon name={saving ? 'sync' : 'save'} /> {saving ? 'Guardando...' : 'Guardar Configuración'}</button>
          </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
