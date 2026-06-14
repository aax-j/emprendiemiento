import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Icon } from '../../components/Icon/Icon';
import { getVehiclesByClient } from '../../lib/api/vehicles';
import { getClientConnectedWorkshops } from '../../lib/api/clients';
import { getNearbyWorkshops } from '../../lib/api/workshop_profiles';
import type { Vehicle } from '../../lib/api/vehicles';
import styles from './ClientAssistantWidget.module.css';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

const BACKEND_URL = 'http://localhost:5000/api/chat';
const HEALTH_URL = 'http://localhost:5000/health';

const SUGGESTED_QUERIES = [
  '¿Cuál es el taller más cercano a mí?',
  '¿Qué hago si algo le pasa a mi vehículo?',
  '¿Cuánto cuesta un cambio de aceite?',
  '¿Cómo conecto con un taller en AutoTech?',
];

export const ClientAssistantWidget = () => {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Context data
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [nearbyWorkshops, setNearbyWorkshops] = useState<any[]>([]);
  const [_userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [contextLoaded, setContextLoaded] = useState(false);
  // Conversation state for vehicle disambiguation
  const [pendingVehicleQuery, setPendingVehicleQuery] = useState<string | null>(null);
  
  // Nuevo estado para el vehículo seleccionado
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');

  const chatHistoryEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load user's vehicles and connected workshops
  useEffect(() => {
    if (!profile?.id) return;
    const loadContext = async () => {
      try {
        const [v, w] = await Promise.all([
          getVehiclesByClient(profile.id),
          getClientConnectedWorkshops(profile.id),
        ]);
        setVehicles(v || []);
        setWorkshops(w || []);
      } catch (e) {
        console.error('Error loading assistant context:', e);
      } finally {
        setContextLoaded(true);
      }
    };
    loadContext();
  }, [profile?.id]);

  // Load user's location and nearby workshops quietly on mount
  useEffect(() => {
    const loadNearby = async (lat: number, lng: number) => {
      try {
        const data = await getNearbyWorkshops(lat, lng, 20);
        setNearbyWorkshops(data || []);
      } catch (err) {
        console.error('Error loading nearby workshops for assistant:', err);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserCoords(coords);
          loadNearby(coords.lat, coords.lng);
        },
        () => {
          const riobamba = { lat: -1.6635, lng: -78.6536 };
          setUserCoords(riobamba);
          loadNearby(riobamba.lat, riobamba.lng);
        }
      );
    } else {
      const riobamba = { lat: -1.6635, lng: -78.6536 };
      setUserCoords(riobamba);
      loadNearby(riobamba.lat, riobamba.lng);
    }
  }, []);

  // Sync open state with URL parameter `?chat=true`
  useEffect(() => {
    if (searchParams.get('chat') === 'true') {
      setIsOpen(true);
    }
  }, [searchParams]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        scrollToBottom();
      }, 100);
    }
  }, [isOpen]);

  // Check backend server health status
  useEffect(() => {
    const checkBackendStatus = async () => {
      try {
        const response = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(2000) });
        setIsOnline(response.ok);
      } catch {
        setIsOnline(false);
      } finally {
        setCheckingStatus(false);
      }
    };
    checkBackendStatus();
    const interval = setInterval(checkBackendStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const scrollToBottom = () => {
    chatHistoryEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isTyping, isOpen]);

  // ─── Context-aware mock responder ─────────────────────────────────────────
  const resolveVehicleResponse = (vehicle: Vehicle, originalQuery: string): string => {
    const q = originalQuery.toLowerCase();
    const label = `${vehicle.brand} ${vehicle.model}${vehicle.year ? ` (${vehicle.year})` : ''} — Placa: **${vehicle.plate}**`;

    if (q.includes('aceite') || q.includes('oil')) {
      const lastChange = vehicle.last_oil_change
        ? `El último cambio registrado fue el **${new Date(vehicle.last_oil_change).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}**.`
        : 'No hay registro de un cambio de aceite previo en el sistema.';
      return `Para tu ${label}:\n\n🛢️ ${lastChange}\n\nTe recomiendo consultar con uno de tus talleres conectados para que revisen el kilometraje actual y determinen si es momento de hacer el cambio. ¿Te gustaría ver qué talleres tienes conectados?`;
    }

    if (q.includes('emergencia') || q.includes('pasó') || q.includes('falla') || q.includes('problema') || q.includes('avería') || q.includes('averia') || q.includes('no arranca') || q.includes('accidente') || q.includes('pinchó') || q.includes('pinchazo') || q.includes('llanta')) {
      const workshopList = workshops.length > 0
        ? `\n\nTus talleres conectados que pueden ayudarte:\n${workshops.slice(0, 3).map((c: any) => `🔧 **${c.workshop?.name ?? 'Taller'}**`).join('\n')}\n\nContacta a uno de ellos desde la sección "Mis Conexiones".`
        : '\n\nAún no tienes talleres conectados en AutoTech. Explora el **Directorio de Talleres** para encontrar uno cerca y conectarte.';
      return `Lamento que hayas tenido un problema con tu ${label}. Aquí lo que te recomiendo:\n\n1. 🚨 Si es una emergencia, detente en un lugar seguro y enciende las luces de emergencia.\n2. 📞 Contacta directamente a uno de tus talleres de confianza.${workshopList}`;
    }

    return `Para tu ${label} tengo la siguiente información registrada:\n\n🔖 Placa: **${vehicle.plate}**\n🚗 Vehículo: **${vehicle.brand} ${vehicle.model}** ${vehicle.year ? `(${vehicle.year})` : ''}\n🎨 Color: **${vehicle.color ?? 'No registrado'}**\n🛢️ Último cambio de aceite: **${vehicle.last_oil_change ? new Date(vehicle.last_oil_change).toLocaleDateString('es-MX') : 'Sin registro'}**\n\n¿En qué más puedo ayudarte con este vehículo?`;
  };

  const getMockResponse = (query: string): string => {
    const q = query.toLowerCase().trim();

    // ── Selección de vehículo cuando hay pendiente ────────────────────────────
    if (pendingVehicleQuery !== null) {
      // El usuario está respondiendo cuál vehículo selecciona
      const number = parseInt(q.match(/\d+/)?.[0] ?? '', 10);
      const byName = vehicles.findIndex(v =>
        q.includes(v.plate.toLowerCase()) || q.includes(v.brand.toLowerCase()) || q.includes(v.model.toLowerCase())
      );
      const selectedIdx = !isNaN(number) && number >= 1 && number <= vehicles.length
        ? number - 1
        : byName;

      if (selectedIdx >= 0) {
        const selected = vehicles[selectedIdx];
        const originalQuery = pendingVehicleQuery;
        setPendingVehicleQuery(null);
        return resolveVehicleResponse(selected, originalQuery);
      } else {
        return `No reconocí la selección. Por favor, elige escribiendo el número o la placa de tu vehículo:\n\n${vehicles.map((v, i) => `${i + 1}. ${v.brand} ${v.model} — Placa: ${v.plate}`).join('\n')}`;
      }
    }

    // ── Talleres cercanos / más cercano / conectados ─────────────────────────
    const isNearbyQuery = q.includes('cercan') || q.includes('cerca') || q.includes('alrededor') || q.includes('distancia') || q.includes('próxim') || q.includes('proxim');
    const isConnectedQuery = q.includes('conexion') || q.includes('conexión') || q.includes('conectado') || q.includes('vinculad') || q.includes('mis talleres') || q.includes('mi taller');

    if (isNearbyQuery) {
      if (nearbyWorkshops.length === 0) {
        return `No encontré talleres registrados cerca de ti en un radio de 20 km. 📍\n\nPuedes explorar el **Directorio de Talleres** para buscar talleres en otras ubicaciones.`;
      }
      const list = nearbyWorkshops.map((w: any, i: number) => {
        const dist = w.distance_meters !== undefined
          ? (w.distance_meters < 1000
              ? `${Math.round(w.distance_meters)} m`
              : `${(w.distance_meters / 1000).toFixed(1)} km`)
          : 'Distancia no calculada';
        return `${i + 1}. 🔧 **${w.name}** — ${w.address ?? 'Dirección no registrada'} *(a ${dist})*`;
      }).join('\n');
      return `Aquí tienes los talleres más cercanos a tu ubicación (vinculados o no vinculados a tu cuenta): 📍\n\n${list}\n\nPuedes verlos en el mapa y enviarles solicitudes de conexión desde el **Directorio de Talleres**.`;
    }

    if (isConnectedQuery || q.includes('taller')) {
      if (workshops.length === 0) {
        return `Aún no tienes talleres conectados en AutoTech. 🔍\n\nPuedes explorar el **Directorio de Talleres** dentro de la app para encontrar mecánicos y talleres suscritos a la plataforma. Una vez que les envíes solicitud y te acepten, aparecerán aquí como tus talleres de confianza.`;
      }
      const list = workshops.map((c: any, i: number) => `${i + 1}. 🔧 **${c.workshop?.name ?? 'Taller'}** — ${c.workshop?.address ?? 'Dirección no registrada'}`).join('\n');
      return `Tienes **${workshops.length} taller${workshops.length > 1 ? 'es' : ''} conectado${workshops.length > 1 ? 's' : ''}** en tu lista de confianza:\n\n${list}\n\nPuedes ver más detalles en la sección **"Mis Conexiones"**. ¿Necesitas algo específico de alguno de ellos?`;
    }

    // ── Preguntas relacionadas con vehículos ──────────────────────────────────
    const vehicleKeywords = ['vehiculo', 'vehículo', 'carro', 'auto', 'aceite', 'oil', 'falla', 'problema', 'emergencia', 'pasó', 'avería', 'averia', 'no arranca', 'accidente', 'pinchazo', 'llanta'];
    const isVehicleQuery = vehicleKeywords.some(k => q.includes(k));

    if (isVehicleQuery) {
      if (vehicles.length === 0) {
        return `No tienes vehículos registrados en tu cuenta aún. 🚗\n\nUn taller conectado puede registrar tu vehículo desde su sistema, o puedes solicitar a tu taller de confianza que te agregue como cliente en AutoTech.`;
      }
      if (vehicles.length === 1) {
        return resolveVehicleResponse(vehicles[0], query);
      }
      // Más de un vehículo: preguntar cuál
      setPendingVehicleQuery(query);
      const list = vehicles.map((v, i) => `${i + 1}. ${v.brand} ${v.model}${v.year ? ` (${v.year})` : ''} — Placa: ${v.plate}`).join('\n');
      return `Tienes **${vehicles.length} vehículos registrados**. ¿Sobre cuál me preguntas?\n\n${list}\n\nEscribe el número o la placa del vehículo.`;
    }

    // ── Precios / cotizaciones ────────────────────────────────────────────────
    if (q.includes('precio') || q.includes('costo') || q.includes('cuánto') || q.includes('cuanto') || q.includes('cotiza') || q.includes('presupuesto') || q.includes('cobran')) {
      if (workshops.length === 0) {
        return `Para obtener precios y cotizaciones, primero necesitas conectarte con un taller en AutoTech. Ve al **Directorio de Talleres** y encuentra uno cercano. Los talleres suscritos a la plataforma publican sus servicios y precios.`;
      }
      const list = workshops.slice(0, 2).map((c: any) => `🔧 **${c.workshop?.name ?? 'Taller'}**`).join('\n');
      return `Los precios varían según el taller y el servicio. Te recomiendo contactar directamente a tus talleres conectados para obtener una cotización:\n\n${list}\n\nPuedes encontrar sus datos en **"Mis Conexiones"** dentro de la app.`;
    }

    // ── AutoTech como plataforma ──────────────────────────────────────────────
    if (q.includes('que es autotech') || q.includes('qué es autotech') || q.includes('para que sirve') || q.includes('para qué sirve') || q.includes('autotech')) {
      return `**AutoTech** es una plataforma digital que conecta a **conductores** como tú con **talleres mecánicos** de confianza. 🚗🔧\n\nComo conductor, puedes:\n✅ Encontrar talleres cercanos en el **Directorio**\n✅ Conectarte con tus talleres de confianza\n✅ Ver el historial de servicios de tus vehículos\n✅ Recibir notificaciones de mantenimiento\n\n¿En qué más puedo ayudarte?`;
    }

    // ── Conectar con taller / solicitud ──────────────────────────────────────
    if (q.includes('como conecto') || q.includes('cómo conecto') || q.includes('como me uno') || q.includes('solicitud') || q.includes('unirme') || q.includes('registrar') || q.includes('agregar taller')) {
      return `Para conectarte con un taller en AutoTech es muy sencillo:\n\n1. 📍 Ve a la sección **"Directorio de Talleres"** en el menú lateral.\n2. 🔍 Busca el taller por nombre o ubicación.\n3. 📩 Toca **"Conectarme con este Taller"** y envía la solicitud.\n4. ✅ El taller recibirá tu solicitud y una vez aceptada, quedará en tu lista de **"Mis Conexiones"**.\n\n¿Hay algo más en lo que pueda ayudarte?`;
    }

    // ── Off-topic ─────────────────────────────────────────────────────────────
    const offTopicWords = ['política', 'politica', 'fútbol', 'futbol', 'deporte', 'receta', 'cocina', 'chiste', 'programación', 'programacion', 'historia', 'música', 'musica'];
    if (offTopicWords.some(w => q.includes(w))) {
      return `Soy el asistente de AutoTech y solo puedo ayudarte con temas relacionados a la plataforma: encontrar talleres, consultas sobre tus vehículos, servicios mecánicos o cómo usar la app. 🤖\n\n¿Hay algo relacionado con tu auto o los talleres en lo que pueda ayudarte?`;
    }

    // ── Respuesta genérica ────────────────────────────────────────────────────
    return `¡Hola${profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}! 👋 Soy el asistente de **AutoTech**.\n\nPuedo ayudarte a:\n🔧 Encontrar talleres conectados a la plataforma\n🚗 Consultar información de tus vehículos registrados\n💬 Orientarte sobre qué hacer en caso de fallas o emergencias\n🔗 Explicarte cómo conectarte con un taller\n\n¿Sobre qué te puedo ayudar hoy?`;
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Math.random().toString(36).substring(2, 9),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // If there's a pending vehicle disambiguation, always use mock
    if (pendingVehicleQuery !== null) {
      simulateBotResponse(text);
      return;
    }

    const userId = profile?.client_tag || profile?.id || 'anonymous_client';

    if (isOnline) {
      try {
        // Build a context prefix for the AI to understand the user's data
        const contextPrefix = buildContextPrefix();
        const enrichedMessage = contextPrefix ? `${contextPrefix}\n\nPregunta del usuario: ${text}` : text;
        
        // Find selected vehicle name
        const selectedVehicleName = vehicles.find(v => v.id === selectedVehicleId)?.brand + ' ' + vehicles.find(v => v.id === selectedVehicleId)?.model;

        const payload = { 
          id_usuario: userId, 
          message: enrichedMessage,
          vehiculo_activo: selectedVehicleId ? selectedVehicleName : null,
          latitud: _userCoords?.lat,
          longitud: _userCoords?.lng
        };

        const response = await fetch(BACKEND_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const data = await response.json();
          setMessages(prev => [...prev, {
            id: Math.random().toString(36).substring(2, 9),
            role: 'model',
            content: data.response,
            timestamp: new Date(),
          }]);
        } else {
          throw new Error('API error');
        }
      } catch {
        simulateBotResponse(text);
      } finally {
        setIsTyping(false);
      }
    } else {
      simulateBotResponse(text);
    }
  };

  const buildContextPrefix = (): string => {
    const parts: string[] = [];
    if (vehicles.length > 0) {
      const vehicleList = vehicles.map(v => `${v.brand} ${v.model}${v.year ? ` ${v.year}` : ''} (Placa: ${v.plate})`).join(', ');
      parts.push(`[El cliente tiene ${vehicles.length} vehículo(s) registrado(s): ${vehicleList}]`);
    }
    if (workshops.length > 0) {
      const workshopList = workshops.map((c: any) => c.workshop?.name).filter(Boolean).join(', ');
      parts.push(`[El cliente está conectado con ${workshops.length} taller(es) en AutoTech: ${workshopList}]`);
    }
    if (nearbyWorkshops.length > 0) {
      const nearbyList = nearbyWorkshops.map((w: any) => {
        const dist = w.distance_meters !== undefined
          ? (w.distance_meters < 1000
              ? `${Math.round(w.distance_meters)} metros`
              : `${(w.distance_meters / 1000).toFixed(1)} km`)
          : 'Distancia desconocida';
        return `${w.name} (${w.address ?? 'Sin dirección'}, a ${dist})`;
      }).join(', ');
      parts.push(`[Talleres físicos cercanos al cliente (a menos de 20 km, ordenados por cercanía, pueden estar vinculados o NO vinculados): ${nearbyList}]`);
    }
    if (parts.length === 0) return '';
    return `[CONTEXTO DEL CLIENTE EN AUTOTECH — Plataforma de gestión de talleres mecánicos]: ${parts.join('. ')}. AutoTech conecta conductores con talleres suscritos. No es un taller específico; responde en función de la plataforma y los datos del cliente. Si el usuario pregunta por talleres cercanos, indícale los que están en la lista de cercanos con su distancia, aclarando que no es necesario que estén vinculados/conectados para que aparezcan aquí.`;
  };

  const simulateBotResponse = (userText: string) => {
    setTimeout(() => {
      const simulatedText = getMockResponse(userText);
      setMessages(prev => [...prev, {
        id: Math.random().toString(36).substring(2, 9),
        role: 'model',
        content: simulatedText,
        timestamp: new Date(),
      }]);
      setIsTyping(false);
    }, 900);
  };

  const toggleChat = () => {
    if (isOpen) handleClose();
    else setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    if (searchParams.has('chat')) {
      searchParams.delete('chat');
      setSearchParams(searchParams, { replace: true });
    }
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={styles.widgetContainer}>
      {/* Floating Action Button */}
      <button
        className={`${styles.fab} ${isOpen ? styles.fabOpen : ''}`}
        onClick={toggleChat}
        aria-label="Abrir asistente"
      >
        {!isOpen && <span className={styles.pulseEffect}></span>}
        <Icon name={isOpen ? 'close' : 'smart_toy'} className={styles.fabIcon} />
      </button>

      {/* Chat Window Overlay */}
      {isOpen && (
        <div className={styles.chatWindow}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.botInfo}>
              <div className={styles.avatar}>AT</div>
              <div className={styles.titleContainer}>
                <h3 className={styles.botTitle}>Asistente AutoTech</h3>
                <div className={styles.statusRow}>
                  <span
                    className={styles.statusDot}
                    style={{ backgroundColor: isOnline ? '#10b981' : '#717782' }}
                  />
                  <span className={isOnline ? styles.statusOnline : styles.statusOffline}>
                    {checkingStatus ? '...' : isOnline ? 'Gemini AI' : 'Modo Local'}
                  </span>
                </div>
              </div>
            </div>
            <button className={styles.closeButton} onClick={handleClose} aria-label="Cerrar chat">
              <Icon name="close" style={{ fontSize: '1.25rem' }} />
            </button>
          </div>

          {/* Chat history */}
          <div className={styles.chatHistory}>
            {messages.length === 0 ? (
              <div className={styles.welcomeContainer}>
                <Icon name="smart_toy" className={styles.welcomeIcon} />
                <h4 className={styles.welcomeTitle}>
                  {profile?.full_name ? `¡Hola, ${profile.full_name.split(' ')[0]}!` : '¡Hola!'}
                </h4>
                <p className={styles.welcomeText}>
                  Soy tu asistente de AutoTech. Puedo ayudarte a encontrar talleres, consultar tus vehículos y orientarte en caso de emergencias.
                </p>
                {!contextLoaded ? (
                  <p className={styles.welcomeText} style={{ opacity: 0.5, fontSize: '0.75rem' }}>Cargando tu información…</p>
                ) : (
                  <div className={styles.suggestionsContainer}>
                    <span className={styles.suggestionsTitle}>¿En qué puedo ayudarte?</span>
                    {SUGGESTED_QUERIES.map((query, idx) => (
                      <button
                        key={idx}
                        className={styles.suggestionButton}
                        onClick={() => handleSendMessage(query)}
                        disabled={isTyping || !selectedVehicleId}
                      >
                        {query}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              messages.map(msg => (
                <div
                  key={msg.id}
                  className={`${styles.messageRow} ${msg.role === 'user' ? styles.userRow : styles.assistantRow}`}
                >
                  <div
                    className={`${styles.messageBubble} ${msg.role === 'user' ? styles.userBubble : styles.assistantBubble}`}
                  >
                    {/* Renderizado especial de tarjetas si detectamos talleres */}
                    {msg.role === 'model' && msg.content.includes("Los talleres más cercanos a ti en este momento son:") ? (
                      <div>
                        <p>{msg.content.split('Los talleres más cercanos a ti en este momento son:')[0]}</p>
                        <p style={{ fontWeight: 'bold', margin: '8px 0' }}>Los talleres más cercanos a ti en este momento son:</p>
                        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '4px 0' }}>
                          {nearbyWorkshops.slice(0,3).map((w: any, idx) => (
                             <div key={idx} style={{ minWidth: '180px', padding: '10px', backgroundColor: 'var(--surface-color)', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'var(--text-color)' }}>
                               <strong style={{ display: 'block', marginBottom: '4px' }}>{w.name}</strong>
                               <small style={{ display: 'block', color: 'var(--text-secondary)' }}>{w.address || 'Ubicación cercana'}</small>
                               <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>
                                 {w.horario_apertura ? `${w.horario_apertura} - ${w.horario_cierre}` : 'Horario disponible en app'}
                               </div>
                             </div>
                          ))}
                        </div>
                        <p style={{ marginTop: '8px' }}>¿Te gustaría agendar o vincularte a alguno de ellos?</p>
                      </div>
                    ) : (
                      <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                    )}
                    <span className={styles.messageTime}>{formatTime(msg.timestamp)}</span>
                  </div>
                </div>
              ))
            )}

            {isTyping && (
              <div className={`${styles.messageRow} ${styles.assistantRow}`}>
                <div className={`${styles.messageBubble} ${styles.assistantBubble}`}>
                  <div className={styles.typingIndicator}>
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatHistoryEndRef} />
          </div>

          {/* Input footer */}
          <div className={styles.inputContainer} style={{ flexDirection: 'column', gap: '8px', padding: '12px' }}>
            <div style={{ width: '100%' }}>
              <select 
                value={selectedVehicleId} 
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', color: 'var(--text-color)', fontSize: '0.85rem' }}
              >
                <option value="">-- Selecciona un vehículo para consultar --</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.plate})</option>
                ))}
              </select>
            </div>
            
            <div style={{ display: 'flex', width: '100%', gap: '8px' }}>
              <input
                ref={inputRef}
                type="text"
                className={styles.inputField}
                placeholder={selectedVehicleId ? "Escribe un mensaje..." : "Primero selecciona un vehículo..."}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage(inputValue)}
                disabled={isTyping || !selectedVehicleId}
              />
              <button
                className={styles.sendButton}
                onClick={() => handleSendMessage(inputValue)}
                disabled={!inputValue.trim() || isTyping || !selectedVehicleId}
                aria-label="Enviar"
              >
                <Icon name="send" style={{ fontSize: '1.15rem' }} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
