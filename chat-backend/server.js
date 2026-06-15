/**
 * server.js
 * Servidor Backend Seguro para Chatbot de AutoTech
 *
 * Este servidor actúa como orquestador de búsquedas en tiempo real.
 * Aplica filtros de White-listing sobre dominios oficiales antes de consultar a Gemini.
 * Flujo: Contexto → Clasificación → Búsqueda Web (RAG) → Generación con fuentes.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const supabase = require('./src/db/supabase');
const maintenanceRoutes = require('./src/routes/maintenance');
const { initCronJobs } = require('./src/workers/cron');
const { buscarInfoTecnica } = require('./src/services/search');

// Inicialización de la aplicación Express
const app = express();
const PORT = process.env.PORT || 5000;


// Middleware para habilitar CORS (Cross-Origin Resource Sharing)
app.use(cors());

// Middleware para procesar cuerpos en formato JSON
app.use(express.json());

// Rutas de mantenimiento
app.use('/api/maintenance', maintenanceRoutes);

// Validación crítica: Verificar que exista la clave de API de Gemini
if (!process.env.GEMINI_API_KEY) {
  console.warn("⚠️  [ADVERTENCIA]: La variable de entorno 'GEMINI_API_KEY' no está configurada.");
  console.warn("Asegúrate de configurar tu clave en el archivo .env o en el entorno del sistema antes de realizar peticiones.");
}

// ============================================================================
// SIMULACIÓN DE BASE DE DATOS Y PERSISTENCIA (EN MEMORIA)
// ============================================================================

// Array en memoria que almacena todos los registros de mensajes.
// Cada elemento tiene la estructura: { id_usuario, rol, contenido, fechaCreacion }
const dbHistorial = [];

/**
 * Guarda un mensaje en el historial del usuario de forma asíncrona.
 * Preparado con async/await para fácil reemplazo por una base de datos real (ej. PostgreSQL, MongoDB).
 * 
 * @param {string} id_usuario - Identificador único del usuario.
 * @param {'user' | 'model'} rol - Rol de quien envía el mensaje ('user' o 'model').
 * @param {string} contenido - El mensaje textual.
 * @returns {Promise<object>} Registro guardado.
 */
async function guardarMensaje(id_usuario, rol, contenido) {
  // Simulación de latencia de red/disco de una base de datos real
  await new Promise(resolve => setTimeout(resolve, 50));

  const nuevoRegistro = {
    id_usuario,
    rol,
    contenido,
    fechaCreacion: new Date()
  };

  dbHistorial.push(nuevoRegistro);
  return nuevoRegistro;
}

/**
 * Obtiene los últimos N mensajes asociados exclusivamente a un usuario.
 * Diseñado con aislamiento matemático estricto para evitar mezclar historiales.
 * 
 * @param {string} id_usuario - Identificador único del usuario.
 * @param {number} limite - Cantidad máxima de mensajes históricos a recuperar.
 * @returns {Promise<Array>} Listado de mensajes filtrados ordenados cronológicamente.
 */
async function obtenerHistorial(id_usuario, limite = 6) {
  // Simulación de latencia de red/disco
  await new Promise(resolve => setTimeout(resolve, 50));

  // Filtramos estrictamente por id_usuario. Es imposible que se mezclen registros de otros usuarios.
  const mensajesUsuario = dbHistorial.filter(msg => msg.id_usuario === id_usuario);

  // Ordenamos cronológicamente de forma ascendente (el más antiguo primero)
  // Aunque push garantiza el orden, el sort añade robustez para base de datos
  mensajesUsuario.sort((a, b) => a.fechaCreacion - b.fechaCreacion);

  // Retornamos únicamente los últimos 'limite' mensajes
  return mensajesUsuario.slice(-limite);
}

// ============================================================================
// CONFIGURACIÓN DE KNOWLEDGE BASE & SYSTEM INSTRUCTIONS (GEMINI)
// ============================================================================

