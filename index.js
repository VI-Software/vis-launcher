/*
    ____   ____.___    _________       _____  __                                 
\   \ /   /|   |  /   _____/ _____/ ____\/  |___  _  _______ _______   ____  
 \   Y   / |   |  \_____  \ /  _ \   __\\   __\ \/ \/ /\__  \\_  __ \_/ __ \ 
  \     /  |   |  /        (  <_> )  |   |  |  \     /  / __ \|  | \/\  ___/ 
   \___/   |___| /_______  /\____/|__|   |__|   \/\_/  (____  /__|    \___  >
                         \/                                 \/            \/ 
                         
    © 2025 VI Software. All rights reserved.

    License: AGPL-3.0
    https://www.gnu.org/licenses/agpl-3.0.en.html

    GitHub: https://github.com/VI-Software
    Website: https://visoftware.dev
*/


const remoteMain = require('@electron/remote/main')
remoteMain.initialize()

// Requirements
const { app, BrowserWindow, ipcMain, Menu, shell, Tray } = require('electron')
const autoUpdater                       = require('electron-updater').autoUpdater
const ejse                              = require('ejs-electron')
const fs                                = require('fs')
const isDev                             = require('./app/assets/js/isdev')
const path                              = require('path')
const semver                            = require('semver')
const { pathToFileURL }                 = require('url')
const { AZURE_CLIENT_ID, MSFT_OPCODE, MSFT_REPLY_TYPE, MSFT_ERROR, SHELL_OPCODE } = require('./app/assets/js/ipcconstants')
const LangLoader                        = require('./app/assets/js/langloader')
const ConfigManager                     = require('./app/assets/js/configmanager')
const pjson = require('./package.json')
let isExitingThroughTray = false

// Setup auto updater.
function initAutoUpdater(event, data) {

    if(data){
        autoUpdater.allowPrerelease = true
    } else {
        // Defaults to true if application version contains prerelease components (e.g. 0.12.1-alpha.1)
        // autoUpdater.allowPrerelease = true
    }
    
    if(isDev){
        autoUpdater.autoInstallOnAppQuit = false
        autoUpdater.updateConfigPath = path.join(__dirname, 'dev-app-update.yml')
    }
    if(process.platform === 'darwin'){
        autoUpdater.autoDownload = false
    }

    autoUpdater.requestHeaders = {
        'User-Agent': 'VI-Software-Launcher/' + pjson.version
    }
    autoUpdater.timeout = 180000 // 3 min timeout

    autoUpdater.on('update-available', (info) => {
        event.sender.send('autoUpdateNotification', 'update-available', info)
    })
    autoUpdater.on('update-downloaded', (info) => {
        event.sender.send('autoUpdateNotification', 'update-downloaded', info)
    })
    autoUpdater.on('update-not-available', (info) => {
        event.sender.send('autoUpdateNotification', 'update-not-available', info)
    })
    autoUpdater.on('checking-for-update', () => {
        event.sender.send('autoUpdateNotification', 'checking-for-update')
    })
    autoUpdater.on('error', (err) => {
        event.sender.send('autoUpdateNotification', 'realerror', err)
    })
    autoUpdater.on('download-progress', (progress) => {
        event.sender.send('autoUpdateNotification', 'download-progress', progress)
    })
}

// Configure auto-updater specifically for the splash flow. This forwards
// autoUpdater events to the splash renderer and triggers a check immediately.
function configureAutoUpdaterForSplash(allowPrerelease = false) {
    try {
        autoUpdater.allowPrerelease = !!allowPrerelease
        if (isDev) {
            autoUpdater.autoInstallOnAppQuit = false
            autoUpdater.updateConfigPath = path.join(__dirname, 'dev-app-update.yml')
        }

        autoUpdater.requestHeaders = {
            'User-Agent': 'VI-Software-Launcher/' + pjson.version
        }
        autoUpdater.timeout = 180000 // 3 min timeout

        autoUpdater.on('checking-for-update', () => {
            try { if (splashWin && splashWin.webContents) splashWin.webContents.send('autoUpdateNotification', 'checking-for-update') } catch { void 0 }
        })

        autoUpdater.on('update-available', (info) => {
            try { if (splashWin && splashWin.webContents) splashWin.webContents.send('autoUpdateNotification', 'update-available', info) } catch { void 0 }
        })

        autoUpdater.on('update-not-available', (info) => {
            try { if (splashWin && splashWin.webContents) splashWin.webContents.send('autoUpdateNotification', 'update-not-available', info) } catch { void 0 }
        })

        autoUpdater.on('error', (err) => {
            try { if (splashWin && splashWin.webContents) splashWin.webContents.send('autoUpdateNotification', 'realerror', err) } catch { void 0 }
        })

        // progress during download
        autoUpdater.on('download-progress', (progress) => {
            try {
                const percent = progress && progress.percent ? Math.floor(progress.percent) : 0
                if (splashWin && splashWin.webContents) splashWin.webContents.send('splash-progress', { percent, message: `Downloading update... ${percent}%` })
                if (splashWin && splashWin.webContents) splashWin.webContents.send('autoUpdateNotification', 'download-progress', progress)
            } catch { void 0 }
        })

        autoUpdater.on('update-downloaded', (info) => {
            try { if (splashWin && splashWin.webContents) splashWin.webContents.send('autoUpdateNotification', 'update-downloaded', info) } catch { void 0 }
            // Mandatory install when running a production build. In dev we don't auto-install.
            if (!isDev) {
                // give a brief moment to let the UI update
                setTimeout(() => {
                    try { autoUpdater.quitAndInstall() } catch (err) { console.error('Failed to install update', err) }
                }, 500)
            }
        })

        try {
            autoUpdater.checkForUpdates().catch(() => { /* best-effort */ })
        } catch { /* ignore */ }
    } catch (err) {
        console.error('Failed to configure auto-updater for splash', err)
    }
}

