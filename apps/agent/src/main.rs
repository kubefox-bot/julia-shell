mod auth;
mod config;
mod storage;

use anyhow::Result;
use auth::{enroll, refresh, SessionTokens};
use config::AgentConfig;
use reqwest::Client;
use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncRead, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::mpsc;
use tokio::time::{self, Duration};
use tokio_stream::wrappers::ReceiverStream;
use tonic::transport::Channel;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

pub mod protocol {
    tonic::include_proto!("julia.agent.v1");
}

use protocol::agent_control_service_client::AgentControlServiceClient;
use protocol::{
    agent_envelope, server_envelope, widget_command, widget_event, AgentEnvelope, Heartbeat,
    TerminalAgentAssistantChunkEvent, TerminalAgentAssistantDoneEvent, TerminalAgentErrorEvent,
    TerminalAgentResumeFailedEvent, TerminalAgentSendMessageCommand, TerminalAgentStatusEvent,
    TranscribeCancelCommand, TranscribeDoneEvent, TranscribeErrorEvent, TranscribeProgressEvent,
    TranscribeStartCommand, TranscribeTokenEvent, WidgetEvent,
};

const PROTOCOL_VERSION: &str = "1.0.0";
const TRANSCRIBE_WIDGET_ID: &str = "com.yulia.transcribe";
const TERMINAL_AGENT_WIDGET_ID: &str = "com.yulia.terminal-agent";

const PROVIDER_CODEX: i32 = 1;
const PROVIDER_GEMINI: i32 = 2;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ChatProvider {
    Codex,
    Gemini,
}

#[derive(Clone, Copy, Debug)]
enum StreamSource {
    Stdout,
    Stderr,
}

#[tokio::main]
async fn main() -> Result<()> {
    if cfg!(debug_assertions) {
        tracing_subscriber::fmt()
            .with_env_filter("debug")
            .with_target(true)
            .pretty()
            .init();
    }

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
    let access_token_expires_at = tokens.expires_in.and_then(|seconds| {
        if seconds <= 0 {
            return None;
        }

        Some(
            (chrono::Utc::now() + chrono::Duration::seconds(seconds))
                .to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
        )
    });
    storage::write_session(
        &config.refresh_token_path,
        &storage::StoredSession {
            agent_id: tokens.agent_id.clone(),
            refresh_token: tokens.refresh_token.clone(),
            access_jwt: Some(tokens.access_jwt.clone()),
            access_token_expires_at,
        },
    )
    .await?;

    let session_id = Uuid::new_v4().to_string();
    info!(agent_id = %tokens.agent_id, session_id = %session_id, "agent authorized");

    let channel = Channel::from_shared(config.grpc_endpoint.clone())?
        .connect()
        .await?;
    let mut client = AgentControlServiceClient::new(channel);

    let (tx, rx) = mpsc::channel::<AgentEnvelope>(128);

    let heartbeat_tx = tx.clone();
    let heartbeat_tokens = tokens.clone();
    let heartbeat_session_id = session_id.clone();
    let heartbeat_hostname = config.agent_display_name.clone();
    let heartbeat_agent_version = config.agent_version.clone();
    let heartbeat_task = tokio::spawn(async move {
        let connected = build_heartbeat_envelope(
            &heartbeat_tokens,
            &heartbeat_session_id,
            "connected",
            &heartbeat_hostname,
            &heartbeat_agent_version,
        );
        if heartbeat_tx.send(connected).await.is_err() {
            warn!(session_id = %heartbeat_session_id, "failed to send initial heartbeat");
            return;
        }

        loop {
            time::sleep(Duration::from_secs(15)).await;
            let envelope = build_heartbeat_envelope(
                &heartbeat_tokens,
                &heartbeat_session_id,
                "alive",
                &heartbeat_hostname,
                &heartbeat_agent_version,
            );
            match time::timeout(Duration::from_secs(2), heartbeat_tx.send(envelope)).await {
                Ok(Ok(())) => {
                    debug!(session_id = %heartbeat_session_id, "heartbeat queued");
                }
                Ok(Err(_)) => {
                    warn!(session_id = %heartbeat_session_id, "heartbeat channel closed");
                    break;
                }
                Err(_) => {
                    warn!(session_id = %heartbeat_session_id, "heartbeat enqueue timeout");
                }
            }
        }
    });

    let response = match client.stream_connect(ReceiverStream::new(rx)).await {
        Ok(response) => response,
        Err(error) => {
            heartbeat_task.abort();
            return Err(error.into());
        }
    };
    let mut inbound = response.into_inner();

    loop {
        match inbound.message().await {
            Ok(Some(message)) => {
                handle_server_command(message, tx.clone(), tokens.clone(), session_id.clone())
                    .await;
            }
            Ok(None) => {
                warn!(session_id = %session_id, "grpc stream closed by server");
                break;
            }
            Err(error) => {
                heartbeat_task.abort();
                return Err(error.into());
            }
        }
    }

    heartbeat_task.abort();

    Ok(())
}

