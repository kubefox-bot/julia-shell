import crypto from 'node:crypto';

export function createOpaqueToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function sha256(value: string) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

export function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
