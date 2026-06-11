const { spawn } = require('child_process');
const http = require('http');

console.log("Iniciando prueba del servidor con shell: true...");

// Levantamos el servidor con shell: true para mayor compatibilidad en Windows
const serverProcess = spawn('node', ['server.js'], {
  cwd: 'c:\\Users\\genes\\OneDrive\\Escritorio\\AutoTech\\emprendiemiento-main\\chat-backend',
  env: { ...process.env, PORT: 5999, GEMINI_API_KEY: 'test-key-mock' },
  shell: true
});

serverProcess.on('error', (err) => {
  console.error("Error al iniciar el proceso hijo:", err);
});

serverProcess.stdout.on('data', (data) => {
  console.log(`[SERVER STDOUT]: ${data.toString().trim()}`);
});

serverProcess.stderr.on('data', (data) => {
  console.error(`[SERVER STDERR]: ${data.toString().trim()}`);
});

// Esperamos 3 segundos para asegurar que el servidor levantó
setTimeout(() => {
  console.log("\n--- Probando GET /health ---");
  const reqHealth = http.request({
    hostname: '127.0.0.1', // usando IP directa
    port: 5999,
    path: '/health',
    method: 'GET'
  }, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      console.log(`Código de estado: ${res.statusCode}`);
      console.log(`Respuesta: ${body}`);
      
      // 2. Probar el endpoint POST /api/chat con cuerpo vacío (debe dar 400)
      console.log("\n--- Probando POST /api/chat con datos vacíos ---");
      const reqChatInvalid = http.request({
        hostname: '127.0.0.1',
        port: 5999,
        path: '/api/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }, (resChat) => {
        let bodyChat = '';
        resChat.on('data', (chunk) => bodyChat += chunk);
        resChat.on('end', () => {
          console.log(`Código de estado: ${resChat.statusCode}`);
          console.log(`Respuesta: ${bodyChat}`);
          
          // Terminar el servidor de manera limpia
          console.log("\nFinalizando servidor y pruebas...");
          serverProcess.kill('SIGINT');
          process.exit(0);
        });
      });
      
      reqChatInvalid.write(JSON.stringify({}));
      reqChatInvalid.end();
    });
  });
  
  reqHealth.on('error', (err) => {
    console.error("Error al conectar con /health:", err.message, err.stack);
    serverProcess.kill();
    process.exit(1);
  });
  
  reqHealth.end();
}, 3000);
