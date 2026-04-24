import { dialog, app } from 'electron'
import electronUpdater, { type UpdateInfo } from 'electron-updater'

const { autoUpdater } = electronUpdater

export function initUpdater(): void {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Atualização disponível',
        message: `Versão ${info.version} do Responde Aí! está disponível.`,
        detail: 'Deseja baixar agora? O app continuará funcionando durante o download.',
        buttons: ['Baixar', 'Agora não'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.downloadUpdate()
      })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Pronto para instalar',
        message: `Versão ${info.version} baixada com sucesso.`,
        detail: 'Reinicie o app agora para aplicar a atualização.',
        buttons: ['Reiniciar agora', 'Depois'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall(false, true)
      })
  })

  autoUpdater.on('error', (err: Error) => {
    console.error('[updater]', err.message)
  })

  // Aguarda o app estabilizar antes de checar
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 5000)
}
