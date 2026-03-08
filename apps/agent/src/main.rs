mod auth;
mod config;
mod storage;

use anyhow::Result;
use auth::{enroll, refresh, SessionTokens};
use config::AgentConfig;
use reqwest::Client;
use tokio::sync::mpsc;
use tokio::time::{self, Duration};
use tokio_stream::wrappers::ReceiverStream;
use tonic::transport::Channel;
use tracing::{error, info, warn};
use uuid::Uuid;

pub mod protocol {
    tonic::include_proto!("julia.agent.v1");
}

use protocol::agent_control_service_client::AgentControlServiceClient;
use protocol::{
    agent_envelope, server_envelope, AgentEnvelope, Heartbeat, TranscribeDone, TranscribeError,
    TranscribeProgress, TranscribeToken,
};

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter("info")
        .with_target(false)
        .compact()
        .init();

    let config = AgentConfig::from_env();
    let http_client = Client::new();

    info!("agent startup");

    loop {
        match run_cycle(&http_client, &config).await {
            Ok(()) => {
                warn!("agent cycle ended, reconnecting in 3s");
            }
            Err(error) => {
                error!(?error, "agent cycle failed, retrying in 5s");
            }
        }

        time::sleep(Duration::from_secs(5)).await;
    }
}

async fn run_cycle(http_client: &Client, config: &AgentConfig) -> Result<()> {
    let tokens = authorize(http_client, config).await?;
    storage::write_session(
        &config.refresh_token_path,
        &storage::StoredSession {
            agent_id: tokens.agent_id.clone(),
            refresh_token: tokens.refresh_token.clone(),
        },
    )
    .await?;

    let session_id = Uuid::new_v4().to_string();
    info!(agent_id = %tokens.agent_id, session_id = %session_id, "agent authorized");

    let channel = Channel::from_shared(config.grpc_endpoint.clone())?.connect().await?;
    let mut client = AgentControlServiceClient::new(channel);

    let (tx, rx) = mpsc::channel::<AgentEnvelope>(128);

    tx.send(build_heartbeat_envelope(&tokens, &session_id, "connected"))
        .await?;

    let response = client.stream_connect(ReceiverStream::new(rx)).await?;
    let mut inbound = response.into_inner();

    let mut heartbeat_interval = time::interval(Duration::from_secs(15));

    loop {
        tokio::select! {
            _ = heartbeat_interval.tick() => {
                let envelope = build_heartbeat_envelope(&tokens, &session_id, "alive");
                if tx.send(envelope).await.is_err() {
                    break;
                }
            }
            inbound_message = inbound.message() => {
                match inbound_message {
                    Ok(Some(message)) => {
                        handle_server_command(message, tx.clone(), tokens.clone(), session_id.clone()).await;
                    }
                    Ok(None) => {
                        warn!(session_id = %session_id, "grpc stream closed by server");
                        break;
                    }
                    Err(error) => {
                        return Err(error.into());
                    }
                }
            }
        }
    }

    Ok(())
}

async fn handle_server_command(
    message: protocol::ServerEnvelope,
    tx: mpsc::Sender<AgentEnvelope>,
    tokens: SessionTokens,
    session_id: String,
) {
    let Some(payload) = message.payload else {
        return;
    };

    if let server_envelope::Payload::TranscribeStart(start) = payload {
        let job_id = message.job_id;
        tokio::spawn(async move {
            if let Err(error) = execute_transcribe_start(start, job_id.clone(), tx.clone(), &tokens, &session_id).await {
                let _ = tx
                    .send(AgentEnvelope {
                        protocol_version: "1.0.0".to_string(),
                        agent_id: tokens.agent_id.clone(),
                        session_id: session_id.clone(),
                        job_id,
                        timestamp_unix_ms: chrono::Utc::now().timestamp_millis(),
                        access_jwt: tokens.access_jwt.clone(),
                        payload: Some(agent_envelope::Payload::Error(TranscribeError {
                            code: "agent_failed".to_string(),
                            message: error.to_string(),
                        })),
                    })
                    .await;
            }
        });
    }
}

