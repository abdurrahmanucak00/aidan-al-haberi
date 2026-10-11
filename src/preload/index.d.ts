import { ElectronAPI } from '@electron-toolkit/preload'

export interface DevRadarApi {
  cryptoEncrypt: (text: string, key?: string) => Promise<string>
  cryptoDecrypt: (cipherText: string, key?: string) => Promise<string>
  openExternal: (url: string) => Promise<boolean>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: DevRadarApi
  }
}