// Open channel to listen for update actions.
ipcMain.on('autoUpdateAction', (event, arg, data) => {
    switch(arg){
        case 'initAutoUpdater':
            console.log('Initializing auto updater.')
            initAutoUpdater(event, data)
            event.sender.send('autoUpdateNotification', 'ready')
            break
        case 'checkForUpdate':
            autoUpdater.checkForUpdates()
                .catch(err => {
                    event.sender.send('autoUpdateNotification', 'realerror', err)
                })
            break
        case 'allowPrereleaseChange':
            if(!data){
                const preRelComp = semver.prerelease(app.getVersion())
                if(preRelComp != null && preRelComp.length > 0){
                    autoUpdater.allowPrerelease = true
                } else {
                    autoUpdater.allowPrerelease = data
                }
            } else {
                autoUpdater.allowPrerelease = data
            }
            break
        case 'installUpdateNow':
            autoUpdater.quitAndInstall()
            break
        default:
            console.log('Unknown argument', arg)
            break
    }
})
// Redirect distribution index event from preloader to renderer.
ipcMain.on('distributionIndexDone', (event, res) => {
    event.sender.send('distributionIndexDone', res)
})

// Forward splash progress/messages from preloader (which sends to main)
// back to the splash window renderer so the UI can update.
ipcMain.on('splash-progress', (_event, payload) => {
    try {
        if (splashWin && splashWin.webContents) splashWin.webContents.send('splash-progress', payload)
    } catch { /* best-effort forward */ }
})
ipcMain.on('splash-message', (_event, message) => {
    try {
        if (splashWin && splashWin.webContents) splashWin.webContents.send('splash-message', message)
    } catch { /* best-effort forward */ }
})
ipcMain.on('splash-done', (_event) => {
    try {
        if (splashWin && splashWin.webContents) splashWin.webContents.send('splash-done')
    } catch { /* best-effort forward */ }
})

// Handle legal acceptance/decline from legal window
let legalWin
// When true, temporarily suppress global dialog IPC handlers because
// we are running the early dialog flow which awaits those same events.
let suppressDialogIPC = false
let ranInitialDialogs = false
ipcMain.on('legal-accepted', (event) => {
    if (suppressDialogIPC) {
        return
    }
    try {
        ConfigManager.load()
    } catch (err) {
        console.error('Error loading config before setting legal acceptance', err)
    }
    ConfigManager.setLegalAccepted(pjson.version)
    if (legalWin) {
        try { legalWin.close() } catch (e) { console.error('Error closing legal window after acceptance', e) }
    }

    // Show main window after legal acceptance
    try {
        if (!win) {
            createWindow()
            createMenu()
            createTray()

            // If the splash is already closed, show main window once it's ready
            if (!splashWin && win) {
                try {
                    win.once && win.once('ready-to-show', () => {
                        try { if (win.isMinimized && win.isMinimized()) win.restore(); win.show(); win.focus() } catch (e) { console.error('Error showing main window after ready-to-show', e) }
                    })
                } catch (e) { console.error('Error attaching ready-to-show for main window', e) }
                // Also attempt an immediate show/focus with a brief alwaysOnTop
                // toggle to force the window to the foreground on platforms where
                // windows may remain in background but only if splash is no longer visible.
                if (!splashWin) {
                    try {
                        try { if (win.isMinimized && win.isMinimized()) win.restore() } catch { void 0 }
                        try { win.setAlwaysOnTop(true) } catch { void 0 }
                        try { win.show(); win.focus() } catch (e) { console.error('Error forcing main window visible immediately after creation', e) }
                        setTimeout(() => { try { win.setAlwaysOnTop(false) } catch { void 0 } }, 250)
                    } catch (e) { console.error('Immediate show/focus attempt failed', e) }
                }
            }
        } else {
            try { if (win.isMinimized && win.isMinimized()) win.restore(); win.show(); win.focus() } catch (e) { console.error('Error showing existing main window after legal acceptance', e) }
        }
    } catch (err) {
        console.error('Error starting launcher after legal acceptance', err)
    }
})

