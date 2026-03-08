use std::env;
use std::path::PathBuf;

#[derive(Clone, Debug)]
pub struct AgentConfig {
    pub server_base_url: String,
    pub grpc_endpoint: String,
    pub enrollment_token: String,
    pub refresh_token_path: PathBuf,
    pub agent_version: String,
    pub agent_display_name: String,
}

impl AgentConfig {
    pub fn from_env() -> Self {
        let server_base_url = env::var("JULIA_AGENT_SERVER_URL")
            .unwrap_or_else(|_| "http://127.0.0.1:4321".to_string());

        let grpc_endpoint = env::var("JULIA_AGENT_GRPC_ENDPOINT")
            .unwrap_or_else(|_| "http://127.0.0.1:50051".to_string());

        let enrollment_token = env::var("JULIA_AGENT_ENROLLMENT_TOKEN").unwrap_or_default();

        let refresh_token_path = env::var("JULIA_AGENT_REFRESH_TOKEN_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|_| default_refresh_token_path());

        let agent_version = env::var("JULIA_AGENT_VERSION").unwrap_or_else(|_| "0.1.0".to_string());

        let agent_display_name = env::var("JULIA_AGENT_DISPLAY_NAME")
            .unwrap_or_else(|_| format!("julia-agent-{}", current_platform()));

        Self {
            server_base_url,
            grpc_endpoint,
            enrollment_token,
            refresh_token_path,
            agent_version,
            agent_display_name,
        }
    }
}

fn current_platform() -> &'static str {
    match env::consts::OS {
        "macos" => "macos",
        "linux" => "linux",
        "windows" => "windows",
        other => other,
    }
}

fn default_refresh_token_path() -> PathBuf {
    let home = env::var("HOME")
        .ok()
        .or_else(|| env::var("USERPROFILE").ok());

    if let Some(home_dir) = home {
        return PathBuf::from(home_dir)
            .join(".julia-agent")
            .join("session.json");
    }

    PathBuf::from("./agent-session.json")
}
