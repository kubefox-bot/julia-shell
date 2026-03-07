import { secrets } from '../../core/secrets/secrets'

export async function isChannelAuthorized(request: Request) {
  const expectedToken = await secrets.getSecret('WIDGET_CHANNEL_TOKEN')
  if (!expectedToken) {
    return false
  }

  const token = request.headers.get('X-Widget-Token')?.trim()
  if (!token) {
    return false
  }

  return token === expectedToken
}
