export function isTranscribeDevBypassMode() {
  return process.env.JULIAAPP_AGENT_ENABLE_DEV === '1';
}

export function isAgentRequiredForTranscribe() {
  return !isTranscribeDevBypassMode();
}
