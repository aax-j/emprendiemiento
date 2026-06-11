/**
 * server.js
 * Servidor Backend Seguro para Chatbot de AutoTech
 * 
 * Este servidor actúa como puente seguro entre la aplicación cliente (cross-platform)
 * y la API de Gemini (v1beta), garantizando el aislamiento del historial de chat
 * de los usuarios y aplicando reglas de negocio estrictas en español.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Inicialización de la aplicación Express
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware para habilitar CORS (Cross-Origin Resource Sharing)
app.use(cors());

// Middleware para procesar cuerpos en formato JSON
app.use(express.json());

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
  const { id_usuario, message } = req.body;

  // 1. Validación de campos requeridos
  if (!id_usuario || typeof id_usuario !== 'string' || id_usuario.trim() === '') {
    return res.status(400).json({
      error: "El campo 'id_usuario' es obligatorio y debe ser un texto no vacío."
    });
  }

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({
      error: "El campo 'message' es obligatorio y debe ser un texto no vacío."
    });
  }

  try {
    // Limpieza de datos recibidos
    const idUsuarioLimpio = id_usuario.trim();
    const mensajeLimpio = message.trim();

    console.log(`[POST /api/chat] Procesando solicitud del usuario: ${idUsuarioLimpio}`);

    // 2. Recuperar el historial aislado de los últimos 6 mensajes del usuario
    const historial = await obtenerHistorial(idUsuarioLimpio, 6);

    // 3. Mapear historial y añadir el nuevo mensaje al formato requerido por Gemini API
    const contents = [
      ...historial.map(msg => ({
        role: msg.rol,
        parts: [{ text: msg.contenido }]
      })),
      {
        role: 'user',
        parts: [{ text: mensajeLimpio }]
      }
    ];

    // 4. Construir payload para la petición HTTP POST nativa (v1beta)
    const payload = {
      contents: contents,
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: GENERATION_CONFIG
    };

    const endpointUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

    // Obtener la clave de API de forma estricta desde variables de entorno
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[Error Interno] No se encontró la variable GEMINI_API_KEY.");
      return res.status(500).json({
        error: "Servicio no disponible temporalmente. La clave de API de Gemini no está configurada."
      });
    }

    console.log(`[Gemini API] Enviando petición para el usuario: ${idUsuarioLimpio}`);

    // Petición HTTP nativa usando global fetch
    const apiResponse = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(payload)
    });

    // Validar respuesta del servicio Gemini
    if (!apiResponse.ok) {
      const errorBody = await apiResponse.text();
      console.error(`[Error de API de Gemini]: Código ${apiResponse.status} - Detalle: ${errorBody}`);
      throw new Error(`La API de Gemini respondió con código de estado ${apiResponse.status}`);
    }

    const data = await apiResponse.json();

    // 5. Extraer la respuesta del chatbot
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiText) {
      console.error("[Error de API de Gemini] La respuesta no contiene candidatos válidos:", JSON.stringify(data));
      throw new Error("No se obtuvo una respuesta textual válida del modelo.");
    }

    // 6. Persistir asíncronamente en la "base de datos" el mensaje del usuario y la respuesta de la IA
    // Se ejecutan de forma secuencial ordenada para asegurar la secuencia temporal correcta en la DB
    await guardarMensaje(idUsuarioLimpio, 'user', mensajeLimpio);
    await guardarMensaje(idUsuarioLimpio, 'model', aiText);

    console.log(`[POST /api/chat] Respuesta de IA generada y guardada con éxito para usuario: ${idUsuarioLimpio}`);

    // 7. Retornar la respuesta al cliente con el formato solicitado
    return res.json({
      response: aiText
    });

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
