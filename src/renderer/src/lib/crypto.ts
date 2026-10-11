// AES-256-GCM Crypto Helper using Electron IPC with Web Crypto API fallback.
// Both paths share the SAME wire format: `v1:<ivHex>:<authTagHex>:<cipherHex>`
// Legacy `iv:data` (AES-256-CBC) values from older versions are still decrypted.

const DEV_FALLBACK_SECRET = 'devradar_local_dev_only_secret!'

async function deriveAesKey(secretKey: string | undefined): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const rawSecret = secretKey || DEV_FALLBACK_SECRET
  // SHA-256 digest gives a stable 32-byte key regardless of secret length
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(rawSecret))
  const rawKey = new Uint8Array(digest).slice(0, 32)
  return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')

const fromHex = (hex: string): Uint8Array<ArrayBuffer> => {
  const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [])
  return bytes
}

export async function encryptApiKey(key: string, secretKey?: string): Promise<string> {
  if (!key) return ''
  if (typeof window !== 'undefined' && window.api && typeof window.api.cryptoEncrypt === 'function') {
    try {
      return await window.api.cryptoEncrypt(key, secretKey)
    } catch (e) {
      console.warn('Electron crypto IPC failed, falling back to Web Crypto API:', e)
    }
  }

  // Web Crypto API Fallback (AES-GCM) — same format as the main process
  try {
    const cryptoKey = await deriveAesKey(secretKey)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encodedData = new TextEncoder().encode(key)
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, encodedData)
    const full = new Uint8Array(encrypted) // last 16 bytes are the auth tag
    const data = full.slice(0, full.length - 16)
    const tag = full.slice(full.length - 16)
    return `v1:${toHex(iv)}:${toHex(tag)}:${toHex(data)}`
  } catch (err) {
    console.error('Web Crypto fallback encryption failed:', err)
    return btoa(key) // basic obfuscation-only fallback
  }
}

export async function decryptApiKey(encryptedText: string, secretKey?: string): Promise<string> {
  if (!encryptedText) return ''
  if (!encryptedText.includes(':')) {
    try {
      return atob(encryptedText)
    } catch {
      return encryptedText
    }
  }

  const isCurrentFormat = encryptedText.startsWith('v1:')

  if (typeof window !== 'undefined' && window.api && typeof window.api.cryptoDecrypt === 'function') {
    try {
      const decrypted = await window.api.cryptoDecrypt(encryptedText, secretKey)
      if (decrypted) return decrypted
    } catch (e) {
      console.warn('Electron crypto IPC decrypt failed, falling back:', e)
    }
  }

  // Web Crypto fallback — only handles the current GCM format
  if (!isCurrentFormat) {
    console.warn('Legacy CBC payload cannot be decrypted via Web Crypto fallback.')
    return ''
  }

  try {
    const [, ivHex, tagHex, dataHex] = encryptedText.split(':')
    const iv = fromHex(ivHex)
    const tag = fromHex(tagHex)
    const data = fromHex(dataHex)
    const combined = new Uint8Array(data.length + tag.length)
    combined.set(data, 0)
    combined.set(tag, data.length)

    const cryptoKey = await deriveAesKey(secretKey)
    const decryptedBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, combined)
    return new TextDecoder().decode(decryptedBuffer)
  } catch (err) {
    console.error('Decryption failed:', err)
    return ''
  }
}
