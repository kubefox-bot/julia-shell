export function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

export function readJsonBody<T = Record<string, unknown>>(request: Request): Promise<T> {
  return request.json().catch(() => ({} as T));
}
