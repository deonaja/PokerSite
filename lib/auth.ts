import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const PIN_RE = /^\d{4,6}$/

export function isValidPin(pin: string): boolean {
  return PIN_RE.test(pin)
}

export async function hashPin(pin: string): Promise<string> {
  if (!isValidPin(pin)) {
    throw new Error('PIN harus 4-6 digit angka')
  }

  const salt = randomBytes(16).toString('hex')
  const derived = await scrypt(pin, salt, 64) as Buffer
  return `scrypt$${salt}$${derived.toString('hex')}`
}

export async function verifyPin(pin: string, storedHash: string | null | undefined): Promise<boolean> {
  if (!storedHash) return false

  const [algo, salt, hashHex] = storedHash.split('$')
  if (algo !== 'scrypt' || !salt || !hashHex) return false

  const derived = await scrypt(pin, salt, 64) as Buffer
  const expected = Buffer.from(hashHex, 'hex')
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