async fn handle_server_command(
    message: protocol::ServerEnvelope,
    tx: mpsc::Sender<AgentEnvelope>,
    tokens: SessionTokens,
    session_id: String,
) {
    let server_job_id = message.job_id.clone();
    let Some(payload) = message.payload else {
        debug!("server envelope without payload ignored");
        return;
    };

    let job_id = message.job_id;

    match payload {
        server_envelope::Payload::WidgetCommand(command) => {
            let widget_id = command.widget_id.trim().to_string();
            info!(
                job_id = %server_job_id,
                widget_id = %widget_id,
                "received widget command"
            );
            tokio::spawn(async move {
                if let Err(error) = execute_widget_command(
                    command,
                    job_id.clone(),
                    tx.clone(),
                    &tokens,
                    &session_id,
                )
                .await
                {
                    let target_widget_id = if widget_id.is_empty() {
                        TERMINAL_AGENT_WIDGET_ID
                    } else {
                        widget_id.as_str()
                    };

                    let _ = send_widget_execution_error(
                        &tx,
                        &tokens,
                        &session_id,
                        &job_id,
                        target_widget_id,
                        "agent_failed",
                        &error.to_string(),
                    )
                    .await;
                }
            });
        }
        server_envelope::Payload::TranscribeStart(start) => {
            info!(job_id = %server_job_id, "received legacy transcribe_start command");
            tokio::spawn(async move {
                if let Err(error) = execute_transcribe_start(
                    start,
                    job_id.clone(),
                    tx.clone(),
                    &tokens,
                    &session_id,
                )
                .await
                {
                    let _ = send_widget_execution_error(
                        &tx,
                        &tokens,
                        &session_id,
                        &job_id,
                        TRANSCRIBE_WIDGET_ID,
                        "agent_failed",
                        &error.to_string(),
                    )
                    .await;
                }
            });
        }
        server_envelope::Payload::TranscribeCancel(cancel) => {
            info!(job_id = %server_job_id, "received legacy transcribe_cancel command");
            let command = protocol::WidgetCommand {
                widget_id: TRANSCRIBE_WIDGET_ID.to_string(),
                payload: Some(widget_command::Payload::TranscribeCancel(
                    TranscribeCancelCommand {
                        reason: cancel.reason,
                    },
                )),
            };
            tokio::spawn(async move {
                if let Err(error) = execute_widget_command(
                    command,
                    job_id.clone(),
                    tx.clone(),
                    &tokens,
                    &session_id,
                )
                .await
                {
                    let _ = send_widget_execution_error(
                        &tx,
                        &tokens,
                        &session_id,
                        &job_id,
                        TRANSCRIBE_WIDGET_ID,
                        "agent_failed",
                        &error.to_string(),
                    )
                    .await;
                }
            });
        }
        other => {
            debug!(
                job_id = %server_job_id,
                payload = ?other,
                "received unsupported server payload"
            );
        }
    }
}

