import crypto from 'node:crypto';

const ACCESS_TTL_SECONDS = 60 * 60 * 12;

type AccessTokenClaims = {
  iss: string;
  aud: string;
  sub: string;
  scope: string;
  iat: number;
  nbf: number;
  exp: number;
  jti: string;
};

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${pad}`, 'base64').toString('utf8');
}

function hmac(payload: string, secret: string) {
  return base64UrlEncode(crypto.createHmac('sha256', secret).update(payload).digest());
}

export function issueAccessJwt(secret: string, agentId: string, scope = 'agent-control') {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const claims: AccessTokenClaims = {
    iss: 'julia-server',
    aud: 'agent-control',
    sub: agentId,
    scope,
    iat: now,
    nbf: now,
    exp: now + ACCESS_TTL_SECONDS,
    jti: crypto.randomUUID()
  };

  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${headerEncoded}.${payloadEncoded}`;
  const signature = hmac(signingInput, secret);

  return {
    token: `${signingInput}.${signature}`,
    expiresIn: ACCESS_TTL_SECONDS,
    claims
  };
}

export function verifyAccessJwt(secret: string, token: string): AccessTokenClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [header, payload, signature] = parts;
  const signingInput = `${header}.${payload}`;
  const expectedSignature = hmac(signingInput, secret);

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as AccessTokenClaims;
    const now = Math.floor(Date.now() / 1000);

    if (parsed.aud !== 'agent-control') {
      return null;
    }

    if (parsed.nbf > now || parsed.exp <= now) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
