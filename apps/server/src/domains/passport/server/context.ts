import { extractAccessTokenFromRequest } from './cookie';
import { resolvePassportJwtSecret } from './config/jwt-secret';
import { verifyAccessJwt } from './jwt';

export type PassportRequestContext = {
  agentId: string;
  accessJwt: string;
  setCookieHeader: string | null;
};

export type PassportContextResolution = {
  context: PassportRequestContext | null;
  reason: 'missing' | 'invalid';
};

/**
 * Resolves authorized passport context from request JWT only.
 */
export async function resolvePassportRequestContext(
  request: Request,
  _options?: { allowBootstrapFromOnlineAgent?: boolean }
): Promise<PassportContextResolution> {
  const extracted = extractAccessTokenFromRequest(request);
  if (extracted.token) {
    const secret = await resolvePassportJwtSecret();
    const claims = verifyAccessJwt(secret, extracted.token);
    if (claims) {
      return {
        context: {
          agentId: claims.sub,
          accessJwt: extracted.token,
          setCookieHeader: null
        },
        reason: 'missing'
      };
    }

    return {
      context: null,
      reason: 'invalid'
    };
  }

  return {
    context: null,
    reason: 'missing'
  };
}