async fn execute_widget_command(
    command: protocol::WidgetCommand,
    job_id: String,
    tx: mpsc::Sender<AgentEnvelope>,
    tokens: &SessionTokens,
    session_id: &str,
) -> Result<()> {
    let Some(payload) = command.payload else {
        debug!(job_id = %job_id, widget_id = %command.widget_id, "widget command without payload ignored");
        return Ok(());
    };

    match payload {
        widget_command::Payload::TranscribeStart(start) => {
            debug!(job_id = %job_id, "execute transcribe_start");
            execute_transcribe_start(start, job_id, tx, tokens, session_id).await
        }
        widget_command::Payload::TranscribeCancel(_cancel) => {
            debug!(job_id = %job_id, "execute transcribe_cancel");
            send_widget_event(
                &tx,
                tokens,
                session_id,
                &job_id,
                TRANSCRIBE_WIDGET_ID,
                widget_event::Payload::TranscribeError(TranscribeErrorEvent {
                    code: "cancel_not_implemented".to_string(),
                    message: "Transcribe cancel is not implemented in agent v1.".to_string(),
                }),
            )
            .await?;
            Ok(())
        }
        widget_command::Payload::TerminalAgentSendMessage(send_message) => {
            debug!(job_id = %job_id, "execute terminal_agent_send_message");
            execute_terminal_agent_message(send_message, job_id, tx, tokens, session_id).await
        }
        widget_command::Payload::TerminalAgentResetDialog(_reset) => {
            debug!(job_id = %job_id, "execute terminal_agent_reset_dialog");
            send_widget_event(
                &tx,
                tokens,
                session_id,
                &job_id,
                TERMINAL_AGENT_WIDGET_ID,
                widget_event::Payload::TerminalAgentStatus(TerminalAgentStatusEvent {
                    status: "idle".to_string(),
                    detail: "Dialog reset accepted.".to_string(),
                }),
            )
            .await?;
            Ok(())
        }
    }
}

async fn execute_transcribe_start(
    start: TranscribeStartCommand,
    job_id: String,
    tx: mpsc::Sender<AgentEnvelope>,
    tokens: &SessionTokens,
    session_id: &str,
) -> Result<()> {
    send_widget_event(
        &tx,
        tokens,
        session_id,
        &job_id,
        TRANSCRIBE_WIDGET_ID,
        widget_event::Payload::TranscribeProgress(TranscribeProgressEvent {
            percent: 8,
            stage: "progressCheckingSelection".to_string(),
        }),
    )
    .await?;

    let first_file = start
        .file_paths
        .first()
        .cloned()
        .ok_or_else(|| anyhow::anyhow!("No file paths provided"))?;

    let save_path = first_file.replace(".m4a", ".txt").replace(".opus", ".txt");

    send_widget_event(
        &tx,
        tokens,
        session_id,
        &job_id,
        TRANSCRIBE_WIDGET_ID,
        widget_event::Payload::TranscribeProgress(TranscribeProgressEvent {
            percent: 35,
            stage: "progressPreparing".to_string(),
        }),
    )
    .await?;

    let transcript = format!(
        "[Agent transcript]\nJob: {job_id}\nFile: {first_file}\nGenerated: {}",
        chrono::Utc::now().to_rfc3339()
    );

    send_widget_event(
        &tx,
        tokens,
        session_id,
        &job_id,
        TRANSCRIBE_WIDGET_ID,
        widget_event::Payload::TranscribeProgress(TranscribeProgressEvent {
            percent: 78,
            stage: "progressTranscribing".to_string(),
        }),
    )
    .await?;

    send_widget_event(
        &tx,
        tokens,
        session_id,
        &job_id,
        TRANSCRIBE_WIDGET_ID,
        widget_event::Payload::TranscribeToken(TranscribeTokenEvent {
            text: transcript.clone(),
        }),
    )
    .await?;

    tokio::fs::write(&save_path, &transcript).await?;

    send_widget_event(
        &tx,
        tokens,
        session_id,
        &job_id,
        TRANSCRIBE_WIDGET_ID,
        widget_event::Payload::TranscribeProgress(TranscribeProgressEvent {
            percent: 100,
            stage: "progressDone".to_string(),
        }),
    )
    .await?;

    send_widget_event(
        &tx,
        tokens,
        session_id,
        &job_id,
        TRANSCRIBE_WIDGET_ID,
        widget_event::Payload::TranscribeDone(TranscribeDoneEvent {
            source_file: first_file,
            save_path,
            transcript,
        }),
    )
    .await?;

    Ok(())
}

