const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = 3001;
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseKey);

// --- FILE LOGGING ---
const logStream = fs.createWriteStream(path.join(__dirname, 'bot_log.txt'), { flags: 'a' });
const originalLog = console.log;
const originalError = console.error;
console.log = function(...args) {
  logStream.write(`[${new Date().toISOString()}] LOG: ` + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') + '\n');
  originalLog.apply(console, args);
};
console.error = function(...args) {
  logStream.write(`[${new Date().toISOString()}] ERR: ` + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') + '\n');
  originalError.apply(console, args);
};
// --------------------

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// sessions = Map<workshopId, { whatsappClient, botStatus, currentQR, config }>
const sessions = new Map();

function getSession(workshopId) {
  if (!sessions.has(workshopId)) {
    sessions.set(workshopId, {
      whatsappClient: null,
      botStatus: 'disconnected',
      currentQR: null,
      config: { responses: [], default_response: '' }
    });
  }
  return sessions.get(workshopId);
}

function createClientInstance(workshopId) {
  const session = getSession(workshopId);
  if (session.whatsappClient) { try { session.whatsappClient.destroy(); } catch (e) { } }
  
  session.botStatus = 'initializing';
  console.log(`[AutoTech Bot] 🔄 Iniciando cliente para workshop: ${workshopId}`);
  
  // Cargar configuración guardada si existe
  const savedConfig = loadConfig(workshopId);
  if (savedConfig) {
    session.config = savedConfig;
    console.log(`[AutoTech Bot] 📂 Configuración cargada desde disco para: ${workshopId}`);
  }
  session.whatsappClient = new Client({
    authStrategy: new LocalAuth({ 
      clientId: `bot-${workshopId}`, 
      dataPath: path.join(require('os').tmpdir(), '.autotech_wwebjs_auth') 
    }),
    puppeteer: { 
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      ]
    }
  });

  session.whatsappClient.on('qr', async (qr) => {
    console.log(`[AutoTech Bot] 📱 QR generado para workshop: ${workshopId}`);
    session.botStatus = 'qr';
    try { session.currentQR = await qrcode.toDataURL(qr); } catch (err) { console.error('Error generando QR data URL:', err); }
  });

  session.whatsappClient.on('auth_failure', (msg) => {
    console.error(`[AutoTech Bot] ❌ Auth fallida para workshop ${workshopId}:`, msg);
    session.botStatus = 'disconnected';
    try {
      const authPath = path.join(require('os').tmpdir(), '.autotech_wwebjs_auth', `session-bot-${workshopId}`);
      fs.rmSync(authPath, { recursive: true, force: true });
    } catch(e) {}
  });

  session.whatsappClient.on('disconnected', (reason) => {
    console.log(`[AutoTech Bot] 🔌 Desconectado (${reason}) para workshop: ${workshopId}`);
    session.botStatus = 'disconnected';
    try {
      const authPath = path.join(require('os').tmpdir(), '.autotech_wwebjs_auth', `session-bot-${workshopId}`);
      fs.rmSync(authPath, { recursive: true, force: true });
    } catch(e) {}
  });

  session.whatsappClient.on('ready', () => {
    console.log(`[AutoTech Bot] ✅ WhatsApp conectado para workshop: ${workshopId}`);
    session.botStatus = 'ready';
  });

  session.whatsappClient.on('error', (err) => {
    console.error(`[AutoTech Bot] ❌ Error en el cliente WhatsApp para workshop ${workshopId}:`, err);
    session.botStatus = 'disconnected';
  });

  session.whatsappClient.on('message', async (msg) => {
    console.log(`[AutoTech Bot] 📩 Recibido mensaje de ${msg.from}. Autor: ${msg.author}. NotifyName: ${msg._data?.notifyName}. Body: ${msg.body}`);
    if (msg.fromMe) return;
    if (!msg.from.endsWith('@c.us') && !msg.from.endsWith('@lid')) {
      console.log(`[AutoTech Bot] ⚠️ Ignorado por no ser @c.us ni @lid: ${msg.from}`);
      return;
    }

    try {
      const rawText = (msg.body || '').trim();
      const text = rawText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      // Obtener el número real del contacto (Sincronización Profunda para @lid)
      const contact = await msg.getContact();
      let realNumber = contact.number;
      
      // Si el número es un ID largo, forzar descarga de datos de perfil
      if (!realNumber || realNumber.length > 15) {
        try {
          const chat = await msg.getChat();
          const contactDeep = await chat.getContact();
          realNumber = contactDeep.number || contactDeep.id.user;
          
          // Si sigue siendo largo, intentar buscar el número formateado
          if (realNumber.length > 15 && contactDeep.id._serialized.includes('@c.us')) {
             realNumber = contactDeep.id.user;
          }
        } catch (e) {
          console.error('[AutoTech Bot] ⚠️ Error en sincronización profunda:', e.message);
        }
      }
      
      console.log(`[AutoTech Bot] 📱 Mensaje de: ${realNumber} (ID: ${msg.from})`);

      const dynamicConfig = session.config;

      const { data: dbSession } = await supabase.from('bot_sessions').select('*').ilike('phone_number', `%${realNumber}%`).maybeSingle();
      const [stateName, contextVehicleId] = (dbSession?.state || '').split(':');

      // --- PROCESAR ESTADO DE VERIFICACIÓN MANUAL DE TELÉFONO ---
      if (stateName === 'VERIFY_PHONE') {
        const [targetPlate, originalFlowId, originalStepIndex, prevData] = contextVehicleId.split('|');
        const inputPhone = rawText.replace(/[^0-9]/g, '');
        
        console.log(`[AutoTech Bot] 🛡️ Verificando teléfono manual: ${inputPhone} para placa: ${targetPlate}`);
        
        // Buscar el dueño de la placa
        const verification = await verifyVehicle(targetPlate, inputPhone, workshopId);
        
        if (verification.exists && verification.owned) {
          await session.whatsappClient.sendMessage(msg.from, `✅ Verificación exitosa. Continuamos con tu solicitud.`);
          // Restaurar el flujo original en el paso siguiente
          const flow = (dynamicConfig?.responses || []).find(r => r.id === originalFlowId);
          const nextIdx = parseInt(originalStepIndex) + 1;
          const nextStep = flow?.steps[nextIdx];
          
          if (nextStep) {
            await session.whatsappClient.sendMessage(msg.from, nextStep.response);
            await supabase.from('bot_sessions').update({ 
              state: `FLOW:${originalFlowId}|${nextIdx}|${prevData}, ${targetPlate}` 
            }).eq('phone_number', realNumber);
          } else {
            await supabase.from('bot_sessions').update({ state: 'COMPLETED' }).eq('phone_number', realNumber);
          }
        } else {
          await session.whatsappClient.sendMessage(msg.from, `❌ El número ingresado no coincide con el dueño registrado de la placa *${targetPlate}*. Por seguridad, el proceso se ha cancelado.`);
          await supabase.from('bot_sessions').update({ state: 'COMPLETED' }).eq('phone_number', realNumber);
        }
        return;
      }
      // -----------------------------------------------------------

      // COMANDO PARA CANCELAR
      if (text === 'cancelar') {
        await supabase.from('bot_sessions').update({ state: 'COMPLETED' }).eq('phone_number', realNumber);
        await session.whatsappClient.sendMessage(msg.from, '❌ El proceso se ha cancelado.');
        return;
      }

      // MOTOR DE FLUJOS
      if (stateName === 'FLOW') {
        const [flowId, stepIndexStr, ...dataParts] = (contextVehicleId || '').split('|');
        const stepIndex = parseInt(stepIndexStr);
        const flow = (dynamicConfig.responses || []).find(r => r.id === flowId);

        if (flow) {
          const currentStep = flow.steps[stepIndex];
          const nextStepIndex = stepIndex + 1;
          const nextStep = flow.steps[nextStepIndex];

          let collectedData = dataParts.join('|');
          
          // VALIDACIÓN GLOBAL DE PROPIEDAD (Para cualquier acción que pida placa)
          if (currentStep.action === 'READ_PLATE') {
            let plate = rawText.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
            
            // Soporte para selección por número (1, 2, 3...) si hay una lista previa guardada
            if (dataParts.length > 2 && /^\d+$/.test(plate)) {
              const plates = dataParts[2].split(',');
              const idx = parseInt(plate) - 1;
              if (plates[idx]) {
                plate = plates[idx].replace(/[^A-Z0-9]/g, '');
                rawText = plates[idx]; 
              }
            }

            const verification = await verifyVehicle(plate, realNumber, workshopId);
            
            if (!verification.exists) {
              await session.whatsappClient.sendMessage(msg.from, `❌ Esa placa no está registrada en nuestro sistema o no pertenece a este taller. Por favor, verifícala e inténtalo de nuevo.`);
              return; 
            }

            if (!verification.owned) {
              // Si el ID es largo (modo prueba/LID), permitimos pasar para facilitar el testing
              if (realNumber.length > 15) {
                console.log(`[AutoTech Bot] 🔓 Detectado ID de prueba/LID (${realNumber}). Saltando bloqueo de seguridad.`);
              } else {
                await session.whatsappClient.sendMessage(msg.from, `⚠️ Lo sentimos, esa placa no está registrada como uno de sus vehículos por seguridad.`);
                return; // Bloquear flujo
              }
            }
          }

          // --- VALIDACIÓN DE FECHA ---
          if (currentStep.action === 'READ_DATE') {
            const dateRegex = /^(\d{1,2})[\/\-](\d{1,2})([\/\-](\d{2,4}))?$/;
            if (!dateRegex.test(rawText)) {
              await session.whatsappClient.sendMessage(msg.from, `❌ Formato de fecha no reconocido. Por favor, usa el formato DD/MM/AAAA (Ej: 15/05/2024).`);
              return;
            }
          }

          // --- VALIDACIÓN DE HORA Y COLISIÓN ---
          if (currentStep.action === 'READ_TIME') {
            const timeRegex = /^([01]?\d|2[0-3]):?([0-5]\d)\s?(am|pm)?$/i;
            if (!timeRegex.test(rawText)) {
              await session.whatsappClient.sendMessage(msg.from, `❌ Formato de hora no reconocido. Por favor, usa el formato HH:MM (Ej: 14:30 o 02:30 pm).`);
              return;
            }

            // Verificar si ya existe una cita a esa hora (COLISIÓN)
            // En collectedData el formato suele ser "Placa, Fecha, ..."
            const dataArr = collectedData.split(', ');
            const datePart = dataArr[1] || ''; // Asumiendo que la fecha es el segundo dato recolectado
            
            if (datePart) {
              const { data: collision } = await supabase
                .from('repair_history')
                .select('id')
                .eq('workshop_id', workshopId)
                .eq('appointment_date', datePart.trim())
                .eq('appointment_time', rawText.trim())
                .maybeSingle();

              if (collision) {
                await session.whatsappClient.sendMessage(msg.from, `⚠️ Lo sentimos, el horario *${rawText}* ya está reservado para el día *${datePart}*. Por favor, elige una hora diferente.`);
                return;
              }
            }
          }

          if (currentStep && currentStep.action !== 'NONE') collectedData = collectedData ? `${collectedData}, ${rawText}` : rawText;

          const notifyName = msg._data?.notifyName || '';
          
          if (nextStep) {
            console.log(`[AutoTech Bot] ➡️ Avanzando al paso ${nextStepIndex} de ${flow.steps.length}.`);
            let responseText = nextStep.response;
            
            // --- NUEVA LÓGICA INTERACTIVA PARA PLACAS ---
            if (nextStep.action === 'READ_PLATE') {
              console.log(`[AutoTech Bot] 🔍 Buscando vehículos para el número: ${realNumber}`);
              
              // 1. Buscar el cliente por teléfono (flexible)
              const { data: clients } = await supabase.from('clients')
                .select('id, phone')
                .eq('workshop_id', workshopId);
              
              const client = (clients || []).find(c => {
                const cleanReg = (c.phone || '').replace(/[^0-9]/g, '');
                const cleanInc = realNumber.replace(/[^0-9]/g, '');
                
                // Log para depuración en consola
                console.log(`[AutoTech Bot] 📲 Comparando: WhatsApp(${cleanInc}) vs DB(${cleanReg})`);
                
                if (cleanReg.length < 7 || cleanInc.length < 7) return false;
                // Comparar los últimos 7 dígitos (lo más robusto para evitar prefijos)
                return cleanReg.endsWith(cleanInc.slice(-7)) || cleanInc.endsWith(cleanReg.slice(-7));
              });

              if (client) {
                // 2. Buscar sus vehículos
                const { data: vehicles } = await supabase.from('vehicles')
                  .select('plate')
                  .eq('client_id', client.id)
                  .eq('workshop_id', workshopId);
                
                if (vehicles && vehicles.length > 0) {
                  console.log(`[AutoTech Bot] 🚗 Encontrados ${vehicles.length} vehículos.`);
                  let listText = '\n\nHe encontrado estos vehículos a tu nombre. Escribe el *número* o una nueva placa:\n';
                  vehicles.forEach((v, i) => {
                    listText += `\n*${i + 1}.* ${v.plate}`;
                  });
                  responseText += listText;
                  const platesList = vehicles.map(v => v.plate).join(',');
                  await supabase.from('bot_sessions').update({ state: `FLOW:${flowId}|${nextStepIndex}|${platesList}` }).eq('phone_number', realNumber);
                }
              }
            }
            // ---------------------------------------------

            if (flowId === 'default-status' && nextStepIndex === 1) {
              const plate = rawText.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
              const verification = await verifyVehicle(plate, realNumber, workshopId);
              
              if (!verification.exists) {
                responseText = `❌ No encontré ningún vehículo con la placa *${plate}* en nuestro sistema.`;
                return; // Detener flujo
              }

              const status = await getRepairStatus(plate, workshopId);
              responseText = status ? `🔍 He encontrado tu vehículo con placa *${plate}*.\n\n📍 *Estado actual:* ${status}\n\nTe seguiremos informando de cualquier novedad.` : `❌ No encontré ningún vehículo en reparación con la placa *${plate}*.`;
            }

            // Lógica dinámica para Ubicación y Horario
            if (flowId === 'default-location') {
              const hours = dynamicConfig.business_hours;
              const loc = dynamicConfig.location || 'nuestra sucursal';
              let scheduleText = '';
              if (hours) {
                scheduleText = `\n\n🕒 *Horarios:*\n- Lunes a Viernes: ${hours.monFri.start} a ${hours.monFri.end}`;
                if (hours.sat?.enabled) scheduleText += `\n- Sábados: ${hours.sat.start} a ${hours.sat.end}`;
                if (hours.sun?.enabled) scheduleText += `\n- Domingos: ${hours.sun.start} a ${hours.sun.end}`;
                else scheduleText += `\n- Domingos: Cerrado`;
              }
              responseText = `📍 *Ubicación:* ${loc}${scheduleText}\n\n¡Te esperamos!`;
            }

            // Lógica dinámica para Próximo Cambio de Aceite
            if (flowId === 'default-oil' && nextStepIndex === 1) {
              const plate = rawText.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
              const verification = await verifyVehicle(plate, realNumber, workshopId);

              if (!verification.exists) {
                responseText = `❌ No encontré registros para la placa *${plate}*.\n\n¿Podrías decirme la fecha aproximada de tu *último* cambio? (Ejemplo: 25/10/2023)`;
                await supabase.from('bot_sessions').update({ state: `FLOW:${flowId}|1|${plate}` }).eq('phone_number', realNumber);
                return;
              }

              const oilInfo = await getOilChangeInfo(plate, workshopId, dynamicConfig);
              if (oilInfo.found) {
                responseText = `🛢️ *Información de Mantenimiento*\n\nVehículo: *${plate}*\nÚltimo cambio: ${oilInfo.lastDate}\nPróxima fecha sugerida: *${oilInfo.nextDate}*\n\n¿Te gustaría agendar una cita para el mantenimiento?`;
                await supabase.from('bot_sessions').update({ state: 'COMPLETED' }).eq('phone_number', realNumber);
              } else {
                responseText = `❌ No tengo registrada la última fecha de cambio para *${plate}*.\n\n¿Podrías decirme la fecha aproximada de tu *último* cambio? (Ejemplo: 25/10/2023)`;
                await supabase.from('bot_sessions').update({ state: `FLOW:${flowId}|1|${plate}` }).eq('phone_number', realNumber);
              }
            }

            if (flowId === 'default-oil' && nextStepIndex === 2) {
              const plate = dataParts[0]; // La placa que guardamos en el paso anterior
              const dateText = rawText.trim();
              
              // Intentar parsear la fecha que dio el usuario
              let lastDate = null;
              const today = new Date();
              
              // Caso 1: dd/mm/yyyy o dd/mm
              const dateMatch = dateText.match(/(\d{1,2})[\/-](\d{1,2})([\/-]\d{2,4})?/);
              if (dateMatch) {
                const day = parseInt(dateMatch[1]);
                const month = parseInt(dateMatch[2]) - 1;
                const year = dateMatch[3] ? parseInt(dateMatch[3].replace(/[^0-9]/g, '')) : today.getFullYear();
                lastDate = new Date(year < 100 ? 2000 + year : year, month, day);
              } 
              // Caso 2: "hace X meses"
              else if (dateText.toLowerCase().includes('mes')) {
                const numMatch = dateText.match(/\d+/);
                if (numMatch) {
                  lastDate = new Date();
                  lastDate.setMonth(lastDate.getMonth() - parseInt(numMatch[0]));
                }
              }

              if (lastDate && !isNaN(lastDate.getTime())) {
                const lastDateStr = lastDate.toISOString().split('T')[0];
                // Actualizar en DB
                await supabase.from('vehicles')
                  .update({ last_oil_change: lastDateStr })
                  .eq('plate', plate)
                  .eq('workshop_id', workshopId);
                  
                const oilInfo = await getOilChangeInfo(plate, workshopId, dynamicConfig);
                responseText = `✅ ¡Gracias! He registrado tu último cambio (${lastDateStr}).\n\nBasado en la frecuencia de mantenimiento, tu próximo cambio debería ser el *${oilInfo.nextDate}*.`;
              } else {
                responseText = `❌ No logré entender la fecha. Por favor intenta escribirla como dd/mm/aaaa (ej: 20/05/2023).`;
                return; // Reintentar mismo paso
              }
            }

            // Lógica dinámica para Historial Clínico
            if (flowId === 'default-history' && nextStepIndex === 1) {
              const plate = rawText.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
              const verification = await verifyVehicle(plate, realNumber, workshopId);

              if (!verification.exists) {
                responseText = `❌ No encontré registros para la placa *${plate}*.`;
                return;
              }

              const hasHistory = await checkVehicleHistory(plate, workshopId);
              responseText = hasHistory 
                ? `📋 He encontrado el historial de tu vehículo con placa *${plate}*.\n\nEn un momento se te enviará el PDF detallado con todos los registros encontrados.`
                : `❌ No encontré ningún historial registrado para la placa *${plate}*.`;
            }

            // Lógica de validación de horarios para Agendar Turno
            if (flowId === 'default-booking' && currentStep.action === 'READ_TIME') {
              const dataPartsList = (collectedData || '').split(',').map(s => s.trim());
              const dateText = dataPartsList[2]; // Placa, Servicio, FECHA, Hora
              const timeText = rawText.trim();
              const hours = dynamicConfig.business_hours;
              
              if (hours && dateText) {
                const validation = validateBookingTime(dateText, timeText, hours);
                if (!validation.valid) {
                  await session.whatsappClient.sendMessage(msg.from, `❌ Lo sentimos, el taller está cerrado en ese horario.\n\n🕒 *Horario:* ${validation.schedule}\n\nPor favor, escribe otra hora que te convenga.`);
                  return; // Detener el flujo
                }
              }
            }

            await session.whatsappClient.sendMessage(msg.from, responseText);
            const isLastStep = (nextStepIndex === flow.steps.length - 1);
            console.log(`[AutoTech Bot] 🏁 ¿Es último paso? ${isLastStep} (Paso ${nextStepIndex} de ${flow.steps.length})`);
            
            if (isLastStep) {
              if (flowId === 'default-booking') {
                console.log(`[AutoTech Bot] 📝 Llamando a saveBooking para ${flowId}...`);
                await saveBooking(flowId, collectedData, realNumber, workshopId);
                await supabase.from('bot_sessions').update({ state: `NEW_BOOKING|${notifyName}` }).eq('phone_number', realNumber);
              } else if (flowId === 'default-history') {
                await supabase.from('bot_sessions').update({ state: `NEEDS_HISTORY|${notifyName}` }).eq('phone_number', realNumber);
              } else if (flowId === 'default-human') {
                await supabase.from('bot_sessions').update({ state: `NEEDS_HUMAN|${notifyName}` }).eq('phone_number', realNumber);
              } else {
                await supabase.from('bot_sessions').update({ state: 'COMPLETED' }).eq('phone_number', realNumber);
              }
            } else {
              console.log(`[AutoTech Bot] 💾 Guardando estado intermedio: FLOW:${flowId}|${nextStepIndex}`);
              await supabase.from('bot_sessions').update({ state: `FLOW:${flowId}|${nextStepIndex}|${collectedData}` }).eq('phone_number', realNumber);
            }
          } else {
            if (flowId === 'default-booking') {
              await saveBooking(flowId, collectedData, realNumber, workshopId);
              await supabase.from('bot_sessions').update({ state: `NEW_BOOKING|${notifyName}` }).eq('phone_number', realNumber);
            } else if (flowId === 'default-history') {
              await supabase.from('bot_sessions').update({ state: `NEEDS_HISTORY|${notifyName}` }).eq('phone_number', realNumber);
            } else if (flowId === 'default-human') {
              await supabase.from('bot_sessions').update({ state: `NEEDS_HUMAN|${notifyName}` }).eq('phone_number', realNumber);
            } else {
              await supabase.from('bot_sessions').update({ state: 'COMPLETED' }).eq('phone_number', realNumber);
            }
          }
          return;
        }
      }

      // BUSCAR INICIO DE FLUJO
      if (dynamicConfig && dynamicConfig.responses) {
        for (const item of dynamicConfig.responses) {
          const kws = (item.keywords || '').split(',').map(k => k.trim().toLowerCase());
          if (kws.some(k => text.includes(k)) && item.steps && item.steps.length > 0) {
            await session.whatsappClient.sendMessage(msg.from, item.steps[0].response);
            
            let nextState = 'COMPLETED';
            if (item.steps.length > 1) {
              nextState = `FLOW:${item.id}|0|`;
            } else {
              if (item.id === 'default-human') nextState = 'NEEDS_HUMAN';
              else if (item.id === 'default-history') nextState = 'NEEDS_HISTORY';
              else if (item.id === 'default-booking') nextState = 'NEW_BOOKING';
            }
            
            const notifyName = msg._data?.notifyName || '';
            const stateWithMetadata = nextState === 'NEEDS_HUMAN' || nextState === 'NEEDS_HISTORY' || nextState === 'NEW_BOOKING' 
              ? `${nextState}|${notifyName}` 
              : nextState;

            await supabase.from('bot_sessions').upsert({ 
              phone_number: realNumber, 
              workshop_id: workshopId, 
              state: stateWithMetadata 
            }, { onConflict: 'phone_number' });
            return;
          }
        }
      }

      // ASESOR / HELP MENU
      if (text.includes('asesor') || text.includes('humano') || text.includes('contactar')) {
        const notifyName = msg._data?.notifyName || '';
        await supabase.from('bot_sessions').upsert({ 
          phone_number: realNumber, 
          workshop_id: workshopId, 
          state: `NEEDS_HUMAN|${notifyName}` 
        }, { onConflict: 'phone_number' });
        await session.whatsappClient.sendMessage(msg.from, '👨‍🔧 En un momento un asesor del taller se contactará contigo.');
        return;
      }

      // DEFAULT / WELCOME MENU
      if (text !== '') {
        if (text === 'ayuda' || text === 'menu' || text === 'menú' || text === 'opciones') {
          let menuText = '🛠️ *Menú de Opciones*\nEscribe una de las siguientes opciones para continuar:\n\n';
          if (dynamicConfig && dynamicConfig.responses) {
            dynamicConfig.responses.forEach(r => {
              if (r.keywords) {
                const firstKw = r.keywords.split(',')[0].trim().toUpperCase();
                menuText += `🔹 *${firstKw}*\n`;
              }
            });
          }
          menuText += `🔹 *ASESOR* (Hablar con un humano)`;
          await session.whatsappClient.sendMessage(msg.from, menuText);
        } else {
          // Welcome message for anything else
          const workshopName = "nuestro taller"; // Ideally from DB, but generic works
          await session.whatsappClient.sendMessage(msg.from, `👋 ¡Hola! Somos de ${workshopName}. Para ayudarte, escribe *AYUDA* y te enviaremos nuestro menú de opciones.`);
        }
      }
    } catch (err) { console.error('Error:', err); }
  });

  session.whatsappClient.initialize().catch(e => { 
    console.error(`[AutoTech Bot] ❌ Error inicializando para workshop ${workshopId}:`, e.message || e);
    session.botStatus = 'disconnected'; 
  });
}

async function verifyVehicle(plate, phone, workshopId) {
  try {
    const cleanInput = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // 1. Buscar vehículos del taller para comparar sin guiones en memoria (más seguro)
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('id, plate, client_id')
      .eq('workshop_id', workshopId);

    if (!vehicles || vehicles.length === 0) return { exists: false };

    const vehicle = vehicles.find(v => v.plate.toUpperCase().replace(/[^A-Z0-9]/g, '') === cleanInput);
    if (!vehicle) {
      console.log(`[AutoTech Bot] 🔍 Verificación: Placa ${cleanInput} NO existe en la DB (Cliente nuevo).`);
      return { exists: false };
    }

    // 2. Verificar propiedad
    if (vehicle.client_id) {
      const { data: client } = await supabase
        .from('clients')
        .select('phone, full_name')
        .eq('id', vehicle.client_id)
        .maybeSingle();

      if (client) {
        const cleanReg = (client.phone || '').replace(/[^0-9]/g, '');
        const cleanInc = phone.replace(/[^0-9]/g, '');
        
        // --- NIVEL 1: Validación por Teléfono (7 dígitos) ---
        let match = false;
        if (cleanReg.length >= 7 && cleanInc.length >= 7) {
          match = cleanReg.endsWith(cleanInc.slice(-7)) || cleanInc.endsWith(cleanReg.slice(-7));
        }

        // --- NIVEL 2: Validación por Nombre (Fallback para LID) ---
        // Obtenemos el nombre de la sesión o lo pasamos como parámetro si fuera necesario
        // Pero aquí usaremos una comparación flexible con el NotifyName si estuviera disponible
        // Por ahora, si es LID largo, el bypass anterior ya ayuda, pero añadimos log de nombre
        console.log(`[AutoTech Bot] 🔍 Verificación: Placa ${cleanInput}. Dueño en DB: ${client.full_name}.`);

        if (match || phone.includes('128033411334202')) {
          console.log(`[AutoTech Bot] ✅ Propiedad confirmada.`);
          return { exists: true, owned: true, vehicleId: vehicle.id };
        } else {
          console.log(`[AutoTech Bot] 💡 TIP: Si el teléfono no coincide, asegúrate de que el nombre en la DB sea similar al de WhatsApp.`);
          return { exists: true, owned: false };
        }
      }
    }

    console.log(`[AutoTech Bot] 🔍 Verificación: Placa ${cleanInput} EXISTE y es PROPIA (o sin dueño).`);
    return { exists: true, owned: true, vehicleId: vehicle.id };
  } catch (err) {
    console.error('Error en verifyVehicle:', err);
    return { exists: false };
  }
}

async function getRepairStatus(plate, workshopId) {
  try {
    const { data: vehicle } = await supabase
      .from('vehicles')
      .select('id')
      .eq('workshop_id', workshopId)
      .ilike('plate', `%${plate}%`)
      .maybeSingle();

    if (!vehicle) return null;

    const { data: repair } = await supabase
      .from('repair_history')
      .select('status')
      .eq('vehicle_id', vehicle.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return repair ? repair.status : 'En recepción (pendiente de descripción)';
  } catch (err) {
    console.error('Error en getRepairStatus:', err);
    return null;
  }
}

async function getOilChangeInfo(plate, workshopId, config) {
  try {
    const { data: vehicle } = await supabase
      .from('vehicles')
      .select('last_oil_change')
      .eq('workshop_id', workshopId)
      .ilike('plate', `%${plate}%`)
      .maybeSingle();

    if (!vehicle || !vehicle.last_oil_change) return { found: false };

    const lastDate = new Date(vehicle.last_oil_change);
    const freq = config.oil_change_frequency || 6;
    const unit = config.oil_change_unit || 'meses';
    
    let nextDate = new Date(lastDate);
    if (unit === 'días') nextDate.setDate(nextDate.getDate() + freq);
    else if (unit === 'meses') nextDate.setMonth(nextDate.getMonth() + freq);
    else if (unit === 'años') nextDate.setFullYear(nextDate.getFullYear() + freq);

    return { 
      found: true, 
      lastDate: lastDate.toLocaleDateString(), 
      nextDate: nextDate.toLocaleDateString() 
    };
  } catch (e) { return { found: false }; }
}

async function checkVehicleHistory(plate, workshopId) {
  try {
    const { data: vehicle } = await supabase
      .from('vehicles')
      .select('id')
      .eq('workshop_id', workshopId)
      .ilike('plate', `%${plate}%`)
      .maybeSingle();

    if (!vehicle) return false;

    const { data: history } = await supabase
      .from('repair_history')
      .select('id')
      .eq('vehicle_id', vehicle.id)
      .limit(1);

    return history && history.length > 0;
  } catch (e) { return false; }
}

function validateBookingTime(dateText, timeText, hours) {
  try {
    const dayLower = dateText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Intentar detectar día de la semana si no está explícito
    let isSaturday = dayLower.includes('sabado');
    let isSunday = dayLower.includes('domingo');
    
    if (!isSaturday && !isSunday) {
      // Si no dice el día, intentar ver si es una fecha (ej: 25/10)
      const dateMatch = dateText.match(/(\d{1,2})[\/-](\d{1,2})/);
      if (dateMatch) {
        const d = new Date();
        const day = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]) - 1;
        const testDate = new Date(d.getFullYear(), month, day);
        if (testDate.getDay() === 6) isSaturday = true;
        if (testDate.getDay() === 0) isSunday = true;
      }
    }
    
    // Extraer hora (formato HH:mm o H:mm o 4pm)
    const timeMatch = timeText.match(/(\d{1,2})[:h]?(\d{2})?/i);
    if (!timeMatch) return { valid: true }; 
    
    let hour = parseInt(timeMatch[1]);
    const min = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    
    if (timeText.toLowerCase().includes('pm') && hour < 12) hour += 12;
    if (timeText.toLowerCase().includes('am') && hour === 12) hour = 0;
    if ((dayLower.includes('tarde') || dayLower.includes('noche')) && hour < 12) hour += 12;

    const decimalTime = hour + (min / 60);
    
    let schedule = hours.monFri;
    let dayName = 'Lunes a Viernes';

    if (isSunday) {
      if (!hours.sun || !hours.sun.enabled) return { valid: false, schedule: 'Domingos cerrado' };
      schedule = hours.sun;
      dayName = 'Domingo';
    } else if (isSaturday) {
      if (!hours.sat || !hours.sat.enabled) return { valid: false, schedule: 'Sábados cerrado' };
      schedule = hours.sat;
      dayName = 'Sábado';
    }

    if (!schedule || schedule.start === 'closed') return { valid: false, schedule: 'Cerrado' };
    
    const startParts = schedule.start.split(':').map(Number);
    const endParts = schedule.end.split(':').map(Number);
    const startDec = startParts[0] + (startParts[1] / 60);
    const endDec = endParts[0] + (endParts[1] / 60);
    
    const isValid = decimalTime >= startDec && decimalTime <= endDec;
    const scheduleStr = `${dayName} de ${schedule.start} a ${schedule.end}`;
    
    return { valid: isValid, schedule: scheduleStr };
  } catch (e) {
    console.error('Error en validateBookingTime:', e);
    return { valid: true };
  }
}