ipcMain.on('legal-declined', (event) => {
    // User declined legal notices. We'll just quit the app.
    app.quit()
})

// Handle trash item.
ipcMain.handle(SHELL_OPCODE.TRASH_ITEM, async (event, ...args) => {
    try {
        await shell.trashItem(args[0])
        return {
            result: true
        }
    } catch(error) {
        return {
            result: false,
            error: error
        }
    }
})

// Disable hardware acceleration.
// https://electronjs.org/docs/tutorial/offscreen-rendering
app.disableHardwareAcceleration()


const REDIRECT_URI_PREFIX = 'https://login.microsoftonline.com/common/oauth2/nativeclient?'

// Microsoft Auth Login
let msftAuthWindow
let msftAuthSuccess
let msftAuthViewSuccess
let msftAuthViewOnClose
ipcMain.on(MSFT_OPCODE.OPEN_LOGIN, (ipcEvent, ...arguments_) => {
    if (msftAuthWindow) {
        ipcEvent.reply(MSFT_OPCODE.REPLY_LOGIN, MSFT_REPLY_TYPE.ERROR, MSFT_ERROR.ALREADY_OPEN, msftAuthViewOnClose)
        return
    }
    msftAuthSuccess = false
    msftAuthViewSuccess = arguments_[0]
    msftAuthViewOnClose = arguments_[1]
    msftAuthWindow = new BrowserWindow({
        title: LangLoader.queryJS('index.microsoftLoginTitle'),
        backgroundColor: '#222222',
        width: 520,
        height: 600,
        frame: true,
        icon: getPlatformIcon('vis-icon')
    })

    msftAuthWindow.on('closed', () => {
        msftAuthWindow = undefined
    })

    msftAuthWindow.on('close', () => {
        if(!msftAuthSuccess) {
            ipcEvent.reply(MSFT_OPCODE.REPLY_LOGIN, MSFT_REPLY_TYPE.ERROR, MSFT_ERROR.NOT_FINISHED, msftAuthViewOnClose)
        }
    })

    msftAuthWindow.webContents.on('did-navigate', (_, uri) => {
        if (uri.startsWith(REDIRECT_URI_PREFIX)) {
            let queries = uri.substring(REDIRECT_URI_PREFIX.length).split('#', 1).toString().split('&')
            let queryMap = {}

            queries.forEach(query => {
                const [name, value] = query.split('=')
                queryMap[name] = decodeURI(value)
            })

            ipcEvent.reply(MSFT_OPCODE.REPLY_LOGIN, MSFT_REPLY_TYPE.SUCCESS, queryMap, msftAuthViewSuccess)

            msftAuthSuccess = true
            msftAuthWindow.close()
            msftAuthWindow = null
        }
    })

    msftAuthWindow.removeMenu()
    msftAuthWindow.loadURL(`https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?prompt=select_account&client_id=${AZURE_CLIENT_ID}&response_type=code&scope=XboxLive.signin%20offline_access&redirect_uri=https://login.microsoftonline.com/common/oauth2/nativeclient`)
})

// Microsoft Auth Logout
let msftLogoutWindow
let msftLogoutSuccess
let msftLogoutSuccessSent
ipcMain.on(MSFT_OPCODE.OPEN_LOGOUT, (ipcEvent, uuid, isLastAccount) => {
    if (msftLogoutWindow) {
        ipcEvent.reply(MSFT_OPCODE.REPLY_LOGOUT, MSFT_REPLY_TYPE.ERROR, MSFT_ERROR.ALREADY_OPEN)
        return
    }

    msftLogoutSuccess = false
    msftLogoutSuccessSent = false
    msftLogoutWindow = new BrowserWindow({
        title: LangLoader.queryJS('index.microsoftLogoutTitle'),
        backgroundColor: '#222222',
        width: 520,
        height: 600,
        frame: true,
        icon: getPlatformIcon('vis-icon')
    })

    msftLogoutWindow.on('closed', () => {
        msftLogoutWindow = undefined
    })

    msftLogoutWindow.on('close', () => {
        if(!msftLogoutSuccess) {
            ipcEvent.reply(MSFT_OPCODE.REPLY_LOGOUT, MSFT_REPLY_TYPE.ERROR, MSFT_ERROR.NOT_FINISHED)
        } else if(!msftLogoutSuccessSent) {
            msftLogoutSuccessSent = true
            ipcEvent.reply(MSFT_OPCODE.REPLY_LOGOUT, MSFT_REPLY_TYPE.SUCCESS, uuid, isLastAccount)
        }
    })
    
    msftLogoutWindow.webContents.on('did-navigate', (_, uri) => {
        if(uri.startsWith('https://login.microsoftonline.com/common/oauth2/v2.0/logoutsession')) {
            msftLogoutSuccess = true
            setTimeout(() => {
                if(!msftLogoutSuccessSent) {
                    msftLogoutSuccessSent = true
                    ipcEvent.reply(MSFT_OPCODE.REPLY_LOGOUT, MSFT_REPLY_TYPE.SUCCESS, uuid, isLastAccount)
                }

                if(msftLogoutWindow) {
                    msftLogoutWindow.close()
                    msftLogoutWindow = null
                }
            }, 5000)
        }
    })
    
    msftLogoutWindow.removeMenu()
    msftLogoutWindow.loadURL('https://login.microsoftonline.com/common/oauth2/v2.0/logout')
})

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win
let splashWin
// Timestamp (ms) when splash was shown. Used to enforce a minimum display time.
let splashShownAt = 0

