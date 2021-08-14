import { ipcRenderer } from 'electron'

const setMode = (v: string): void => {
  ipcRenderer.send('set_mode', v)
}

const setServer = (data: string): void => {
  ipcRenderer.send('set_server', data)
}

const getMode = (): void => {
  ipcRenderer.sendSync('get_mode')
}

const on = (evt: string, handler: (...args: any[]) => void): any => ipcRenderer.on(evt, handler)

const send = (channel: string, ...args: any[]): void => ipcRenderer.send(channel, ...args)

export default { setMode, setServer, getMode, on, send }