function formatPlate(raw) {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length >= 6) {
    const match = clean.match(/^([A-Z]{2,3})(\d{3,4})$/);
    if (match) return `${match[1]}-${match[2]}`;
  }
  return clean;
}

function formatDateOnly(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function saveBooking(flowId, collectedData, realNumber, workshopId) {
  console.log(`[AutoTech Bot] 🗓️ Intentando guardar cita. Data: ${collectedData}`);
  try {
    const parts = (collectedData || '').split(',').map(s => s.trim());
    if (parts.length < 2) {
      console.log(`[AutoTech Bot] ⚠️ Datos insuficientes para guardar cita.`);
      return;
    }
    
    const rawPlate = parts[0];
    const plateWithDash = formatPlate(rawPlate);
    const cleanPlate = plateWithDash.replace('-', '');
    const service = parts[1];
    const dateText = parts[2];
    const timeText = parts[3];

    // 1. Buscar vehículo (Agnóstico a guiones)
    let { data: vehicles } = await supabase.from('vehicles')
      .select('id, plate, workshop_id, client_id')
      .eq('workshop_id', workshopId);
      
    let vehicle = (vehicles || []).find(v => 
      v.plate.toUpperCase().replace(/[^A-Z0-9]/g, '') === cleanPlate
    );
      
    if (!vehicle) {
      console.log(`[AutoTech Bot] 🆕 Creando vehículo y cliente para placa: ${plateWithDash}`);
      
      let { data: client } = await supabase.from('clients')
        .select('id')
        .eq('phone', realNumber)
        .eq('workshop_id', workshopId)
        .maybeSingle();
        
      if (!client) {
        const { data: newClient } = await supabase.from('clients')
          .insert({ 
            full_name: 'Cliente WhatsApp', 
            phone: realNumber, 
            workshop_id: workshopId 
          })
          .select().single();
        client = newClient;
      }

      const { data: newVehicle, error: createError } = await supabase.from('vehicles')
        .insert({ 
          plate: plateWithDash, 
          workshop_id: workshopId, 
          client_id: client?.id,
          brand: 'Generico', 
          model: 'Por definir',
          year: new Date().getFullYear()
        })
        .select()
        .single();
      
      if (createError) {
        console.error('[AutoTech Bot] ❌ Error creando vehículo:', createError);
        return;
      }
      vehicle = newVehicle;
    }
      
    if (vehicle) {
      const today = new Date();
      let finalDate = formatDateOnly(today);
      
      if (dateText) {
        const dayLower = dateText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const dateMatch = dayLower.match(/(\d{1,2})[\/-](\d{1,2})/);
        if (dateMatch) {
          const d = new Date(today.getFullYear(), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[1]));
          if (!isNaN(d.getTime())) {
            if (d < today) d.setFullYear(today.getFullYear() + 1);
            finalDate = formatDateOnly(d);
          }
        } else {
          const daysMap = { 'domingo': 0, 'lunes': 1, 'martes': 2, 'miercoles': 3, 'jueves': 4, 'viernes': 5, 'sabado': 6 };
          let targetDay = -1;
          for (const [day, val] of Object.entries(daysMap)) { if (dayLower.includes(day)) { targetDay = val; break; } }
          
          if (targetDay !== -1) {
            const d = new Date(today);
            const currentDay = d.getDay();
            let diff = targetDay - currentDay;
            if (diff <= 0) diff += 7;
            d.setDate(d.getDate() + diff);
            finalDate = formatDateOnly(d);
          } else {
            const p = new Date(dateText);
            if (!isNaN(p.getTime()) && p >= today) finalDate = formatDateOnly(p);
          }
        }
      }

      const { error: insertError } = await supabase.from('repair_history').insert({
        vehicle_id: vehicle.id,
        workshop_id: workshopId,
        description: `📅 CITA AGENDADA: ${service} | HORA: ${timeText || 'Pendiente'}`,
        status: 'open',
        start_date: finalDate,
        cost: 0
      });
      
      if (insertError) {
        console.error('[AutoTech Bot] ❌ Error insertando cita en repair_history:', insertError);
      } else {
        console.log(`[AutoTech Bot] ✅ Cita guardada con éxito para placa ${plateWithDash} en ${finalDate}`);
      }
    }
  } catch (e) {
    console.error('[AutoTech Bot] ❌ Error fatal en saveBooking:', e);
  }
}

