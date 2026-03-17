// =============================================================================
// OAuth Token Encryption / Decryption
// AES-256-GCM を使用してアクセストークン・リフレッシュトークンを暗号化
// =============================================================================

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const key = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('OAUTH_TOKEN_ENCRYPTION_KEY is not set');
  }
  return Buffer.from(key, 'hex');
}

/**
 * 平文トークンをAES-256-GCMで暗号化する。
 * 返却フォーマット: "iv_base64:encrypted_base64:authTag_base64"
 */
export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${encrypted.toString('base64')}:${tag.toString('base64')}`;
}

/**
 * AES-256-GCMで暗号化されたトークンを復号する。
 * 入力フォーマット: "iv_base64:encrypted_base64:authTag_base64"
 */
export function decryptToken(encryptedValue: string): string {
  const [ivB64, dataB64, tagB64] = encryptedValue.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