async fn execute_terminal_agent_message(
    command: TerminalAgentSendMessageCommand,
    job_id: String,
    tx: mpsc::Sender<AgentEnvelope>,
    tokens: &SessionTokens,
    session_id: &str,
) -> Result<()> {
    let message = command.message.trim().to_string();
    if message.is_empty() {
        send_terminal_error(
            &tx,
            tokens,
            session_id,
            &job_id,
            "invalid_message",
            "Message is required.",
        )
        .await?;
        return Ok(());
    }

    let provider = match command.provider {
        PROVIDER_CODEX => ChatProvider::Codex,
        PROVIDER_GEMINI => ChatProvider::Gemini,
        _ => {
            send_terminal_error(
                &tx,
                tokens,
                session_id,
                &job_id,
                "invalid_provider",
                "Provider is not supported.",
            )
            .await?;
            return Ok(());
        }
    };

    let resume_requested = !command.resume_ref.trim().is_empty();
    if resume_requested {
        send_terminal_status(
            &tx,
            tokens,
            session_id,
            &job_id,
            "resuming",
            "Trying to resume dialog context.",
        )
        .await?;
    }

    send_terminal_status(
        &tx,
        tokens,
        session_id,
        &job_id,
        "running",
        match provider {
            ChatProvider::Codex => "Running Codex CLI.",
            ChatProvider::Gemini => "Running Gemini CLI.",
        },
    )
    .await?;

    let (program, args) = build_provider_args(&command, provider, &message);
    let mut child = spawn_provider_process(
        &program,
        &args,
        command.api_key.trim(),
        provider,
        command.use_shell_fallback,
        command.shell_override.trim(),
    )
    .await?;

    let mut provider_ref: Option<String> = None;
    let mut sent_any_chunk = false;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| anyhow::anyhow!("stdout is unavailable"))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| anyhow::anyhow!("stderr is unavailable"))?;

    let (line_tx, mut line_rx) = mpsc::channel::<(StreamSource, String)>(256);
    tokio::spawn(read_lines(stdout, StreamSource::Stdout, line_tx.clone()));
    tokio::spawn(read_lines(stderr, StreamSource::Stderr, line_tx.clone()));
    drop(line_tx);

    while let Some((source, line)) = line_rx.recv().await {
        if let Some(value) = parse_json_line(&line) {
            if provider_ref.is_none() {
                provider_ref = extract_session_ref(&value);
            }

            if let Some(status) = extract_status(&value) {
                send_terminal_status(&tx, tokens, session_id, &job_id, &status, "").await?;
            }

            if let Some(chunk) = extract_assistant_chunk(&value) {
                sent_any_chunk = true;
                send_terminal_chunk(&tx, tokens, session_id, &job_id, &chunk).await?;
                continue;
            }

            if matches!(source, StreamSource::Stderr) {
                let detail = stringify_json(&value);
                if !detail.trim().is_empty() {
                    send_terminal_status(&tx, tokens, session_id, &job_id, "tool_call", &detail)
                        .await?;
                }
            }

            continue;
        }

        let text = line.trim();
        if text.is_empty() {
            continue;
        }

        if matches!(source, StreamSource::Stdout) {
            sent_any_chunk = true;
            send_terminal_chunk(&tx, tokens, session_id, &job_id, text).await?;
        } else {
            send_terminal_status(&tx, tokens, session_id, &job_id, "tool_call", text).await?;
        }
    }

    let exit_status = child.wait().await?;

    if !exit_status.success() {
        let code = exit_status
            .code()
            .map(|value| value.to_string())
            .unwrap_or_else(|| "terminated".to_string());

        if resume_requested && provider == ChatProvider::Gemini {
            send_widget_event(
                &tx,
                tokens,
                session_id,
                &job_id,
                TERMINAL_AGENT_WIDGET_ID,
                widget_event::Payload::TerminalAgentResumeFailed(TerminalAgentResumeFailedEvent {
                    reason: format!("Gemini resume failed (exit code: {code})."),
                }),
            )
            .await?;
        }

        send_terminal_error(
            &tx,
            tokens,
            session_id,
            &job_id,
            "provider_exit_error",
            &format!("Provider exited with code: {code}"),
        )
        .await?;
        return Ok(());
    }

    if !sent_any_chunk {
        send_terminal_chunk(&tx, tokens, session_id, &job_id, "Done.").await?;
    }

    send_widget_event(
        &tx,
        tokens,
        session_id,
        &job_id,
        TERMINAL_AGENT_WIDGET_ID,
        widget_event::Payload::TerminalAgentAssistantDone(TerminalAgentAssistantDoneEvent {
            provider_ref: provider_ref
                .or_else(|| {
                    let existing = command.resume_ref.trim();
                    if existing.is_empty() {
                        None
                    } else {
                        Some(existing.to_string())
                    }
                })
                .unwrap_or_default(),
            finish_reason: "completed".to_string(),
        }),
    )
    .await?;

    Ok(())
}

