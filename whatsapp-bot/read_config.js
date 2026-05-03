fetch('http://127.0.0.1:3001/api/status/b45117e1-f484-4c7c-868e-57797cec13c1')
  .then(res => res.json())
  .then(data => console.log("STATUS:", data));

// Wait, the API doesn't expose the config directly.
// But I can read the memory of node if I just look at the config file.
const fs = require('fs');
const path = require('path');
const configPath = path.join(process.env.APPDATA || '', 'com.lenovo-thinkpad-x13.tauri-app', 'chatbot-config.json');
try {
  const data = fs.readFileSync(configPath, 'utf8');
  console.log("CONFIG:", data);
} catch (e) {
  console.log("Error reading config:", e);
}
