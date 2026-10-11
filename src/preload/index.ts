import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  cryptoEncrypt: (text: string, key?: string): Promise<string> => {
    return ipcRenderer.invoke('crypto:encrypt', text, key)
  },
  cryptoDecrypt: (cipherText: string, key?: string): Promise<string> => {
    return ipcRenderer.invoke('crypto:decrypt', cipherText, key)
  },
  openExternal: (url: string): Promise<boolean> => {
    return ipcRenderer.invoke('open:external', url)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (fallback)
  window.electron = electronAPI
  // @ts-ignore (fallback)
  window.api = api
}