fn build_provider_args(
    command: &TerminalAgentSendMessageCommand,
    provider: ChatProvider,
    message: &str,
) -> (String, Vec<String>) {
    let mut args = command.command_args.clone();

    match provider {
        ChatProvider::Codex => {
            if !command.resume_ref.trim().is_empty() {
                args.extend([
                    "exec".to_string(),
                    "resume".to_string(),
                    command.resume_ref.trim().to_string(),
                    message.to_string(),
                    "--json".to_string(),
                ]);
            } else {
                args.extend([
                    "exec".to_string(),
                    message.to_string(),
                    "--json".to_string(),
                ]);
            }
        }
        ChatProvider::Gemini => {
            if !command.resume_ref.trim().is_empty() {
                args.extend([
                    "--resume".to_string(),
                    command.resume_ref.trim().to_string(),
                ]);
            }

            args.extend(["--prompt".to_string(), message.to_string()]);
            if !args.iter().any(|entry| entry == "--output-format") {
                args.extend(["--output-format".to_string(), "stream-json".to_string()]);
            }
        }
    }

    let program = if command.command_path.trim().is_empty() {
        match provider {
            ChatProvider::Codex => "codex".to_string(),
            ChatProvider::Gemini => "gemini".to_string(),
        }
    } else {
        command.command_path.trim().to_string()
    };

    (program, args)
}

async fn spawn_provider_process(
    program: &str,
    args: &[String],
    api_key: &str,
    provider: ChatProvider,
    use_shell_fallback: bool,
    shell_override: &str,
) -> Result<Child> {
    validate_spawn_input(program, args)?;

    match spawn_direct(program, args, api_key, provider) {
        Ok(child) => Ok(child),
        Err(direct_error) => {
            if !use_shell_fallback {
                return Err(direct_error);
            }

            warn!(error = %direct_error, "direct provider spawn failed, using shell fallback");
            spawn_via_shell(program, args, api_key, provider, shell_override)
        }
    }
}

fn spawn_direct(
    program: &str,
    args: &[String],
    api_key: &str,
    provider: ChatProvider,
) -> Result<Child> {
    let mut command = Command::new(program);
    command.args(args);
    command.stdin(std::process::Stdio::null());
    command.stdout(std::process::Stdio::piped());
    command.stderr(std::process::Stdio::piped());

    apply_provider_env(&mut command, api_key, provider);
    apply_hidden_window(&mut command);

    command.spawn().map_err(|error| error.into())
}

