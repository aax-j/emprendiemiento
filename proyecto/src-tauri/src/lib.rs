use tauri::Manager;
use tauri_plugin_shell::ShellExt;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            let shell = app.shell();
            
            // Obtener la ruta de AppConfig para pasarla al bot
            let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
            let config_path = config_dir.join("chatbot-config.json");
            
            println!("Lanzando sidecar whatsapp-bot con ruta: {:?}", config_path);
            
            /* 
            // Comentado para evitar conflictos en desarrollo con 'npm run dev'
            let sidecar_command = shell.sidecar("whatsapp-bot")
                .map_err(|e| e.to_string())?
                .args([config_path.to_str().unwrap()]); // Pasar la ruta del JSON como argumento
            
            tauri::async_runtime::spawn(async move {
                match sidecar_command.spawn() {
                    Ok((mut _rx, _child)) => {
                        println!("Sidecar whatsapp-bot lanzado correctamente.");
                    }
                    Err(e) => {
                        eprintln!("Error al lanzar el sidecar: {}", e);
                    }
                }
            });
            */

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