function createWindow() {
    // Determine if the version includes 'nightly' or 'canary' to enable prerelease features
    const isNightly = pjson.version.includes('nightly')
    const isCanary = pjson.version.includes('canary')

    win = new BrowserWindow({
        width: 980,
        height: 552,
        icon: getPlatformIcon('vis-icon'),
        frame: false,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'app', 'assets', 'js', 'preloader.js'),
            nodeIntegration: true,
            contextIsolation: false
        },
        backgroundColor: '#171614'
    })
    remoteMain.enable(win.webContents)

    const data = {
        bkid: Math.floor((Math.random() * fs.readdirSync(path.join(__dirname, 'app', 'assets', 'images', 'backgrounds')).length)),
        lang: (str, placeHolders) => LangLoader.queryEJS(str, placeHolders),
        isNightly: isNightly,
        isCanary: isCanary
    }
    Object.entries(data).forEach(([key, val]) => ejse.data(key, val))

    win.loadURL(pathToFileURL(path.join(__dirname, 'app', 'app.ejs')).toString())

    // Intentionally do not show main window here. The splash controls
    // when the main window becomes visible to avoid exposing the UI
    // before startup checks finish.
    /*win.once('ready-to-show', () => {
        // will be shown after splash closes
    })*/
    /*
        win.once('ready-to-show', () => {
            // show dev tools
            if (isDev) {
                win.webContents.openDevTools({ mode: 'detach' })
            }
        })
    */
    win.removeMenu()

    win.resizable = true

    win.on('close', (event) => {
        if (!app.isQuitting && !isExitingThroughTray) {
            event.preventDefault()
            win.hide()
        }
    
        return false
    })

    win.on('closed', () => {
        win = null
    })
}

function createSplashWindow(){
    splashWin = new BrowserWindow({
        width: 640,
        height: 420,
        frame: false,
        resizable: false,
        alwaysOnTop: true,
        modal: false,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'app', 'assets', 'js', 'preloader.js'),
            nodeIntegration: true,
            contextIsolation: false
        }
    })
    remoteMain.enable(splashWin.webContents)
    splashWin.removeMenu()
    splashWin.loadURL(pathToFileURL(path.join(__dirname, 'app', 'splash.ejs')).toString())
    // record shown time now as a fallback in case 'ready-to-show' fires later
    splashShownAt = Date.now()
    splashWin.once('ready-to-show', () => {
        splashShownAt = Date.now()
        splashWin.show()
    })
    splashWin.on('closed', () => { splashWin = null })
}

function createMenu() {
    
    if(process.platform === 'darwin') {

        // Extend default included application menu to continue support for quit keyboard shortcut
        let applicationSubMenu = {
            label: 'VI Software Launcher',
            submenu: [{
                label: 'About VI Software Launcher',
                selector: 'orderFrontStandardAboutPanel:'
            }, {
                type: 'separator'
            }, {
                label: 'Quit VI Software Launcher',
                accelerator: 'Command+Q',
                click: () => {
                    app.quit()
                }
            }]
        }

        // New edit menu adds support for text-editing keyboard shortcuts
        let editSubMenu = {
            label: 'Editar',
            submenu: [{
                label: 'Deshacer',
                accelerator: 'CmdOrCtrl+Z',
                selector: 'undo:'
            }, {
                label: 'Rehacer',
                accelerator: 'Shift+CmdOrCtrl+Z',
                selector: 'redo:'
            }, {
                type: 'separator'
            }, {
                label: 'Cortar',
                accelerator: 'CmdOrCtrl+X',
                selector: 'cut:'
            }, {
                label: 'Copiar',
                accelerator: 'CmdOrCtrl+C',
                selector: 'copy:'
            }, {
                label: 'Pegar',
                accelerator: 'CmdOrCtrl+V',
                selector: 'paste:'
            }, {
                label: 'Seleccionar todo',
                accelerator: 'CmdOrCtrl+A',
                selector: 'selectAll:'
            }]
        }

        // Bundle submenus into a single template and build a menu object with it
        let menuTemplate = [applicationSubMenu, editSubMenu]
        let menuObject = Menu.buildFromTemplate(menuTemplate)

        // Assign it to the application
        Menu.setApplicationMenu(menuObject)

    }
}