fn spawn_via_shell(
    program: &str,
    args: &[String],
    api_key: &str,
    provider: ChatProvider,
    shell_override: &str,
) -> Result<Child> {
    let line = shell_line(program, args);

    #[cfg(target_os = "windows")]
    {
        let candidates = if shell_override.trim().is_empty() {
            vec!["pwsh".to_string(), "powershell".to_string()]
        } else {
            vec![shell_override.trim().to_string()]
        };

        let mut last_error: Option<anyhow::Error> = None;
        for shell in candidates {
            let args = vec![
                "-NoProfile".to_string(),
                "-Command".to_string(),
                line.clone(),
            ];
            match spawn_shell_command(&shell, &args, api_key, provider) {
                Ok(child) => return Ok(child),
                Err(error) => {
                    last_error = Some(error);
                }
            }
        }

        if let Some(error) = last_error {
            return Err(error);
        }

        return Err(anyhow::anyhow!("no shell candidate available on Windows"));
    }

    #[cfg(not(target_os = "windows"))]
    {
        let shell = if shell_override.trim().is_empty() {
            "/bin/zsh".to_string()
        } else {
            shell_override.trim().to_string()
        };

        spawn_shell_command(&shell, &["-lc".to_string(), line], api_key, provider)
    }
}

fn spawn_shell_command(
    shell_program: &str,
    shell_args: &[String],
    api_key: &str,
    provider: ChatProvider,
) -> Result<Child> {
    let mut command = Command::new(shell_program);
    command.args(shell_args);
    command.stdin(std::process::Stdio::null());
    command.stdout(std::process::Stdio::piped());
    command.stderr(std::process::Stdio::piped());

    apply_provider_env(&mut command, api_key, provider);
    apply_hidden_window(&mut command);

    command.spawn().map_err(|error| error.into())
}

fn apply_provider_env(command: &mut Command, api_key: &str, provider: ChatProvider) {
    if api_key.trim().is_empty() {
        return;
    }

    match provider {
        ChatProvider::Codex => {
            command.env("OPENAI_API_KEY", api_key);
            command.env("CODEX_API_KEY", api_key);
        }
        ChatProvider::Gemini => {
            command.env("GEMINI_API_KEY", api_key);
        }
    }
}

fn apply_hidden_window(command: &mut Command) {
    #[cfg(target_os = "windows")]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }

    #[cfg(not(target_os = "windows"))]
    let _ = command;
}

fn shell_line(program: &str, args: &[String]) -> String {
    let mut parts = Vec::with_capacity(args.len() + 1);
    parts.push(quote_shell_arg(program));
    for arg in args {
        parts.push(quote_shell_arg(arg));
    }
    parts.join(" ")
}

fn quote_shell_arg(value: &str) -> String {
    if value.is_empty() {
        return "\"\"".to_string();
    }

    let escaped = value.replace('"', "\\\"");
    format!("\"{escaped}\"")
}

fn validate_spawn_input(program: &str, args: &[String]) -> Result<()> {
    let trimmed = program.trim();
    if trimmed.is_empty() {
        return Err(anyhow::anyhow!("command path is required"));
    }
    if contains_forbidden_spawn_chars(trimmed) {
        return Err(anyhow::anyhow!(
            "command path contains unsupported control characters"
        ));
    }

    for arg in args {
        if contains_forbidden_spawn_chars(arg) {
            return Err(anyhow::anyhow!(
                "command args contain unsupported control characters"
            ));
        }
    }

    Ok(())
}

fn contains_forbidden_spawn_chars(input: &str) -> bool {
    input.contains('\0') || input.contains('\n') || input.contains('\r')
}

async fn read_lines<R>(reader: R, source: StreamSource, tx: mpsc::Sender<(StreamSource, String)>)
where
    R: AsyncRead + Unpin + Send + 'static,
{
    let mut lines = BufReader::new(reader).lines();
    loop {
        match lines.next_line().await {
            Ok(Some(line)) => {
                if tx.send((source, line)).await.is_err() {
                    break;
                }
            }
            Ok(None) => break,
            Err(error) => {
                warn!(?error, "failed to read process stream line");
                break;
            }
        }
    }
}

