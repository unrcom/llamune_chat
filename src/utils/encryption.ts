/**
 * 暗号化ユーティリティ
 * AES-256-GCM を使用してデータを暗号化・復号
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

// 実行時にセットされるキー
let _encryptionKey: Buffer | null = null;

/**
 * 暗号化キーをセット（database.ts の initDatabase() から呼ぶ）
 */
export function setEncryptionKey(hexKey: string): void {
  if (hexKey.length === 64) {
    _encryptionKey = Buffer.from(hexKey, 'hex');
  } else {
    _encryptionKey = crypto.createHash('sha256').update(hexKey).digest();
  }
}

/**
 * 暗号化キーを生成
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * 暗号化キーを取得
 */
function getEncryptionKey(): Buffer {
  if (!_encryptionKey) {
    throw new Error('Encryption key not initialized. Call setEncryptionKey() first.');
  }
  return _encryptionKey;
}

/**
 * テキストを暗号化
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * 暗号化されたテキストを復号
 */
export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }

  const [ivBase64, authTagBase64, ciphertext] = parts;
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
