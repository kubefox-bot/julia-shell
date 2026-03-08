import { secrets } from '../../core/secrets/secrets'

export async function isChannelAuthorized(request: Request) {
  if (process.env.JULIAAPP_ENABLE_CHANNEL_AUTH !== '1') {
    return true
  }

  const expectedToken = await secrets.get('WIDGET_CHANNEL_TOKEN', '/')
  if (!expectedToken?.value) {
    return false
  }

  const token = request.headers.get('X-Widget-Token')?.trim()
  if (!token) {
    return false
  }

  return token === expectedToken.value
}
