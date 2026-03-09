import { buildPassportAccessCookie, extractAccessTokenFromRequest } from './cookie';
import { resolvePassportJwtSecret } from './config';
import { verifyAccessJwt } from './jwt';
import { passportRuntime } from './runtime';

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
 * Resolves authorized passport context from request JWT.
 *
 * If JWT is missing and bootstrap is enabled, online agent token is reused and
 * returned with `setCookieHeader` for transparent browser bootstrap.
 */
export async function resolvePassportRequestContext(
  request: Request,
  options?: { allowBootstrapFromOnlineAgent?: boolean }
): Promise<PassportContextResolution> {
  const extracted = extractAccessTokenFromRequest(request);
  if (extracted.token) {
    const secret = await resolvePassportJwtSecret();
    const claims = verifyAccessJwt(secret, extracted.token);
    if (!claims) {
      return {
        context: null,
        reason: 'invalid'
      };
    }

    return {
      context: {
        agentId: claims.sub,
        accessJwt: extracted.token,
        setCookieHeader: null
      },
      reason: 'missing'
    };
  }

  if (!options?.allowBootstrapFromOnlineAgent) {
    return {
      context: null,
      reason: 'missing'
    };
  }

  const onlineSession = passportRuntime.getOnlineAgentSession();
  if (!onlineSession?.accessJwt) {
    return {
      context: null,
      reason: 'missing'
    };
  }

  return {
    context: {
      agentId: onlineSession.agentId,
      accessJwt: onlineSession.accessJwt,
      setCookieHeader: buildPassportAccessCookie({
        token: onlineSession.accessJwt,
        request
      })
    },
    reason: 'missing'
  };
}
