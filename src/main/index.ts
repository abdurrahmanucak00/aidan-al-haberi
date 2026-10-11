import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import crypto from 'crypto'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

const DEV_FALLBACK_SECRET = 'devradar_local_dev_only_secret!'

function getEncryptionKey(customKey?: string): Buffer {
  // Priority: explicit custom key > ENCRYPTION_KEY env var > dev-only fallback (warns)
  let keyStr = customKey || process.env.ENCRYPTION_KEY
  if (!keyStr) {
    if (!is.dev) {
      console.warn('[DevRadar] ENCRYPTION_KEY tanımlı değil. Üretimde mutlaka ayarlayın!')
    }
    keyStr = DEV_FALLBACK_SECRET
  }
  return crypto.createHash('sha256').update(keyStr).digest()
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

function decryptText(cipherText: string, customKey?: string): string {
  if (!cipherText || !cipherText.includes(':')) return cipherText
  const parts = cipherText.split(':')
  const key = getEncryptionKey(customKey)

  // Current format: v1:<iv>:<tag>:<data>
  if (parts[0] === 'v1' && parts.length === 4) {
    try {
      const [, ivHex, tagHex, dataHex] = parts
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
      let decrypted = decipher.update(dataHex, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    } catch (err) {
      console.error('GCM decryption failed:', err)
      return ''
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
    } catch (err) {
      console.error('Legacy CBC decryption failed:', err)
      return ''
    }
  }

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

