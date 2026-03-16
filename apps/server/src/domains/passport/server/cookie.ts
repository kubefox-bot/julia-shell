import { PASSPORT_ACCESS_COOKIE_NAME, PASSPORT_ACCESS_TTL_SECONDS } from './config/consts';

function parseCookieHeader(rawCookieHeader: string | null) {
  const map = new Map<string, string>();
  if (!rawCookieHeader?.trim()) {
    return map;
  }

  for (const chunk of rawCookieHeader.split(';')) {
    const [keyPart, ...valueParts] = chunk.split('=');
    const key = keyPart?.trim();
    if (!key) {
      continue;
    }
    map.set(key, valueParts.join('=').trim());
  }

  return map;
}

function getAuthorizationBearerToken(request: Request) {
  const authHeader = request.headers.get('Authorization')?.trim() ?? '';
  if (!authHeader) {
    return '';
  }

  const [scheme, token] = authHeader.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== 'bearer') {
    return '';
  }

  return token?.trim() ?? '';
}

/**
 * Extracts access token from request cookie or bearer header.
 */
export function extractAccessTokenFromRequest(request: Request) {
  const cookies = parseCookieHeader(request.headers.get('cookie'));
  const fromCookie = cookies.get(PASSPORT_ACCESS_COOKIE_NAME)?.trim() ?? '';
  if (fromCookie) {
    return {
      token: fromCookie,
      source: 'cookie' as const
    };
  }

  const fromHeader = getAuthorizationBearerToken(request);
  if (fromHeader) {
    return {
      token: fromHeader,
      source: 'authorization' as const
    };
  }

  return {
    token: '',
    source: null
  };
}

/**
 * Builds `acess_token` cookie for browser auth bootstrap.
 */
export function buildPassportAccessCookie(input: {
  token: string;
  request: Request;
  maxAgeSeconds?: number;
}) {
  const maxAgeSeconds = Math.max(1, Math.round(input.maxAgeSeconds ?? PASSPORT_ACCESS_TTL_SECONDS));
  const url = new URL(input.request.url);
  const secure = url.protocol === 'https:';

  return [
    `${PASSPORT_ACCESS_COOKIE_NAME}=${input.token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
    `Max-Age=${maxAgeSeconds}`
  ]
    .filter(Boolean)
    .join('; ');
}

/**
 * Adds `Set-Cookie` to response without altering body/status.
 */
export function withSetCookie(response: Response, setCookieHeader: string | null) {
  if (!setCookieHeader) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.append('Set-Cookie', setCookieHeader);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
