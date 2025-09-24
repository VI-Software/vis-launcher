/*
    ____   ____.___    _________       _____  __                                 
\   \ /   /|   |  /   _____/ _____/ ____\/  |___  _  _______ _______   ____  
 \   Y   / |   |  \_____  \ /  _ \   __\\   __\ \/ \/ /\__  \\_  __ \_/ __ \ 
  \     /  |   |  /        (  <_> )  |   |  |  \     /  / __ \|  | \/\  ___/ 
   \___/   |___| /_______  /\____/|__|   |__|   \/\_/  (____  /__|    \___  >
                         \/                                 \/            \/ 
                         
                         
    © 2025 VI Software. Todos los derechos reservados.
    
    GitHub: https://github.com/VI-Software
    Documentación: https://docs.visoftware.dev/vi-software/vis-launcher
    Web: https://visoftware.dev
    Licencia del proyecto: https://github.com/VI-Software/vis-launcher/blob/main/LICENSE

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

// Handle legal acceptance/decline from legal window
let legalWin
ipcMain.on('legal-accepted', (event) => {
    try {
        ConfigManager.load()
    } catch (err) {
        console.error('Error loading config before setting legal acceptance', err)
    }
    ConfigManager.setLegalAccepted(pjson.version)
    if (legalWin) {
        legalWin.close()
    }
    // Show main window after legal acceptance
    try {
        if (!win) {
            createWindow()
            createMenu()
            createTray()
        } else {
            win.show()
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

function createWindow() {
    // Determine if the version includes 'nightly' or 'canary' to enable prerelease features
    const isNightly = pjson.version.includes('nightly')
    const isCanary = pjson.version.includes('canary')

    win = new BrowserWindow({
        width: 980,
        height: 552,
        icon: getPlatformIcon('vis-icon'),
        frame: false,
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

    /*win.once('ready-to-show', () => {
        win.show()
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
    
    // Initialize language and then create the window when app is ready
    app.whenReady().then(() => {
        let locale = ''
        try {
            if (process.platform === 'win32') {
                locale = app.getLocale()
            } else {
                // macOS/Linux
                locale = process.env.LANG || 
                         process.env.LC_ALL || 
                         process.env.LC_MESSAGES || 
                         process.env.LANGUAGE
                
                if (locale) {
                    // Format: en_US.UTF-8 -> en-US
                    locale = locale.split('.')[0].replace('_', '-')
                } else {
                    locale = app.getLocale()
                }
            }
        } catch (error) {
            console.error('Error detecting system locale:', error)
            locale = 'en_US'
        }
        
        LangLoader.setupLanguage(locale)
        
        function startAfterPrechecks(){
            try {
                ConfigManager.load()
            } catch (err) {
                console.error('Error loading config before post-canary checks', err)
            }

            if (!ConfigManager.getLegalAccepted()) {
                legalWin = new BrowserWindow({
                    width: 960,
                    height: 720,
                    resizable: false,
                    modal: true,
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
            } else {
                createWindow()
                createMenu()
                createTray()
            }
        }

        // If legal not accepted, show legal window first, otherwise create main window
        try {
            ConfigManager.load()
            // If this is a canary build, and user has not acknowledged canary warnings,
            // show a short modal that warns about possible instability. The dialog
            // requires at least 10 seconds before the user can accept and has a
            // "don't show again" checkbox.
            const isCanaryBuild = pjson.version.includes('canary')
            if (isCanaryBuild && !ConfigManager.getCanaryAcknowledged()) {
                let canaryWin = new BrowserWindow({
                    width: 520,
                    height: 260,
                    resizable: false,
                    modal: true,
                    parent: win || null,
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
                    if (dontAsk) ConfigManager.setCanaryAcknowledged(pjson.version)
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
            if (!ConfigManager.getLegalAccepted()) {
                legalWin = new BrowserWindow({
                    width: 960,
                    height: 720,
                    resizable: false,
                    modal: true,
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
            } else {
                createWindow()
                createMenu()
                createTray()
            }
        } catch (err) {
            console.error('Failed to load configuration for legal check', err)
            // If anything goes wrong, show legal window as safe default
            legalWin = new BrowserWindow({
                width: 960,
                height: 720,
                resizable: false,
                modal: true,
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
