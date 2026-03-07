import { secrets } from '../../core/secrets';

export function isChannelAuthorized(request: Request) {
  const expectedToken = secrets.getSecret('WIDGET_CHANNEL_TOKEN');
  if (!expectedToken) {
    return false;
  }

  const token = request.headers.get('X-Widget-Token')?.trim();
  if (!token) {
    return false;
  }

  return token === expectedToken;
}