async fn execute_transcribe_start(
    start: protocol::TranscribeStart,
    job_id: String,
    tx: mpsc::Sender<AgentEnvelope>,
    tokens: &SessionTokens,
    session_id: &str,
) -> Result<()> {
    send_progress(&tx, tokens, session_id, &job_id, 8, "progressCheckingSelection").await?;

    let first_file = start
        .file_paths
        .first()
        .cloned()
        .ok_or_else(|| anyhow::anyhow!("No file paths provided"))?;

    let save_path = first_file
        .replace(".m4a", ".txt")
        .replace(".opus", ".txt");

    send_progress(&tx, tokens, session_id, &job_id, 35, "progressPreparing").await?;

    let transcript = format!(
        "[Agent transcript]\nJob: {job_id}\nFile: {first_file}\nGenerated: {}",
        chrono::Utc::now().to_rfc3339()
    );

    send_progress(&tx, tokens, session_id, &job_id, 78, "progressTranscribing").await?;

    tx.send(AgentEnvelope {
        protocol_version: "1.0.0".to_string(),
        agent_id: tokens.agent_id.clone(),
        session_id: session_id.to_string(),
        job_id: job_id.clone(),
        timestamp_unix_ms: chrono::Utc::now().timestamp_millis(),
        access_jwt: tokens.access_jwt.clone(),
        payload: Some(agent_envelope::Payload::Token(TranscribeToken {
            text: transcript.clone(),
        })),
    })
    .await?;

    tokio::fs::write(&save_path, &transcript).await?;

    send_progress(&tx, tokens, session_id, &job_id, 100, "progressDone").await?;

    tx.send(AgentEnvelope {
        protocol_version: "1.0.0".to_string(),
        agent_id: tokens.agent_id.clone(),
        session_id: session_id.to_string(),
        job_id,
        timestamp_unix_ms: chrono::Utc::now().timestamp_millis(),
        access_jwt: tokens.access_jwt.clone(),
        payload: Some(agent_envelope::Payload::Done(TranscribeDone {
            source_file: first_file,
            save_path,
            transcript,
        })),
    })
    .await?;

    Ok(())
}

async fn send_progress(
    tx: &mpsc::Sender<AgentEnvelope>,
    tokens: &SessionTokens,
    session_id: &str,
    job_id: &str,
    percent: i32,
    stage: &str,
) -> Result<()> {
    tx.send(AgentEnvelope {
        protocol_version: "1.0.0".to_string(),
        agent_id: tokens.agent_id.clone(),
        session_id: session_id.to_string(),
        job_id: job_id.to_string(),
        timestamp_unix_ms: chrono::Utc::now().timestamp_millis(),
        access_jwt: tokens.access_jwt.clone(),
        payload: Some(agent_envelope::Payload::Progress(TranscribeProgress {
            percent,
            stage: stage.to_string(),
        })),
    })
    .await?;

    Ok(())
}

async fn authorize(http_client: &Client, config: &AgentConfig) -> Result<SessionTokens> {
    if let Some(session) = storage::read_session(&config.refresh_token_path).await {
        if let Ok(tokens) = refresh(
            http_client,
            &config.server_base_url,
            &session.agent_id,
            &session.refresh_token,
        )
        .await
        {
            return Ok(tokens);
        }

        warn!("refresh failed, falling back to enroll");
    }

    enroll(
        http_client,
        &config.server_base_url,
        &config.enrollment_token,
        &config.agent_version,
        &config.agent_display_name,
    )
    .await
}

fn build_heartbeat_envelope(tokens: &SessionTokens, session_id: &str, status: &str) -> AgentEnvelope {
    AgentEnvelope {
        protocol_version: "1.0.0".to_string(),
        agent_id: tokens.agent_id.clone(),
        session_id: session_id.to_string(),
        job_id: String::new(),
        timestamp_unix_ms: chrono::Utc::now().timestamp_millis(),
        access_jwt: tokens.access_jwt.clone(),
        payload: Some(agent_envelope::Payload::Heartbeat(Heartbeat {
            agent_version: "0.1.0".to_string(),
            status: status.to_string(),
        })),
    }
}