fn parse_json_line(line: &str) -> Option<Value> {
    serde_json::from_str::<Value>(line).ok()
}

fn stringify_json(value: &Value) -> String {
    serde_json::to_string(value).unwrap_or_default()
}

fn extract_session_ref(value: &Value) -> Option<String> {
    const SESSION_KEYS: [&str; 6] = [
        "session_id",
        "sessionId",
        "conversation_id",
        "conversationId",
        "tag",
        "resume_ref",
    ];

    match value {
        Value::Object(map) => {
            for key in SESSION_KEYS {
                if let Some(Value::String(text)) = map.get(key) {
                    let trimmed = text.trim();
                    if !trimmed.is_empty() {
                        return Some(trimmed.to_string());
                    }
                }
            }

            for child in map.values() {
                if let Some(found) = extract_session_ref(child) {
                    return Some(found);
                }
            }

            None
        }
        Value::Array(values) => {
            for child in values {
                if let Some(found) = extract_session_ref(child) {
                    return Some(found);
                }
            }
            None
        }
        _ => None,
    }
}

fn extract_status(value: &Value) -> Option<String> {
    let event_type = value
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_lowercase();

    if event_type.contains("tool") {
        return Some("tool_call".to_string());
    }

    if event_type.contains("thinking") || event_type.contains("reasoning") {
        return Some("thinking".to_string());
    }

    None
}