function getPlatformIcon(filename){
    let ext
    switch(process.platform) {
        case 'win32':
            ext = 'ico'
            break
        case 'darwin':
        case 'linux':
        default:
            ext = 'png'
            break
    }

    return path.join(__dirname, 'app', 'assets', 'images', `${filename}.${ext}`)
}

function createTray() {    
    tray = new Tray(path.join(__dirname, 'app', 'assets', 'images', 'vis-tray.png'))

    const trayMenuTemplate = [
        {
            label: 'Open',
            click: function () {
                win.show()
            }
        },
        {
            label: 'Quit',
            click: function () {
                isExitingThroughTray = true
                app.quit()
            }
        }
    ]
    
    let trayMenu = Menu.buildFromTemplate(trayMenuTemplate)
    tray.setContextMenu(trayMenu)
    tray.setToolTip('VI Software Launcher')
    
    tray.on('click', () => {
        win.isVisible() ? win.hide() : win.show()
    })
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
    app.quit()
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone or something tried to run a second instance of our APP, we should focus our window.
        if (win) {
            if (win.isMinimized()) win.restore()
            win.focus()
            win.show()
        }
    })
    
    app.whenReady().then(async () => {
        let locale = ''
        try {
            // Get the user's preferred system languages (returns array of BCP 47 language tags)
            const systemLanguages = app.getPreferredSystemLanguages()
            
            // Use the first preferred language, or fall back to getLocale() if empty
            locale = systemLanguages && systemLanguages.length > 0 ? systemLanguages[0] : app.getLocale()

            if (locale) {
                locale = locale.replace(/_/g, '-')
            }
        } catch (error) {
            console.error('Error detecting system locale:', error)
            locale = 'en-US'
        }
        
        LangLoader.setupLanguage(locale)
        
        function startAfterPrechecks(){
            try {
                ConfigManager.load()
            } catch (err) {
                console.error('Error loading config before post-canary checks', err)
            }

            if (!ConfigManager.getLegalAccepted()) {
                // Parent the legal window to the main window if it exists,
                // otherwise parent to the splash so it will appear above it
                // during startup.
                legalWin = new BrowserWindow({
                    width: 960,
                    height: 720,
                    resizable: false,
                    modal: !!(win || splashWin),
                    parent: win || splashWin || null,
                    show: false,
                    icon: getPlatformIcon('vis-icon'),
                    webPreferences: {
                        nodeIntegration: true,
                        contextIsolation: false
                    }
                })
                remoteMain.enable(legalWin.webContents)
                legalWin.loadURL(pathToFileURL(path.join(__dirname, 'app', 'legal.ejs')).toString())
                legalWin.removeMenu()
                // Show the legal dialog once ready; it will appear above the
                // splash if parented correctly.
                legalWin.once('ready-to-show', () => { legalWin.show() })
                legalWin.on('closed', () => { legalWin = null })
            } else {
                createWindow()
                createMenu()
                createTray()
                // If splash was used previously, ensure the main window is shown
                try {
                    if (!splashWin && win) {
                        win.once && win.once('ready-to-show', () => {
                            try { if (win.isMinimized && win.isMinimized()) win.restore(); win.show() } catch { void 0 }
                        })
                    }
                } catch { void 0 }
                // Attempt an immediate show/focus with a brief alwaysOnTop toggle
                // but only if splash is no longer visible.
                if (!splashWin) {
                    try {
                        try { if (win && win.isMinimized && win.isMinimized()) win.restore() } catch { void 0 }
                        try { if (win) win.setAlwaysOnTop(true) } catch { void 0 }
                        try { if (win) { win.show(); win.focus() } } catch (e) { console.error('Error forcing main window visible in startAfterPrechecks', e) }
                        setTimeout(() => { try { if (win) win.setAlwaysOnTop(false) } catch { void 0 } }, 250)
                    } catch (e) { console.error('Immediate show/focus attempt in startAfterPrechecks failed', e) }
                }
            }
        }

        // Run initial dialogs (canary -> legal) before showing the splash.
        try {
            try { ConfigManager.load() } catch { /* best-effort */ }
            // Temporarily suppress global dialog IPC handlers while we await replies
            suppressDialogIPC = true

            // Helper to await an IPC once event and report which channel fired
            const waitOnce = (channel) => new Promise((resolve) => ipcMain.once(channel, (...args) => resolve({ channel, args })))

            // Canary flow: if a canary build and not acknowledged, show the canary dialog
            const isCanaryBuildEarly = pjson.version.includes('canary')
            if (isCanaryBuildEarly && !ConfigManager.getCanaryAcknowledged()) {
                let canaryWinEarly = new BrowserWindow({
                    width: 600,
                    height: 300,
                    resizable: false,
                    modal: !!(win || splashWin),
                    parent: win || splashWin || null,
                    show: false,
                    icon: getPlatformIcon('vis-icon'),
                    webPreferences: {
                        nodeIntegration: true,
                        contextIsolation: false
                    }
                })
                remoteMain.enable(canaryWinEarly.webContents)
                ejse.data('lang', (str, placeHolders) => LangLoader.queryEJS(str, placeHolders))
                ejse.data('websiteURL', 'https://visoftware.dev/launcher')
                canaryWinEarly.loadURL(pathToFileURL(path.join(__dirname, 'app', 'canary.ejs')).toString())
                canaryWinEarly.removeMenu()
                canaryWinEarly.once('ready-to-show', () => canaryWinEarly.show())

                // Wait for either ack or close
                const canaryRes = await Promise.race([
                    waitOnce('canary-ack'),
                    waitOnce('canary-close')
                ])

                try { canaryWinEarly.close() } catch { void 0 }
                
                if (canaryRes && canaryRes.channel === 'canary-close') {
                    try { canaryWinEarly.close() } catch { void 0 }
                    app.quit()
                    return
                }

                // If ack resolved and the first argument is truthy (don't ask), persist
                if (canaryRes && canaryRes.channel === 'canary-ack' && canaryRes.args && canaryRes.args.length > 0 && canaryRes.args[0]) {
                    try { ConfigManager.setCanaryAcknowledged(pjson.version) } catch (e) { console.error('Failed to persist canary acknowledgment', e) }
                }
            }

            // Legal flow: if legal not accepted, show it and wait
            if (!ConfigManager.getLegalAccepted()) {
                let legalWinEarly = new BrowserWindow({
                    width: 960,
                    height: 720,
                    resizable: false,
                    modal: !!(win || splashWin),
                    parent: win || splashWin || null,
                    show: false,
                    icon: getPlatformIcon('vis-icon'),
                    webPreferences: {
                        nodeIntegration: true,
                        contextIsolation: false
                    }
                })
                remoteMain.enable(legalWinEarly.webContents)
                legalWinEarly.loadURL(pathToFileURL(path.join(__dirname, 'app', 'legal.ejs')).toString())
                legalWinEarly.removeMenu()
                legalWinEarly.once('ready-to-show', () => legalWinEarly.show())

                const legalRes = await Promise.race([
                    waitOnce('legal-accepted'),
                    waitOnce('legal-declined')
                ])

                try { legalWinEarly.close() } catch { void 0 }
                if (legalRes && legalRes.channel === 'legal-declined') {
                    // If declined we quit
                    app.quit()
                    return
                }
                // Mark accepted
                try { ConfigManager.setLegalAccepted(pjson.version) } catch { /* ignore */ }
            }
        } catch (err) {
            console.error('Error during initial dialogs', err)
        } finally {
            // Re-enable global IPC handlers
            suppressDialogIPC = false
            ranInitialDialogs = true
        }

        // Create and show splash after initial dialogs, preloader will send 'distributionIndexDone'
        try {
            createSplashWindow()
            // Start auto-update check for splash UI immediately
            try { configureAutoUpdaterForSplash(true) } catch { void 0 }
            // When preloader signals distributionIndexDone, close splash and continue
            ipcMain.once('distributionIndexDone', async (evt, res) => {
                // Ensure the splash is visible for at least 2.5 seconds to avoid flicker
                const minShowMs = 3000
                const elapsed = splashShownAt ? (Date.now() - splashShownAt) : minShowMs
                const remaining = Math.max(0, minShowMs - elapsed)

                // First: perform update check and, if an update is downloaded,
                // apply it (production) before continuing startup. This blocks
                // the boot until update resolution per user request.
                try {
                    if (splashWin && splashWin.webContents) splashWin.webContents.send('splash-message', 'Checking for updates...')

                    const waitForUpdateResolution = () => new Promise((resolve) => {
                        // Resolve values: { status: 'no-update' } | { status: 'downloaded', info } | { status: 'error', error, hadUpdate?: boolean }
                        let resolved = false
                        let hadUpdate = false
                        function cleanup() {
                            try { autoUpdater.removeListener('update-not-available', onNotAvailable) } catch { void 0 }
                            try { autoUpdater.removeListener('update-downloaded', onDownloaded) } catch { void 0 }
                            try { autoUpdater.removeListener('update-available', onUpdateAvailable) } catch { void 0 }
                            try { autoUpdater.removeListener('error', onError) } catch { void 0 }
                        }
                        const onNotAvailable = () => { if (resolved) return; resolved = true; cleanup(); resolve({ status: 'no-update' }) }
                        const onDownloaded = (info) => { if (resolved) return; resolved = true; cleanup(); resolve({ status: 'downloaded', info }) }
                        const onUpdateAvailable = (info) => { hadUpdate = true }
                        const onError = (err) => { if (resolved) return; resolved = true; cleanup(); resolve({ status: 'error', error: err, hadUpdate }) }

                        autoUpdater.once('update-not-available', onNotAvailable)
                        autoUpdater.once('update-downloaded', onDownloaded)
                        autoUpdater.once('update-available', onUpdateAvailable)
                        autoUpdater.once('error', onError)

                        // Trigger check (best-effort). If checkForUpdates rejects,
                        // the onError handler will resolve the promise.
                        try {
                            autoUpdater.checkForUpdates().catch((err) => { onError(err) })
                        } catch (err) {
                            onError(err)
                        }
                    })

                    // Wait for update resolution. In dev mode skip blocking.
                    let updateResult = { status: 'no-update' }
                    if (!isDev) {
                        updateResult = await waitForUpdateResolution()
                    } else {
                        // Dev env, still allow auto-updater to run in background but don't block boot.
                        try { autoUpdater.checkForUpdates().catch(()=>{}) } catch { void 0 }
                    }

                    if (updateResult.status === 'downloaded') {
                        try {
                            if (splashWin && splashWin.webContents) {
                                splashWin.webContents.send('splash-progress', { percent: 100, message: 'Update downloaded' })
                                splashWin.webContents.send('splash-message', 'Applying update...')
                            }
                        } catch { void 0 }
                        // In production, quit and install immediately to apply the update.
                        try {
                            autoUpdater.quitAndInstall()
                            return
                        } catch (err) {
                            console.error('Failed to quit and install update', err)
                            // Quitting failed?
                            // Fallthrough to continue startup
                        }
                    } else if (updateResult.status === 'error') {
                        console.error('Auto-update failed during check/download:', updateResult.error)
                        const message = updateResult.hadUpdate ? 'Update download failed (continuing)' : 'Update check failed (continuing)'
                        try { if (splashWin && splashWin.webContents) splashWin.webContents.send('splash-message', message) } catch { void 0 }
                    } else {
                        try { if (splashWin && splashWin.webContents) splashWin.webContents.send('splash-message', 'No updates found') } catch { void 0 }
                    }
                } catch (err) {
                    console.error('Error while waiting for update resolution', err)
                }

                // First, perform the normal startup checks
                try {
                    startAfterPrechecks()
                } catch (e) {
                    console.error('Error during post-splash startup', e)
                }

                // Then wait until either the main window or legal window exists
                // before closing the splash so app doesn't receive window-all-closed.
                const maxWait = 5000 // ms
                const pollInterval = 100
                let waited = 0
                const checkAndClose = () => {
                    const elapsedNow = splashShownAt ? (Date.now() - splashShownAt) : minShowMs
                    // Close only when min display time has passed and a main/legal window exists
                    if ((elapsedNow >= minShowMs) && (win || legalWin)) {
                        // Make sure the UI the user should see is visible before
                        // closing the splash. Prefer legal dialog if present,
                        // otherwise show the main window.
                        try {
                            if (legalWin) {
                                try {
                                    // Only force the legal window to front if the splash is
                                    // not visible if the splash is still shown we should
                                    // avoid taking focus away from it.
                                    if (!splashWin) {
                                        try { legalWin.setAlwaysOnTop(true) } catch { void 0 }
                                        legalWin.show()
                                        try { legalWin.focus() } catch { void 0 }
                                        // Restore alwaysOnTop state
                                        setTimeout(() => { try { legalWin.setAlwaysOnTop(false) } catch { void 0 } }, 250)
                                    } else {
                                        // If splash is still visible, just ensure legalWin is
                                        // shown once the splash closes (handled elsewhere).
                                        try { /* no-op: wait for splash to close */ } catch { void 0 }
                                    }
                                } catch (e) { console.error('Error showing legalWin before splash close', e) }
                            } else if (win) {
                                try {
                                    if (win.isMinimized && win.isMinimized()) win.restore()
                                    win.show()
                                } catch (e) { console.error('Error showing main window before splash close', e) }
                            }
                        } catch (e) { console.error('Error during splash close show logic', e) }

                        // After attempting to show the intended window, set a
                        // short fallback to ensure the main window is visible
                        // in case the previous show attempts failed for any platform-specific reason.
                        try {
                            setTimeout(() => {
                                try {
                                    const anyVisible = (win && win.isVisible && win.isVisible()) || (legalWin && legalWin.isVisible && legalWin.isVisible())
                                    if (!anyVisible) {
                                        console.warn('No visible window after splash close attempts; creating and showing main window as fallback')
                                        if (!win) {
                                            try { createWindow(); createMenu(); createTray() } catch (e) { console.error('Fallback failed to create main window', e) }
                                        }
                                        try { if (win) { win.show(); win.focus() } } catch (e) { console.error('Fallback failed to show main window', e) }
                                    }
                                } catch (e) { console.error('Error during post-splash fallback check', e) }
                            }, 750)
                        } catch { void 0 }

                        try { if (splashWin) { splashWin.close(); splashWin = null } } catch { void 0 }
                        clearInterval(timer)
                        return
                    }
                    waited += pollInterval
                    if (waited >= maxWait) {
                        // give up and close splash to avoid blocking forever
                        try { if (splashWin) { splashWin.close(); splashWin = null } } catch { void 0 }
                        clearInterval(timer)
                    }
                }

                const timer = setInterval(checkAndClose, pollInterval)
                // start checking after remaining ms to respect min display
                setTimeout(() => checkAndClose(), remaining)
            })
            // We created the splash and will continue startup once the preloader
            // signals completion. Return here to avoid running the duplicate
            // legal/createWindow logic below and accidentally creating two apps.
            return
        } catch (err) {
            console.error('Failed to create splash window', err)
            startAfterPrechecks()
        }
        // If legal not accepted, show legal window first, otherwise create main window
        try {
            ConfigManager.load()
            // If this is a canary build, and user has not acknowledged canary warnings,
            // show a short modal that warns about possible instability. The dialog
            // requires at least 10 seconds before the user can accept and has a
            // "don't show again" checkbox.
            const isCanaryBuild = pjson.version.includes('canary')
            if (!ranInitialDialogs && isCanaryBuild && !ConfigManager.getCanaryAcknowledged()) {
                let canaryWin = new BrowserWindow({
                    width: 600,
                    height: 400,
                    resizable: false,
                    modal: !!(win || splashWin),
                    parent: win || splashWin || null,
                    show: false,
                    icon: getPlatformIcon('vis-icon'),
                    webPreferences: {
                        nodeIntegration: true,
                        contextIsolation: false
                    }
                })
                remoteMain.enable(canaryWin.webContents)

                ejse.data('lang', (str, placeHolders) => LangLoader.queryEJS(str, placeHolders))
                const canaryWebsiteURL = 'https://visoftware.dev/launcher'
                ejse.data('websiteURL', canaryWebsiteURL)

                canaryWin.loadURL(pathToFileURL(path.join(__dirname, 'app', 'canary.ejs')).toString())
                canaryWin.removeMenu()
                canaryWin.once('ready-to-show', () => canaryWin.show())

                const { ipcMain } = require('electron')
                ipcMain.once('canary-ack', (evt, dontAsk) => {
                    if (suppressDialogIPC) {
                        return
                    }
                    if (dontAsk) {
                        try { ConfigManager.setCanaryAcknowledged(pjson.version) } catch (e) { console.error('Failed to persist canary acknowledgement', e) }
                    }
                    ejse.data('websiteURL', 'https://visoftware.dev')
                    try { canaryWin.close() } catch (err) { console.error('Error closing canary window', err) }
                    // After canary dialog, we must re-check legal acceptance and
                    // only create the main window if legal was accepted for this
                    // version. This prevents the canary dialog from skipping the
                    // legal acceptance flow.
                    startAfterPrechecks()
                })
                ipcMain.once('canary-close', () => {
                    ejse.data('websiteURL', 'https://visoftware.dev')
                    try { canaryWin.close() } catch (err) { console.error('Error closing canary window', err) }
                    app.quit()
                })

                // Wait here and skip creating the main window until user responds
                return
            }
            if (!ranInitialDialogs && !ConfigManager.getLegalAccepted()) {
                legalWin = new BrowserWindow({
                    width: 960,
                    height: 720,
                    resizable: false,
                    modal: !!(win || splashWin),
                    parent: win || splashWin || null,
                    show: false,
                    icon: getPlatformIcon('vis-icon'),
                    webPreferences: {
                        nodeIntegration: true,
                        contextIsolation: false
                    }
                })
                remoteMain.enable(legalWin.webContents)
                legalWin.loadURL(pathToFileURL(path.join(__dirname, 'app', 'legal.ejs')).toString())
                legalWin.removeMenu()
                legalWin.once('ready-to-show', () => legalWin.show())
                legalWin.on('closed', () => { legalWin = null })
            } else {
                createWindow()
                createMenu()
                createTray()
                try {
                    if (!splashWin && win) {
                        win.once && win.once('ready-to-show', () => {
                            try { if (win.isMinimized && win.isMinimized()) win.restore(); win.show() } catch { void 0 }
                        })
                    }
                } catch { void 0 }
            }
        } catch (err) {
            console.error('Failed to load configuration for legal check', err)
            // If anything goes wrong, show legal window as safe default
            legalWin = new BrowserWindow({
                width: 960,
                height: 720,
                resizable: false,
                modal: !!win,
                parent: win || null,
                show: false,
                icon: getPlatformIcon('vis-icon'),
                webPreferences: {
                    nodeIntegration: true,
                    contextIsolation: false
                }
            })
            remoteMain.enable(legalWin.webContents)
            legalWin.loadURL(pathToFileURL(path.join(__dirname, 'app', 'legal.ejs')).toString())
            legalWin.removeMenu()
            legalWin.once('ready-to-show', () => legalWin.show())
            legalWin.on('closed', () => { legalWin = null })
        }
    })
}

app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
        createWindow()
    }
})
