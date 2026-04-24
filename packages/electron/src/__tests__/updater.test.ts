import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { initUpdater } from '../updater.js'

const { mockApp, mockDialog, mockAutoUpdater } = vi.hoisted(() => {
  const mockApp = { isPackaged: true }
  const mockDialog = { showMessageBox: vi.fn() }
  const mockAutoUpdater = {
    autoDownload: true,
    autoInstallOnAppQuit: false,
    on: vi.fn().mockReturnThis(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
    checkForUpdates: vi.fn().mockResolvedValue({}),
  }
  return { mockApp, mockDialog, mockAutoUpdater }
})

vi.mock('electron', () => ({
  app: mockApp,
  dialog: mockDialog,
}))

vi.mock('electron-updater', () => ({
  default: { autoUpdater: mockAutoUpdater },
}))

// Flush Promise microtasks without relying on setTimeout (safe with fake timers)
const flushPromises = () => new Promise<void>(resolve => queueMicrotask(resolve))

describe('initUpdater', () => {
  const handlers = new Map<string, (arg: unknown) => void>()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockApp.isPackaged = true
    mockAutoUpdater.autoDownload = true
    mockAutoUpdater.autoInstallOnAppQuit = false
    handlers.clear()
    mockAutoUpdater.on.mockImplementation((event: string, handler: (arg: unknown) => void) => {
      handlers.set(event, handler)
      return mockAutoUpdater
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retorna sem registrar listeners quando app não está empacotado', () => {
    mockApp.isPackaged = false
    initUpdater()
    expect(mockAutoUpdater.on).not.toHaveBeenCalled()
  })

  it('define autoDownload=false e autoInstallOnAppQuit=true', () => {
    initUpdater()
    expect(mockAutoUpdater.autoDownload).toBe(false)
    expect(mockAutoUpdater.autoInstallOnAppQuit).toBe(true)
  })

  it('registra listeners para update-available, update-downloaded e error', () => {
    initUpdater()
    expect(mockAutoUpdater.on).toHaveBeenCalledWith('update-available', expect.any(Function))
    expect(mockAutoUpdater.on).toHaveBeenCalledWith('update-downloaded', expect.any(Function))
    expect(mockAutoUpdater.on).toHaveBeenCalledWith('error', expect.any(Function))
  })

  it('chama checkForUpdates após 5 segundos', async () => {
    initUpdater()
    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(5000)
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledOnce()
  })

  it('não lança exceção se checkForUpdates rejeitar', async () => {
    mockAutoUpdater.checkForUpdates.mockRejectedValueOnce(new Error('network'))
    initUpdater()
    await expect(vi.advanceTimersByTimeAsync(5000)).resolves.not.toThrow()
  })

  describe('update-available', () => {
    it('exibe dialog com versão disponível', async () => {
      mockDialog.showMessageBox.mockResolvedValue({ response: 1 })
      initUpdater()
      handlers.get('update-available')!({ version: '2.0.0' })
      await flushPromises()
      expect(mockDialog.showMessageBox).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Atualização disponível',
          message: expect.stringContaining('2.0.0'),
        }),
      )
    })

    it('chama downloadUpdate quando usuário confirma', async () => {
      mockDialog.showMessageBox.mockResolvedValue({ response: 0 })
      initUpdater()
      handlers.get('update-available')!({ version: '2.0.0' })
      await flushPromises()
      expect(mockAutoUpdater.downloadUpdate).toHaveBeenCalledOnce()
    })

    it('não chama downloadUpdate quando usuário cancela', async () => {
      mockDialog.showMessageBox.mockResolvedValue({ response: 1 })
      initUpdater()
      handlers.get('update-available')!({ version: '2.0.0' })
      await flushPromises()
      expect(mockAutoUpdater.downloadUpdate).not.toHaveBeenCalled()
    })
  })

  describe('update-downloaded', () => {
    it('exibe dialog com versão baixada', async () => {
      mockDialog.showMessageBox.mockResolvedValue({ response: 1 })
      initUpdater()
      handlers.get('update-downloaded')!({ version: '2.0.0' })
      await flushPromises()
      expect(mockDialog.showMessageBox).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Pronto para instalar',
          message: expect.stringContaining('2.0.0'),
        }),
      )
    })

    it('chama quitAndInstall quando usuário confirma', async () => {
      mockDialog.showMessageBox.mockResolvedValue({ response: 0 })
      initUpdater()
      handlers.get('update-downloaded')!({ version: '2.0.0' })
      await flushPromises()
      expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalledWith(false, true)
    })

    it('não chama quitAndInstall quando usuário cancela', async () => {
      mockDialog.showMessageBox.mockResolvedValue({ response: 1 })
      initUpdater()
      handlers.get('update-downloaded')!({ version: '2.0.0' })
      await flushPromises()
      expect(mockAutoUpdater.quitAndInstall).not.toHaveBeenCalled()
    })
  })
})
