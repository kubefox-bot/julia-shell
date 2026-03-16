import { resolvePassportRequestContext } from '@passport/server/context'

export async function isChannelAuthorized(request: Request) {
  const resolved = await resolvePassportRequestContext(request, {
    allowBootstrapFromOnlineAgent: false
  });

  return Boolean(resolved.context)
}
