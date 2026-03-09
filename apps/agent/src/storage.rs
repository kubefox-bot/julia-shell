use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct StoredSession {
    pub agent_id: String,
    pub refresh_token: String,
    pub access_jwt: Option<String>,
    pub access_token_expires_at: Option<String>,
}

pub async fn read_session(path: &Path) -> Option<StoredSession> {
    let raw = tokio::fs::read_to_string(path).await.ok()?;
    serde_json::from_str::<StoredSession>(&raw).ok()
}

pub async fn write_session(path: &Path, session: &StoredSession) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    let raw =
        serde_json::to_string(session).map_err(|error| std::io::Error::other(error.to_string()))?;

    tokio::fs::write(path, raw).await
}