const SYSTEM_INSTRUCTION = {
  parts: [
    {
      text: `Eres el Asistente Oficial de AutoTech, un taller mecánico y tienda de autopartes líder. 
Tu objetivo es responder de manera profesional, amable, precisa y concisa a las consultas de los clientes.

Tus áreas de conocimiento se limitan ESTRICTAMENTE a:
1. Servicios de reparación mecánica, afinación, cambio de aceite, frenos, suspensión y diagnóstico por escáner.
2. Agendamiento de citas de mantenimiento y horarios de atención: Lunes a Viernes de 8:00 AM a 6:00 PM, Sábados de 9:00 AM a 2:00 PM. Domingos cerrado.
3. Venta y disponibilidad de refacciones y autopartes comunes en AutoTech.
4. Consejos generales de cuidado preventivo para vehículos.

REGLAS CRÍTICAS DE COMPORTAMIENTO:
- Si el usuario te hace una pregunta fuera de estos temas (por ejemplo: política, deportes, recetas de cocina, historia, programación, etc.), debes rechazar responder de manera muy educada pero firme, indicando que como asistente de AutoTech solo puedes asistir con consultas relacionadas a servicios automotrices y el taller.
- Mantén tus respuestas breves y al grano (máximo 2 o 3 párrafos).
- Responde siempre en idioma Español de forma profesional y atenta.
- No inventes precios exactos de reparaciones o refacciones; si te preguntan por costos mayores, indícales amablemente que agenden una cita de diagnóstico en el taller.`
    }
  ]
};

// Configuración de los parámetros del modelo Gemini para evitar token bleeding
const GENERATION_CONFIG = {
  temperature: 0.3,
  maxOutputTokens: 400
};

// ============================================================================
// FUNCIONES AUXILIARES PARA ENRUTAMIENTO INTELIGENTE
// ============================================================================

// Clasificador rápido de intención con Gemini
async function clasificarIntencion(mensaje, apiKey) {
  const prompt = `Analiza el siguiente mensaje de un usuario para un taller mecánico.
Clasifícalo EN UNA SOLA PALABRA exacta según estas reglas:
- "HORARIOS": Si pregunta por horarios, si están abiertos, dónde están ubicados o por talleres.
- "MULTIPLES": Si hace más de 1 pregunta técnica distinta en el mismo mensaje.
- "TECNICA": Si es una consulta mecánica simple o normal.

Mensaje: "${mensaje}"
Respuesta (solo la palabra en mayúsculas):`;

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 5 }
      })
    });
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toUpperCase() || 'TECNICA';
  } catch (error) {
    console.error("Error en clasificador:", error);
    return 'TECNICA'; // Fallback a normal
  }
}

// Cálculo de distancia (Fórmula de Haversine)
function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // en km
}

// ============================================================================
// RUTAS DE LA API
// ============================================================================

/**
 * @route GET /health
 * @desc Endpoint para verificar el estado de salud del servidor (monitoreo).
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    servicio: 'AutoTech Chatbot Backend',
    timestamp: new Date()
  });
});

/**
 * @route POST /api/chat
 * @desc Envía un mensaje al chatbot, manteniendo historial aislado del usuario.
 */
