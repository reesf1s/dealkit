import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from '../encrypt'

const TEST_KEY = Buffer.from('a'.repeat(64), 'hex')  // 32-byte key for testing

describe('encrypt/decrypt', () => {
  it('round-trips a string', () => {
    const plaintext = 'lin_api_test_key_abc123'
    const enc = encrypt(plaintext, TEST_KEY)
    expect(decrypt(enc, TEST_KEY)).toBe(plaintext)
  })

  it('produces different ciphertext each call (random IV)', () => {
    const plaintext = 'same plaintext'
    const enc1 = encrypt(plaintext, TEST_KEY)
    const enc2 = encrypt(plaintext, TEST_KEY)
    expect(enc1).not.toBe(enc2)
    // But both decrypt to the same thing
    expect(decrypt(enc1, TEST_KEY)).toBe(plaintext)
    expect(decrypt(enc2, TEST_KEY)).toBe(plaintext)
  })

  it('throws on invalid encoded string', () => {
    expect(() => decrypt('bad-format', TEST_KEY)).toThrow('Invalid encrypted value format')
  })

  it('produces output in iv:tag:ciphertext hex format', () => {
    const enc = encrypt('hello', TEST_KEY)
    const parts = enc.split(':')
    expect(parts).toHaveLength(3)
    // IV = 12 bytes = 24 hex chars
    expect(parts[0]).toHaveLength(24)
    // Auth tag = 16 bytes = 32 hex chars
    expect(parts[1]).toHaveLength(32)
  })

  it('throws if auth tag is tampered (GCM integrity check)', () => {
    const enc = encrypt('hello', TEST_KEY)
    const parts = enc.split(':')
    // Flip a byte in the auth tag
    parts[1] = parts[1].slice(0, -2) + '00'
    expect(() => decrypt(parts.join(':'), TEST_KEY)).toThrow()
  })
})
