const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const getAppConfigPath = () => {
  const appId = 'com.lenovo-thinkpad-x13.tauri-app';
  let baseDir = '';
  if (process.platform === 'win32') baseDir = process.env.APPDATA;
  else if (process.platform === 'darwin') baseDir = path.join(process.env.HOME, 'Library', 'Application Support');
  else baseDir = path.join(process.env.HOME, '.config');
  return path.join(baseDir, appId, 'chatbot-config.json');
};

const configPath = process.argv[2] || getAppConfigPath();
const app = express();
const PORT = 3001;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let botStatus = 'disconnected';
let currentQR = null;
let whatsappClient = null;

function createClientInstance() {
  if (whatsappClient) { try { whatsappClient.destroy(); } catch (e) { } }
  botStatus = 'initializing';
  whatsappClient = new Client({
    authStrategy: new LocalAuth({ clientId: 'autotech-bot', dataPath: path.join(__dirname, '.wwebjs_auth') }),
    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
    webVersionCache: { type: 'remote', remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1014581051-alpha.html' }
  });

  whatsappClient.on('qr', async (qr) => {
    botStatus = 'qr';
    try { currentQR = await qrcode.toDataURL(qr); } catch (err) { }
  });

  whatsappClient.on('ready', () => {
    console.log('[AutoTech Bot] ✅ WhatsApp conectado!');
    console.log('[AutoTech Bot] 🚀 v1.4: FLUJOS POR PASOS ACTIVADOS');
    botStatus = 'ready';
  });

  whatsappClient.on('message', async (msg) => {
    if (msg.fromMe) return;
    if (!msg.from.endsWith('@c.us') && !msg.from.endsWith('@lid')) return;

    try {
      const rawText = (msg.body || '').trim();
      const text = rawText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const contact = await msg.getContact();
      const realNumber = contact.number;

      let dynamicConfig = { responses: [], default_response: '' };
      if (fs.existsSync(configPath)) {
        dynamicConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }

      const { data: session } = await supabase.from('bot_sessions').select('*').ilike('phone_number', `%${realNumber}%`).maybeSingle();
      const [stateName, contextVehicleId] = (session?.state || '').split(':');

      // MOTOR DE FLUJOS
      if (stateName === 'FLOW') {
        const [flowId, stepIndexStr, ...dataParts] = (contextVehicleId || '').split('|');
        const stepIndex = parseInt(stepIndexStr);
        const flow = dynamicConfig.responses.find(r => r.id === flowId);

        if (flow) {
          const currentStep = flow.steps[stepIndex];
          const nextStepIndex = stepIndex + 1;
          const nextStep = flow.steps[nextStepIndex];

          let collectedData = dataParts.join('|');
          if (currentStep.action !== 'NONE') collectedData = collectedData ? `${collectedData}, ${rawText}` : rawText;

          if (nextStep) {
            await whatsappClient.sendMessage(msg.from, nextStep.response);
            const isLastStep = (nextStepIndex === flow.steps.length - 1);
            if (isLastStep && flowId === 'default-booking') {
              await saveBooking(flowId, collectedData, realNumber);
              await supabase.from('bot_sessions').update({ state: 'COMPLETED' }).eq('phone_number', realNumber);
            } else {
              await supabase.from('bot_sessions').update({ state: `FLOW:${flowId}|${nextStepIndex}|${collectedData}` }).eq('phone_number', realNumber);
            }
          } else {
            await supabase.from('bot_sessions').update({ state: 'COMPLETED' }).eq('phone_number', realNumber);
          }
          return;
        }
      }

      // BUSCAR INICIO DE FLUJO
      if (dynamicConfig.responses) {
        for (const item of dynamicConfig.responses) {
          const kws = (item.keywords || '').split(',').map(k => k.trim().toLowerCase());
          if (kws.some(k => text.includes(k)) && item.steps?.length > 0) {
            await whatsappClient.sendMessage(msg.from, item.steps[0].response);
            const nextState = item.steps.length > 1 ? `FLOW:${item.id}|0|` : 'COMPLETED';
            await supabase.from('bot_sessions').upsert({ phone_number: realNumber, state: nextState }, { onConflict: 'phone_number' });
            return;
          }
        }
      }

      // DEFAULT
      if (text !== '') {
        await whatsappClient.sendMessage(msg.from, dynamicConfig.default_response || 'No entiendo, pero pronto te ayudaremos. 👨‍🔧');
      }
    } catch (err) { console.error('Error:', err); }
  });

  whatsappClient.initialize().catch(e => { botStatus = 'disconnected'; });
}

async function saveBooking(flowId, collectedData, realNumber) {
  try {
    const [plate, service, dateText, timeText] = (collectedData || '').split(',').map(s => s.trim());
    const { data: vehicle } = await supabase.from('vehicles').select('id, workshop_id').eq('plate', plate.toUpperCase().replace(/-/g, '')).single();
    if (vehicle) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let finalDate = today.toISOString().split('T')[0];
      if (dateText) {
        const p = new Date(dateText);
        if (!isNaN(p.getTime()) && p >= today) finalDate = p.toISOString().split('T')[0];
      }
      await supabase.from('repair_history').insert({
        vehicle_id: vehicle.id,
        workshop_id: vehicle.workshop_id,
        description: `CITA: ${service || 'Mantenimiento'} | HORA: ${timeText || 'No especificada'}`,
        status: 'pendiente',
        start_date: finalDate,
        cost: 0
      });
    }
  } catch (e) { console.error('Error saveBooking:', e); }
}

app.get('/api/status', (req, res) => res.json({ status: botStatus }));
app.get('/api/qr', (req, res) => res.json({ qr: currentQR, status: botStatus }));
app.post('/api/connect', (req, res) => { if (botStatus === 'disconnected') createClientInstance(); res.json({ success: true }); });
app.post('/api/disconnect', async (req, res) => {
  if (whatsappClient) { try { await whatsappClient.logout(); await whatsappClient.destroy(); } catch (e) { } }
  whatsappClient = null; botStatus = 'disconnected'; res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Bot API listo en http://127.0.0.1:${PORT}`));