app.post('/api/chat', async (req, res) => {
  const { id_usuario, message, vehiculo_activo, latitud, longitud } = req.body;

  // 1. Validación de campos requeridos
  if (!id_usuario || typeof id_usuario !== 'string' || id_usuario.trim() === '') {
    return res.status(400).json({ error: "El campo 'id_usuario' es obligatorio." });
  }
  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: "El campo 'message' es obligatorio." });
  }

  try {
    const idUsuarioLimpio = id_usuario.trim();
    const mensajeLimpio = message.trim();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) throw new Error("GEMINI_API_KEY no configurada.");

    console.log(`[POST /api/chat] Procesando solicitud del usuario: ${idUsuarioLimpio}`);

    // PASO 0: Clasificación de intención (Enrutamiento Inteligente)
    const intencion = await clasificarIntencion(mensajeLimpio, apiKey);
    console.log(`[Intención Detectada]: ${intencion}`);

    // PASO 1: Enrutamiento de Horarios / Talleres
    if (intencion === 'HORARIOS') {
      let respuestaHorarios = "Soy tu asistente virtual de mecánica. Recuerda que AutoTech es una plataforma integral para ayudarte a buscar y gestionar talleres automotrices.\n\nSin embargo, puedo ayudarte a buscar los talleres mecánicos más cercanos a tu ubicación actual.";
      
      // Si enviaron ubicación, buscamos los talleres simulados o en Supabase
      if (latitud && longitud) {
        // Obtenemos talleres (Si no hay talleres en BD, manejamos error gracioso)
        const { data: talleres, error } = await supabase.from('talleres').select('*');
        if (!error && talleres && talleres.length > 0) {
          // Filtrar en radio de 10km
          const talleresCercanos = talleres.filter(t => calcularDistancia(latitud, longitud, t.latitud, t.longitud) <= 10);
          
          if (talleresCercanos.length > 0) {
            respuestaHorarios += "\n\nLos talleres más cercanos a ti en este momento son:\n";
            talleresCercanos.forEach(t => {
              respuestaHorarios += `- **${t.nombre}**: ${t.horario_apertura} - ${t.horario_cierre}\n`;
            });
            respuestaHorarios += "\n¿Te gustaría agendar o vincularte a alguno de ellos?";
          } else {
            respuestaHorarios += "\n\nPor el momento no encuentro talleres registrados a menos de 10km de tu ubicación.";
          }
        } else {
           respuestaHorarios += "\n\n(No hay talleres registrados en la base de datos actualmente para buscar cerca de ti).";
        }
      } else {
        respuestaHorarios += "\n\n(Para mostrarte los talleres más cercanos, la aplicación necesita enviar tu ubicación actual).";
      }

      await guardarMensaje(idUsuarioLimpio, 'user', mensajeLimpio);
      await guardarMensaje(idUsuarioLimpio, 'model', respuestaHorarios);
      return res.json({ response: respuestaHorarios });
    }

    // PASO 2: Manejo de Preguntas Múltiples
    if (intencion === 'MULTIPLES') {
      const respuestaMultiples = "He detectado múltiples consultas en tu mensaje. Para darte la información técnica más precisa paso a paso, ¿cuál de ellas te gustaría resolver primero?";
      await guardarMensaje(idUsuarioLimpio, 'user', mensajeLimpio);
      await guardarMensaje(idUsuarioLimpio, 'model', respuestaMultiples);
      return res.json({ response: respuestaMultiples });
    }

    // PASO 3: Verificación de Vehículo (Filtro Anti-Errores)
    // Si la intención es TECNICA y no tenemos vehiculo_activo, se lo pedimos.
    if (!vehiculo_activo) {
      const respuestaVehiculo = "Para poder brindarte información técnica precisa (como torques, aceites o bujías), por favor selecciona o indícame la Marca, Modelo, Año y Motor de tu vehículo actual.";
      await guardarMensaje(idUsuarioLimpio, 'user', mensajeLimpio);
      await guardarMensaje(idUsuarioLimpio, 'model', respuestaVehiculo);
      return res.json({ response: respuestaVehiculo });
    }

    // PASO 4: GENERACIÓN CON RAG (Búsqueda Web en Tiempo Real)
    const historial = await obtenerHistorial(idUsuarioLimpio, 6);

    // 4a. Buscar información técnica en fuentes oficiales (White-list)
    console.log(`[RAG] Iniciando búsqueda web para: "${mensajeLimpio}" con vehículo: ${vehiculo_activo}`);
    const { contenido: contenidoWeb, fuentes } = await buscarInfoTecnica(vehiculo_activo, mensajeLimpio);

    // 4b. Construir System Instruction con el contexto RAG inyectado
    const instruccionVehiculo = JSON.parse(JSON.stringify(SYSTEM_INSTRUCTION));

    if (contenidoWeb) {
      // RAG activo: instruir al modelo para basarse únicamente en las fuentes oficiales
      const fuentesTexto = fuentes.map((f, i) => `[${i + 1}] ${f.titulo}: ${f.url}`).join('\n');
      instruccionVehiculo.parts[0].text = `Eres el asistente oficial de AutoTech. 
Vehículo del usuario: ${vehiculo_activo}.

Basándote únicamente en los siguientes datos extraídos de fuentes técnicas oficiales, responde la duda del usuario de manera profesional y precisa.
Si los datos no son suficientes para responder con certeza, indícalo honestamente.
Al final de tu respuesta, incluye una sección breve "\n\n🔗 **Fuente(s) Consultada(s):**" con los enlaces de verificación.

====== DATOS OFICIALES EXTRAÍDOS ======
${contenidoWeb}
====== FIN DE DATOS ======

Enlaces de las fuentes:
${fuentesTexto}

REGLAS:
- Responde siempre en Español profesional.
- No inventes datos que no estén en los textos anteriores.
- Sé conciso (máximo 3 párrafos + fuentes).`;
      console.log(`[RAG] Contexto web inyectado con ${fuentes.length} fuente(s) oficial(es).`);
    } else {
      // Fallback: sin RAG, usar conocimiento interno con advertencia
      instruccionVehiculo.parts[0].text += `\n\nATENCIÓN: El usuario tiene seleccionado el vehículo: ${vehiculo_activo}. Usa esta información para basar tus respuestas técnicas. IMPORTANTE: No se encontraron fuentes oficiales verificadas para esta consulta. Responde con tu conocimiento pero indica que el usuario debería verificar en el manual oficial del fabricante.`;
      console.warn(`[RAG] Sin resultados de fuentes oficiales. Usando conocimiento interno del modelo.`);
    }

    const contents = [
      ...historial.map(msg => ({ role: msg.rol, parts: [{ text: msg.contenido }] })),
      { role: 'user', parts: [{ text: mensajeLimpio }] }
    ];

    const payload = {
      contents: contents,
      systemInstruction: instruccionVehiculo,
      generationConfig: GENERATION_CONFIG
    };

    const endpointUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

    const apiResponse = await fetch(endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(payload)
    });

    if (!apiResponse.ok) throw new Error(`API de Gemini respondió con código ${apiResponse.status}`);

    const data = await apiResponse.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiText) throw new Error("No se obtuvo una respuesta válida del modelo.");

    await guardarMensaje(idUsuarioLimpio, 'user', mensajeLimpio);
    await guardarMensaje(idUsuarioLimpio, 'model', aiText);

    return res.json({ response: aiText });

  } catch (error) {
    // Registro interno y seguro del error
    console.error(`[ERROR CRÍTICO EN /api/chat]:`, error);

    // Retorno estructurado al cliente en español
    return res.status(500).json({
      error: "Ocurrió un error interno en el servidor al intentar procesar tu mensaje de chat."
    });
  }
});

// ============================================================================
// MANEJO DE CIERRE GRACIOSO (GRACEFUL SHUTDOWN)
// ============================================================================

const server = app.listen(PORT, () => {
  console.log(`🚀 [Servidor Listo]: Escuchando en http://localhost:${PORT}`);
  console.log(`Aislamiento de chat y endpoints activos. Integrado con Gemini API (gemini-1.5-flash).`);
  
  // Inicializar cron jobs
  initCronJobs();
});

// Captura de señales para cerrar el servidor de manera limpia
const shutdown = () => {
  console.log('\nCerrando servidor Express...');
  server.close(() => {
    console.log('Servidor cerrado. ¡Hasta luego!');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
