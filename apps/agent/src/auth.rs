use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug)]
pub struct SessionTokens {
    pub agent_id: String,
    pub access_jwt: String,
    pub refresh_token: String,
}

#[derive(Serialize)]
struct EnrollRequest<'a> {
    enrollment_token: &'a str,
    device_info: &'a str,
    agent_version: &'a str,
    capabilities: Vec<&'a str>,
}

#[derive(Serialize)]
struct RefreshRequest<'a> {
    agent_id: &'a str,
    refresh_token: &'a str,
}

#[derive(Deserialize)]
struct TokenResponse {
    agent_id: String,
    access_jwt: String,
    refresh_token: String,
}

pub async fn enroll(
    client: &Client,
    server_base_url: &str,
    enrollment_token: &str,
    agent_version: &str,
    display_name: &str,
) -> Result<SessionTokens> {
    let url = format!("{server_base_url}/api/agent/enroll");
    let payload = EnrollRequest {
        enrollment_token,
        device_info: display_name,
        agent_version,
        capabilities: vec!["health", "transcribe"],
    };

    let response = client
        .post(url)
        .json(&payload)
        .send()
        .await
        .context("enroll request failed")?
        .error_for_status()
        .context("enroll rejected by server")?;

    let body: TokenResponse = response
        .json()
        .await
        .context("invalid enroll response payload")?;

    Ok(SessionTokens {
        agent_id: body.agent_id,
        access_jwt: body.access_jwt,
        refresh_token: body.refresh_token,
    })
}

pub async fn refresh(
    client: &Client,
    server_base_url: &str,
    agent_id: &str,
    refresh_token: &str,
) -> Result<SessionTokens> {
    let url = format!("{server_base_url}/api/agent/token/refresh");
    let payload = RefreshRequest {
        agent_id,
        refresh_token,
    };

    let response = client
        .post(url)
        .json(&payload)
        .send()
        .await
        .context("refresh request failed")?
        .error_for_status()
        .context("refresh rejected by server")?;

    let body: TokenResponse = response
        .json()
        .await
        .context("invalid refresh response payload")?;

    Ok(SessionTokens {
        agent_id: body.agent_id,
        access_jwt: body.access_jwt,
        refresh_token: body.refresh_token,
    })
}
