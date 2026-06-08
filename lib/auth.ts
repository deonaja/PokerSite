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

// A per-season invite code allows this many self-registrations before it rotates.
export const MAX_INVITE_CODE_USES = 2

// Register throttle: per-IP wrong-code attempts allowed within the window before
// registration is temporarily blocked (the code is static between uses, so this
// caps brute-force). Counts FAILURES only — legit registrations don't accrue.
export const MAX_REGISTER_ATTEMPTS = 10
export const REGISTER_WINDOW_MINUTES = 15

// 8-char invite code from an unambiguous alphabet (no 0/O/1/I/L) so it's easy to
// read out loud / type. Used for self-registration into the active season.
export function generateInviteCode(): string {
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(8)
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
