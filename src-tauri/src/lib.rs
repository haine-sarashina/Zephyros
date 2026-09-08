// Zephyros Tauri Backend Entrypoint

use std::fs;
use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppWindowState {
    #[serde(default)]
    window_x: Option<i32>,
    #[serde(default)]
    window_y: Option<i32>,
    #[serde(default)]
    window_width: Option<u32>,
    #[serde(default)]
    window_height: Option<u32>,
    #[serde(default)]
    is_maximized: bool,
}

fn state_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    Ok(config_dir.join("app-state.json"))
}

#[tauri::command]
fn load_app_state(app: tauri::AppHandle) -> Result<AppWindowState, String> {
    let path = state_path(&app)?;
    if path.exists() {
        let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).map_err(|e| e.to_string())
    } else {
        Ok(AppWindowState::default())
    }
}

fn projects_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    Ok(config_dir.join("projects.json"))
}

#[tauri::command]
fn load_disk_projects(app: tauri::AppHandle) -> Result<String, String> {
    let path = projects_path(&app)?;
    if path.exists() {
        fs::read_to_string(&path).map_err(|e| e.to_string())
    } else {
        Ok("[]".to_string())
    }
}

#[tauri::command]
fn save_disk_projects(app: tauri::AppHandle, json_data: String) -> Result<(), String> {
    let path = projects_path(&app)?;
    fs::write(&path, json_data).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_app_state(app: tauri::AppHandle, state: AppWindowState) -> Result<(), String> {
    let path = state_path(&app)?;
    let json = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Zephyros!", name)
}

#[cfg(target_os = "windows")]
fn silent_command(cmd: &str) -> std::process::Command {
    use std::os::windows::process::CommandExt;
    let mut command = std::process::Command::new(cmd);
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

#[cfg(not(target_os = "windows"))]
fn silent_command(cmd: &str) -> std::process::Command {
    std::process::Command::new(cmd)
}

#[tauri::command]
fn ollama_get_models(url: String) -> Result<String, String> {
    let clean_url = if url.trim().is_empty() {
        "http://127.0.0.1:11434".to_string()
    } else {
        url.trim().trim_end_matches('/').to_string()
    };

    let endpoints = vec![
        format!("{}/api/tags", clean_url),
        format!("{}/api/tags", clean_url.replace("localhost", "127.0.0.1")),
        format!("{}/api/tags", clean_url.replace("127.0.0.1", "localhost")),
    ];

    let mut last_err = String::new();
    for ep in &endpoints {
        match ureq::get(ep).timeout(std::time::Duration::from_secs(4)).call() {
            Ok(resp) => {
                if let Ok(body) = resp.into_string() {
                    return Ok(body);
                }
            }
            Err(e) => {
                last_err = e.to_string();
            }
        }
    }

    // フォールバック: CLI `ollama list` の実行
    let out = silent_command("ollama").args(["list"]).output();
    if let Ok(output) = out {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            let mut models = Vec::new();
            for (i, line) in text.lines().enumerate() {
                if i == 0 { continue; }
                if let Some(name) = line.split_whitespace().next() {
                    if !name.is_empty() {
                        models.push(serde_json::json!({
                            "name": name,
                            "model": name,
                            "size": 0
                        }));
                    }
                }
            }
            let json_res = serde_json::json!({ "models": models });
            return Ok(json_res.to_string());
        }
    }

    Err(format!("Ollama API接続およびCLI実行に失敗しました ({})", last_err))
}

#[tauri::command]
fn ollama_chat_raw(url: String, body: String) -> Result<String, String> {
    let clean_url = if url.trim().is_empty() {
        "http://127.0.0.1:11434".to_string()
    } else {
        url.trim().trim_end_matches('/').to_string()
    };

    let endpoints = vec![
        format!("{}/api/chat", clean_url),
        format!("{}/api/chat", clean_url.replace("localhost", "127.0.0.1")),
        format!("{}/api/chat", clean_url.replace("127.0.0.1", "localhost")),
    ];

    let mut last_err = String::new();
    for ep in &endpoints {
        match ureq::post(ep)
            .set("Content-Type", "application/json")
            .timeout(std::time::Duration::from_secs(300))
            .send_string(&body)
        {
            Ok(resp) => {
                if let Ok(res_str) = resp.into_string() {
                    return Ok(res_str);
                }
            }
            Err(ureq::Error::Status(code, resp)) => {
                let err_body = resp.into_string().unwrap_or_default();
                last_err = format!("HTTP {}: {}", code, err_body);
            }
            Err(e) => {
                last_err = e.to_string();
            }
        }
    }

    Err(format!("Ollama チャットリクエストエラー: {}", last_err))
}

#[tauri::command]
fn ollama_chat_stream_raw(
    app: tauri::AppHandle,
    channel_id: String,
    url: String,
    body: String
) -> Result<String, String> {
    let clean_url = if url.trim().is_empty() {
        "http://127.0.0.1:11434".to_string()
    } else {
        url.trim().trim_end_matches('/').to_string()
    };

    let endpoints = vec![
        format!("{}/api/chat", clean_url),
        format!("{}/api/chat", clean_url.replace("localhost", "127.0.0.1")),
        format!("{}/api/chat", clean_url.replace("127.0.0.1", "localhost")),
    ];

    let mut response = None;
    let mut last_err = String::new();

    for ep in &endpoints {
        match ureq::post(ep)
            .set("Content-Type", "application/json")
            .timeout(std::time::Duration::from_secs(600))
            .send_string(&body)
        {
            Ok(r) => {
                response = Some(r);
                break;
            }
            Err(ureq::Error::Status(code, resp)) => {
                let err_body = resp.into_string().unwrap_or_default();
                last_err = format!("HTTP {}: {}", code, err_body);
            }
            Err(e) => {
                last_err = e.to_string();
            }
        }
    }

    let response = match response {
        Some(r) => r,
        None => return Err(format!("Ollama ストリーミング接続エラー: {}", last_err)),
    };

    use std::io::BufRead;
    use tauri::Emitter;

    let reader = std::io::BufReader::new(response.into_reader());
    let mut full_text = String::new();
    let event_name = format!("ollama-chunk-{}", channel_id);

    for line in reader.lines() {
        if let Ok(line_str) = line {
            if line_str.trim().is_empty() { continue; }
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&line_str) {
                if let Some(chunk) = parsed.get("message").and_then(|m| m.get("content")).and_then(|c| c.as_str()) {
                    full_text.push_str(chunk);
                    let _ = app.emit(&event_name, chunk);
                }
            }
        }
    }

    Ok(full_text)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            load_app_state,
            save_app_state,
            load_disk_projects,
            save_disk_projects,
            ollama_get_models,
            ollama_chat_raw,
            ollama_chat_stream_raw,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