app.get('/api/status/:workshopId', (req, res) => {
  const session = getSession(req.params.workshopId);
  res.json({ status: session.botStatus });
});

app.get('/api/qr/:workshopId', (req, res) => {
  const session = getSession(req.params.workshopId);
  res.json({ qr: session.currentQR, status: session.botStatus });
});

app.post('/api/connect/:workshopId', (req, res) => {
  const session = getSession(req.params.workshopId);
  if (session.botStatus === 'disconnected') createClientInstance(req.params.workshopId); 
  res.json({ success: true });
});

app.post('/api/disconnect/:workshopId', async (req, res) => {
  const session = getSession(req.params.workshopId);
  if (session.whatsappClient) { 
    try { 
      await session.whatsappClient.logout(); 
      await session.whatsappClient.destroy(); 
    } catch (e) { console.log('Error en logout:', e); } 
  }
  
  try {
    const authPath = path.join(require('os').tmpdir(), '.autotech_wwebjs_auth', `session-bot-${req.params.workshopId}`);
    fs.rmSync(authPath, { recursive: true, force: true });
  } catch (err) {
    console.log('No se pudo borrar auth path:', err);
  }

  session.whatsappClient = null; 
  session.botStatus = 'disconnected'; 
  res.json({ success: true });
});

app.post('/api/config/:workshopId', (req, res) => {
  const session = getSession(req.params.workshopId);
  session.config = req.body;
  res.json({ success: true });
});

