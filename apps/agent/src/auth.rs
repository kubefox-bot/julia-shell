use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug)]
pub struct SessionTokens {
    pub agent_id: String,
    pub access_jwt: String,
    pub refresh_token: String,
    pub expires_in: Option<i64>,
}

#[derive(Serialize)]
struct EnrollRequest<'a> {
    agent_id: &'a str,
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
    expires_in: Option<i64>,
}

impl From<TokenResponse> for SessionTokens {
    fn from(value: TokenResponse) -> Self {
        Self {
            agent_id: value.agent_id,
            access_jwt: value.access_jwt,
            refresh_token: value.refresh_token,
            expires_in: value.expires_in,
        }
    }
}

pub async fn enroll(
    client: &Client,
    server_base_url: &str,
    agent_id: &str,
    enrollment_token: &str,
    agent_version: &str,
    display_name: &str,
) -> Result<SessionTokens> {
    let url = format!("{server_base_url}/api/passport/agent/enroll");
    let payload = EnrollRequest {
        agent_id,
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

    Ok(body.into())
}

pub async fn refresh(
    client: &Client,
    server_base_url: &str,
    agent_id: &str,
    refresh_token: &str,
) -> Result<SessionTokens> {
    let url = format!("{server_base_url}/api/passport/agent/token/refresh");
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

    Ok(body.into())
}

#[cfg(test)]
mod tests {
    use super::{enroll, refresh};
    use reqwest::Client;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    async fn serve_once(
        expected_path: &'static str,
        expected_body_fragment: &'static str,
        response_body: &'static str,
    ) -> String {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind test listener");
        let addr = listener.local_addr().expect("resolve listener addr");

        tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.expect("accept connection");
            let mut buffer = vec![0_u8; 8192];
            let size = socket.read(&mut buffer).await.expect("read request");
            let request = String::from_utf8_lossy(&buffer[..size]);

            assert!(
                request.starts_with(&format!("POST {expected_path} ")),
                "unexpected request line: {request}"
            );
            assert!(
                request.contains(expected_body_fragment),
                "missing payload fragment `{expected_body_fragment}` in request: {request}"
            );

            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                response_body.len(),
                response_body
            );
            socket
                .write_all(response.as_bytes())
                .await
                .expect("write response");
        });

        format!("http://{}", addr)
    }

    #[tokio::test]
    async fn enroll_uses_passport_namespace_and_agent_id() {
        let server_base_url = serve_once(
            "/api/passport/agent/enroll",
            "\"agent_id\":\"agent-a\"",
            "{\"agent_id\":\"agent-a\",\"access_jwt\":\"jwt-1\",\"refresh_token\":\"refresh-1\",\"expires_in\":3600}"
        )
        .await;

        let client = Client::new();
        let session = enroll(
            &client,
            &server_base_url,
            "agent-a",
            "enroll-token",
            "0.1.0",
            "mac-local",
        )
        .await
        .expect("enroll should succeed");

        assert_eq!(session.agent_id, "agent-a");
        assert_eq!(session.access_jwt, "jwt-1");
        assert_eq!(session.refresh_token, "refresh-1");
        assert_eq!(session.expires_in, Some(3600));
    }

    #[tokio::test]
    async fn refresh_uses_passport_namespace() {
        let server_base_url = serve_once(
            "/api/passport/agent/token/refresh",
            "\"agent_id\":\"agent-a\"",
            "{\"agent_id\":\"agent-a\",\"access_jwt\":\"jwt-2\",\"refresh_token\":\"refresh-2\",\"expires_in\":1800}"
        )
        .await;

        let client = Client::new();
        let session = refresh(&client, &server_base_url, "agent-a", "refresh-token")
            .await
            .expect("refresh should succeed");

        assert_eq!(session.agent_id, "agent-a");
        assert_eq!(session.access_jwt, "jwt-2");
        assert_eq!(session.refresh_token, "refresh-2");
        assert_eq!(session.expires_in, Some(1800));
    }
}
