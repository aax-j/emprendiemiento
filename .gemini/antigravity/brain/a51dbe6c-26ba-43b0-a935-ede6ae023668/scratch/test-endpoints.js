const http = require('http');

const makeRequest = (options, postData) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
};

async function runTests() {
  console.log("=== INICIANDO PRUEBAS DE ENDPOINTS ===");
  
  // Test 1: GET /health
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/health',
      method: 'GET'
    });
    console.log("\n[TEST 1: GET /health]");
    console.log(`Estado esperado: 200, Recibido: ${res.statusCode}`);
    console.log(`Respuesta: ${res.body}`);
  } catch (err) {
    console.error("Test 1 falló:", err.message);
  }

  // Test 2: POST /api/chat sin body
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({}));
    console.log("\n[TEST 2: POST /api/chat (cuerpo vacío)]");
    console.log(`Estado esperado: 400, Recibido: ${res.statusCode}`);
    console.log(`Respuesta: ${res.body}`);
  } catch (err) {
    console.error("Test 2 falló:", err.message);
  }

  // Test 3: POST /api/chat con message vacío
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ id_usuario: 'usuario_test', message: '' }));
    console.log("\n[TEST 3: POST /api/chat (message vacío)]");
    console.log(`Estado esperado: 400, Recibido: ${res.statusCode}`);
    console.log(`Respuesta: ${res.body}`);
  } catch (err) {
    console.error("Test 3 falló:", err.message);
  }

  // Test 4: POST /api/chat con datos válidos pero API key de prueba (debe retornar 500 con error en español de Gemini fallido)
  try {
    const res = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ id_usuario: 'usuario_test', message: 'Hola, ¿cuál es su horario?' }));
    console.log("\n[TEST 4: POST /api/chat (datos válidos, API Key inválida)]");
    console.log(`Estado esperado: 500, Recibido: ${res.statusCode}`);
    console.log(`Respuesta: ${res.body}`);
  } catch (err) {
    console.error("Test 4 falló:", err.message);
  }
}

runTests();
