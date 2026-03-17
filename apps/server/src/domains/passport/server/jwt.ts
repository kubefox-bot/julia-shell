import crypto from 'node:crypto';
import { Result, match } from 'oxide.ts';
import { DateTime } from 'luxon';
import { PASSPORT_ACCESS_TTL_SECONDS } from './config/consts';

const BASE64_BLOCK_SIZE = 4;
const JWT_PARTS_COUNT = 3;

/**
 * Access JWT claims used by passport for agent and browser authorization.
 */
export type AccessTokenClaims = {
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
  const normalizedRemainder = normalized.length % BASE64_BLOCK_SIZE;
  const pad =
    normalizedRemainder === 0 ? '' : '='.repeat(BASE64_BLOCK_SIZE - normalizedRemainder);
  return Buffer.from(`${normalized}${pad}`, 'base64').toString('utf8');
}

function hmac(payload: string, secret: string) {
  return base64UrlEncode(crypto.createHmac('sha256', secret).update(payload).digest());
}

/**
 * Issues short-lived access JWT with `sub=agent_id`.
 */
export function issueAccessJwt(secret: string, agentId: string, scope = 'agent-control') {
  const now = Math.floor(DateTime.utc().toSeconds());
  const header = { alg: 'HS256', typ: 'JWT' };
  const claims: AccessTokenClaims = {
    iss: 'julia-server',
    aud: 'agent-control',
    sub: agentId,
    scope,
    iat: now,
    nbf: now,
    exp: now + PASSPORT_ACCESS_TTL_SECONDS,
    jti: crypto.randomUUID()
  };

  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${headerEncoded}.${payloadEncoded}`;
  const signature = hmac(signingInput, secret);

  return {
    token: `${signingInput}.${signature}`,
    expiresIn: PASSPORT_ACCESS_TTL_SECONDS,
    claims
  };
}

/**
 * Verifies JWT signature and temporal claims.
 */
export function verifyAccessJwt(secret: string, token: string): AccessTokenClaims | null {
  const parts = token.split('.');
  if (parts.length !== JWT_PARTS_COUNT) {
    return null;
  }

  const [header, payload, signature] = parts;
  const signingInput = `${header}.${payload}`;
  const expectedSignature = hmac(signingInput, secret);

  if (
    Buffer.byteLength(signature, 'utf8') !== Buffer.byteLength(expectedSignature, 'utf8') ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    return null;
  }

  const parsedResult = Result.safe(() => JSON.parse(base64UrlDecode(payload)) as AccessTokenClaims);

  return match(parsedResult, {
    Ok: (parsed) => {
      const now = Math.floor(DateTime.utc().toSeconds());

      if (parsed.aud !== 'agent-control') {
        return null;
      }

      if (parsed.nbf > now || parsed.exp <= now) {
        return null;
      }

      return parsed;
    },
    Err: () => null
  });
}