fn extract_assistant_chunk(value: &Value) -> Option<String> {
    if let Some(Value::String(role)) = value.get("role") {
        let role_lower = role.to_lowercase();
        if role_lower == "assistant" {
            if let Some(Value::String(content)) = value.get("content") {
                let trimmed = content.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
            }

            if let Some(Value::String(content)) = value.get("text") {
                let trimmed = content.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
            }
        }
    }

    let candidates = ["text", "delta", "content"];
    for key in candidates {
        if let Some(Value::String(text)) = value.get(key) {
            let trimmed = text.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }

    None
}

async fn send_widget_event(
    tx: &mpsc::Sender<AgentEnvelope>,
    tokens: &SessionTokens,
    session_id: &str,
    job_id: &str,
    widget_id: &str,
    payload: widget_event::Payload,
) -> Result<()> {
    let payload = if widget_id == TRANSCRIBE_WIDGET_ID {
        match payload {
            widget_event::Payload::TranscribeProgress(progress) => {
                agent_envelope::Payload::Progress(progress)
            }
            widget_event::Payload::TranscribeToken(token) => agent_envelope::Payload::Token(token),
            widget_event::Payload::TranscribeDone(done) => agent_envelope::Payload::Done(done),
            widget_event::Payload::TranscribeError(error) => agent_envelope::Payload::Error(error),
            other => agent_envelope::Payload::WidgetEvent(WidgetEvent {
                widget_id: widget_id.to_string(),
                payload: Some(other),
            }),
        }
    } else {
        agent_envelope::Payload::WidgetEvent(WidgetEvent {
            widget_id: widget_id.to_string(),
            payload: Some(payload),
        })
    };

    tx.send(AgentEnvelope {
        protocol_version: PROTOCOL_VERSION.to_string(),
        agent_id: tokens.agent_id.clone(),
        session_id: session_id.to_string(),
        job_id: job_id.to_string(),
        timestamp_unix_ms: chrono::Utc::now().timestamp_millis(),
        access_jwt: tokens.access_jwt.clone(),
        payload: Some(payload),
    })
    .await?;

    Ok(())
}

async fn send_terminal_status(
    tx: &mpsc::Sender<AgentEnvelope>,
    tokens: &SessionTokens,
    session_id: &str,
    job_id: &str,
    status: &str,
    detail: &str,
) -> Result<()> {
    send_widget_event(
        tx,
        tokens,
        session_id,
        job_id,
        TERMINAL_AGENT_WIDGET_ID,
        widget_event::Payload::TerminalAgentStatus(TerminalAgentStatusEvent {
            status: status.to_string(),
            detail: detail.to_string(),
        }),
    )
    .await
}

async fn send_terminal_chunk(
    tx: &mpsc::Sender<AgentEnvelope>,
    tokens: &SessionTokens,
    session_id: &str,
    job_id: &str,
    text: &str,
) -> Result<()> {
    send_widget_event(
        tx,
        tokens,
        session_id,
        job_id,
        TERMINAL_AGENT_WIDGET_ID,
        widget_event::Payload::TerminalAgentAssistantChunk(TerminalAgentAssistantChunkEvent {
            text: text.to_string(),
        }),
    )
    .await
}

async fn send_terminal_error(
    tx: &mpsc::Sender<AgentEnvelope>,
    tokens: &SessionTokens,
    session_id: &str,
    job_id: &str,
    code: &str,
    message: &str,
) -> Result<()> {
    send_widget_event(
        tx,
        tokens,
        session_id,
        job_id,
        TERMINAL_AGENT_WIDGET_ID,
        widget_event::Payload::TerminalAgentError(TerminalAgentErrorEvent {
            code: code.to_string(),
            message: message.to_string(),
        }),
    )
    .await
}

async fn send_widget_execution_error(
    tx: &mpsc::Sender<AgentEnvelope>,
    tokens: &SessionTokens,
    session_id: &str,
    job_id: &str,
    widget_id: &str,
    code: &str,
    message: &str,
) -> Result<()> {
    if widget_id == TRANSCRIBE_WIDGET_ID {
        return send_widget_event(
            tx,
            tokens,
            session_id,
            job_id,
            TRANSCRIBE_WIDGET_ID,
            widget_event::Payload::TranscribeError(TranscribeErrorEvent {
                code: code.to_string(),
                message: message.to_string(),
            }),
        )
        .await;
    }

    send_widget_event(
        tx,
        tokens,
        session_id,
        job_id,
        TERMINAL_AGENT_WIDGET_ID,
        widget_event::Payload::TerminalAgentError(TerminalAgentErrorEvent {
            code: code.to_string(),
            message: message.to_string(),
        }),
    )
    .await
}

async fn authorize(http_client: &Client, config: &AgentConfig) -> Result<SessionTokens> {
    let mut enroll_agent_id = config.agent_id.clone();

    if let Some(session) = storage::read_session(&config.refresh_token_path).await {
        if enroll_agent_id.trim().is_empty() {
            enroll_agent_id = session.agent_id.clone();
        }

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

    if enroll_agent_id.trim().is_empty() {
        return Err(anyhow::anyhow!(
            "JULIA_AGENT_ID is required for first enroll when no valid session exists"
        ));
    }
    if config.enrollment_token.trim().is_empty() {
        return Err(anyhow::anyhow!(
            "JULIA_AGENT_ENROLLMENT_TOKEN is required for enroll fallback"
        ));
    }

    enroll(
        http_client,
        &config.server_base_url,
        &enroll_agent_id,
        &config.enrollment_token,
        &config.agent_version,
        &config.agent_display_name,
    )
    .await
}

fn build_heartbeat_envelope(
    tokens: &SessionTokens,
    session_id: &str,
    status: &str,
    hostname: &str,
    agent_version: &str,
) -> AgentEnvelope {
    AgentEnvelope {
        protocol_version: PROTOCOL_VERSION.to_string(),
        agent_id: tokens.agent_id.clone(),
        session_id: session_id.to_string(),
        job_id: String::new(),
        timestamp_unix_ms: chrono::Utc::now().timestamp_millis(),
        access_jwt: tokens.access_jwt.clone(),
        payload: Some(agent_envelope::Payload::Heartbeat(Heartbeat {
            agent_version: agent_version.to_string(),
            status: status.to_string(),
            hostname: hostname.to_string(),
        })),
    }
}