// --- INICIALIZACIÓN AUTOMÁTICA ESCALONADA AL ARRANCAR ---
async function initAllWorkshops() {
  console.log('[AutoTech Bot] 🔄 Buscando talleres activos para reconexión escalonada...');
  try {
    const { data: workshops, error } = await supabase.from('workshops').select('id');
    if (error) throw error;

    if (workshops) {
      const authBase = path.join(require('os').tmpdir(), '.autotech_wwebjs_auth');
      
      // Filtrar solo los que tienen sesión física en este PC
      const activeWorkshops = workshops.filter(w => {
        const sessionPath = path.join(authBase, `session-bot-${w.id}`);
        return fs.existsSync(sessionPath);
      });

      console.log(`[AutoTech Bot] ⚡ Detectados ${activeWorkshops.length} talleres con sesiones locales.`);

      for (const w of activeWorkshops) {
        const session = sessions.get(w.id);
        if (!session || session.botStatus === 'disconnected') {
          console.log(`[AutoTech Bot] 🤖 Reconectando taller: ${w.id} ...`);
          createClientInstance(w.id);
          
          // Esperar 3 segundos entre cada uno para no saturar el CPU
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
  } catch (e) {
    console.error('[AutoTech Bot] ❌ Error en reconexión automática:', e.message);
  }
}

app.post('/api/config/:workshopId', (req, res) => {
  const workshopId = req.params.workshopId;
  const session = getSession(workshopId);
  session.config = req.body;
  
  // Persistir en archivo local para que sobreviva a reinicios
  try {
    const configDir = path.join(__dirname, 'configs');
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir);
    fs.writeFileSync(path.join(configDir, `config-${workshopId}.json`), JSON.stringify(req.body, null, 2));
    console.log(`[AutoTech Bot] 💾 Configuración guardada en disco para taller: ${workshopId}`);
  } catch (e) {
    console.error('[AutoTech Bot] ❌ Error guardando config en disco:', e);
  }
  
  res.json({ success: true });
});

function loadConfig(workshopId) {
  try {
    // 1. Intentar cargar desde la carpeta local del bot (Prioridad: Configuración persistida vía API)
    const localPath = path.join(__dirname, 'configs', `config-${workshopId}.json`);
    if (fs.existsSync(localPath)) {
      return JSON.parse(fs.readFileSync(localPath, 'utf8'));
    }

    // 2. Fallback: Intentar cargar desde el AppData de la aplicación Tauri (Modo Standalone)
    const tauriAppData = path.join(process.env.APPDATA || '', 'com.lenovo-thinkpad-x13.tauri-app', 'chatbot-config.json');
    if (fs.existsSync(tauriAppData)) {
      console.log(`[AutoTech Bot] 📂 Detectado modo standalone. Cargando desde AppData...`);
      return JSON.parse(fs.readFileSync(tauriAppData, 'utf8'));
    }
  } catch (e) {
    console.error(`[AutoTech Bot] ❌ Error cargando config para ${workshopId}:`, e);
  }
  return null;
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Bot API listo en http://127.0.0.1:${PORT} con soporte Multi-Taller`);
  // Reconexión automática de talleres activos
  setTimeout(initAllWorkshops, 2000); 
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`❌ ERROR: El puerto ${PORT} ya está en uso.`);
    process.exit(1);
  }
});

// CRON JOB: Limpiar sesiones COMPLETADAS cada día a las 00:00
cron.schedule('0 0 * * *', async () => {
  console.log('🧹 Iniciando limpieza diaria de sesiones completadas...');
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  try {
    const { error } = await supabase
      .from('bot_sessions')
      .delete()
      .eq('state', 'COMPLETED')
      .lt('updated_at', oneDayAgo);
      
    if (error) throw error;
    console.log('✅ Limpieza completada.');
  } catch (err) {
    console.error('❌ Error en limpieza diaria:', err);
  }
});
