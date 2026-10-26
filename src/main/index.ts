import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import crypto from 'crypto'
import fs from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

const DEV_FALLBACK_SECRET = 'devradar_local_dev_only_secret!'
const KEY_FILE_NAME = 'encryption.key'

let cachedKey: Buffer | null = null

/**
 * Packaged builds never read `.env`, so a missing ENCRYPTION_KEY used to fall
 * back to a publicly known secret. Instead we generate a random key once and
 * persist it in the user-data directory.
 */
function loadOrCreatePersistentKey(): string {
  const file = join(app.getPath('userData'), KEY_FILE_NAME)
  try {
    const existing = fs.readFileSync(file, 'utf8').trim()
    if (existing.length >= 32) return existing
  } catch {
    // First run — key file does not exist yet.
  }

  const generated = crypto.randomBytes(32).toString('hex')
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.writeFileSync(file, generated, { mode: 0o600 })
  } catch (err) {
    console.error('[DevRadar] encryption.key yazılamadı, oturumluk anahtar kullanılacak:', err)
  }
  return generated
}

function getEncryptionKey(customKey?: string): Buffer {
  // Priority: explicit custom key > ENCRYPTION_KEY env var > persisted random key
  if (customKey) {
    return crypto.createHash('sha256').update(customKey).digest()
  }
  if (cachedKey) return cachedKey
  const keyStr = process.env.ENCRYPTION_KEY || loadOrCreatePersistentKey()
  cachedKey = crypto.createHash('sha256').update(keyStr).digest()
  return cachedKey
}

// AES-256-GCM (authenticated encryption) — single format shared with the renderer Web Crypto fallback.
// Output format: `v1:<ivHex>:<authTagHex>:<cipherHex>`
function encryptText(text: string, customKey?: string): string {
  if (!text) return ''
  const iv = crypto.randomBytes(12)
  const key = getEncryptionKey(customKey)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  return `v1:${iv.toString('hex')}:${authTag}:${encrypted}`
}

/** Returns null when the payload cannot be decrypted with the given key. */
function tryDecrypt(cipherText: string, key: Buffer): string | null {
  const parts = cipherText.split(':')

  // Current format: v1:<iv>:<tag>:<data>
  if (parts[0] === 'v1' && parts.length === 4) {
    try {
      const [, ivHex, tagHex, dataHex] = parts
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
      let decrypted = decipher.update(dataHex, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    } catch {
      return null
    }
  }

  // Legacy format: <iv>:<data> (AES-256-CBC) — kept for backward compatibility
  if (parts.length === 2) {
    try {
      const [ivHex, encryptedHex] = parts
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'))
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    } catch {
      return null
    }
  }

  return null
}

function decryptText(cipherText: string, customKey?: string): string {
  if (!cipherText || !cipherText.includes(':')) return cipherText

  const primary = tryDecrypt(cipherText, getEncryptionKey(customKey))
  if (primary !== null) return primary

  // Older builds encrypted with the fixed dev secret; keep those readable.
  if (!customKey && !process.env.ENCRYPTION_KEY) {
    const legacyKey = crypto.createHash('sha256').update(DEV_FALLBACK_SECRET).digest()
    const legacy = tryDecrypt(cipherText, legacyKey)
    if (legacy !== null) {
      console.warn('[DevRadar] Anahtar eski gizli anahtarla çözüldü — ayarları yeniden kaydedin.')
      return legacy
    }
  }

  console.error('Decryption failed: payload cannot be decrypted with the current key.')
  return ''
}

function createWindow(): void {
  // Create the browser window with sleek modern dimensions.
  const mainWindow = new BrowserWindow({
    width: 1240,
    height: 840,
    minWidth: 980,
    minHeight: 660,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f0f7ff',
    title: "AI'dan Al Haberi - Günlük Yazılım & AI Gazetesi",
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Enable F12 and Ctrl+Shift+I to open DevTools in production
  mainWindow.webContents.on('before-input-event', (_, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.aidanalhaberi.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Crypto IPC Handlers
  ipcMain.handle('crypto:encrypt', (_, text: string, key?: string) => {
    return encryptText(text, key)
  })

  ipcMain.handle('crypto:decrypt', (_, cipherText: string, key?: string) => {
    return decryptText(cipherText, key)
  })

  ipcMain.handle('open:external', (_, url: string) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      shell.openExternal(url)
      return true
    }
    return false
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong [AI\'dan Al Haberi Engine Ready]'))


  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

