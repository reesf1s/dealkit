/**
 * AES-256-GCM field-level encryption for sensitive secrets (e.g. Linear API keys).
 *
 * Usage:
 *   const enc = encrypt(apiKey, getEncryptionKey())
 *   const dec = decrypt(enc, getEncryptionKey())
 *
 * Env var: ENCRYPTION_KEY — 64 hex chars (32 bytes).
 * Generate with: openssl rand -hex 32
 *
 * Stored format: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LEN = 12    // 96-bit IV — recommended for GCM
const TAG_LEN = 16   // 128-bit auth tag

/**
 * Returns the 32-byte encryption key from ENCRYPTION_KEY env var.
 * Throws at call-time (not module load) so serverless cold starts aren't affected.
 */
export function getEncryptionKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY env var must be set to a 64-char hex string (32 bytes). ' +
      'Generate with: openssl rand -hex 32'
    )
  }
  return Buffer.from(hex, 'hex')
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns a colon-separated hex string: "<iv>:<authTag>:<ciphertext>"
 */
export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`
}

/**
 * Decrypt a "<iv>:<authTag>:<ciphertext>" hex string produced by encrypt().
 */
export function decrypt(encoded: string, key: Buffer): string {
  const parts = encoded.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted value format')
  const [ivHex, tagHex, ctHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(tagHex, 'hex')
  const ciphertext = Buffer.from(ctHex, 'hex')

  if (iv.length !== IV_LEN) throw new Error('Invalid IV length')
  if (authTag.length !== TAG_LEN) throw new Error('Invalid auth tag length')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
