import { app, BrowserWindow, shell } from 'electron'
import { initUpdater } from './updater.js'
import { createServer as createNetServer } from 'net'
import { networkInterfaces } from 'os'
import { pathToFileURL, fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function findFreePort(start = 3000): Promise<number> {
  return new Promise((resolve) => {
    const server = createNetServer()
    server.listen(start, () => {
      const addr = server.address() as { port: number }
      server.close(() => resolve(addr.port))
    })
    server.on('error', () => findFreePort(start + 1).then(resolve))
  })
}

function getLocalIp(): string | null {
  const nets = networkInterfaces()
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address
    }
  }
  return null
}

async function startProductionServer(): Promise<number> {
  const port = await findFreePort(3000)

  const clientDistDir = app.isPackaged
    ? path.join(process.resourcesPath, 'client-dist')
    : path.join(__dirname, '../../client/dist')

  const dataDir = path.join(app.getPath('userData'), 'data')

  process.env.NODE_ENV = 'production'
  process.env.PORT = String(port)
  process.env.DATA_DIR = dataDir
  process.env.CLIENT_DIST_DIR = clientDistDir

  const serverBundlePath = app.isPackaged
    ? path.join(process.resourcesPath, 'server-bundle.cjs')
    : path.join(__dirname, '../resources/server-bundle.cjs')

  const { createApp } = (await import(pathToFileURL(serverBundlePath).href)) as {
    createApp: () => {
      httpServer: import('http').Server
      setLocalUrl: (url: string) => void
      setTunnelUrl: (url: string) => void
    }
  }

  const { httpServer, setLocalUrl } = createApp()

  const localIp = getLocalIp()
  if (localIp) setLocalUrl(`http://${localIp}:${port}`)

  await new Promise<void>((resolve) => httpServer.listen(port, resolve))
  return port
}

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Responde Aí!',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (app.isPackaged) {
    const port = await startProductionServer()
    await win.loadURL(`http://localhost:${port}`)
  } else {
    await win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  }
}

app.whenReady().then(() => {
  createWindow()
  initUpdater()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
