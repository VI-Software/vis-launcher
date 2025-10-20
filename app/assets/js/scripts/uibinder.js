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


/**
 * Initialize UI functions which depend on internal modules.
 * Loaded after core UI functions are initialized in uicore.js.
 */
// Requirements
const path = require('path')
const app = require('electron')
const https = require('https')
const { Type } = require('@visoftware/distribution-types')

const AuthManager = require('./assets/js/authmanager')
const ConfigManager = require('./assets/js/configmanager')
const { DistroAPI } = require('./assets/js/distromanager')
const { error } = require('console')
const { API_BASE_URL } = require('./assets/js/apiconstants')

let rscShouldLoad = false
let fatalStartupError = false


// Mapping of each view to their container IDs.
const VIEWS = {
    landing: '#landingContainer',
    loginOptions: '#loginOptionsContainer',
    login: '#loginContainer',
    settings: '#settingsContainer',
    welcome: '#welcomeContainer',
    waiting: '#waitingContainer'
}

// The currently shown view container.
let currentView

/**
 * Switch launcher views.
 * 
 * @param {string} current The ID of the current view container. 
 * @param {*} next The ID of the next view container.
 * @param {*} currentFadeTime Optional. The fade out time for the current view.
 * @param {*} nextFadeTime Optional. The fade in time for the next view.
 * @param {*} onCurrentFade Optional. Callback function to execute when the current
 * view fades out.
 * @param {*} onNextFade Optional. Callback function to execute when the next view
 * fades in.
 */
function switchView(current, next, currentFadeTime = 500, nextFadeTime = 500, onCurrentFade = () => { }, onNextFade = () => { }) {
    currentView = next
    $(`${current}`).fadeOut(currentFadeTime, async () => {
        await onCurrentFade()
        $(`${next}`).fadeIn(nextFadeTime, async () => {
            await onNextFade()
        })
    })
}

/**
 * Get the currently shown view container.
 * 
 * @returns {string} The currently shown view container.
 */
function getCurrentView() {
    return currentView
}

async function showMainUI(data) {
    if (!isDev) {
        loggerAutoUpdater.info('Initializing..')
        ipcRenderer.send('autoUpdateAction', 'initAutoUpdater', ConfigManager.getAllowPrerelease())
    }
    try {
        // Clear the server list and build status from the local storage to prevent any issues and abuse
        localStorage.removeItem('serverList')
        localStorage.removeItem('buildstatus')
        localStorage.removeItem('disableHttpd')
        localStorage.removeItem('authlibDebug')
    }catch(err){
        console.error(err)
    }

    await prepareSettings(true)
    updateSelectedServer(data.getServerById(ConfigManager.getSelectedServer()))
    refreshServerStatus()

    try {
        const response = await fetch(API_BASE_URL + '/services/images/all')
        if (!response.ok) throw new Error('Network response was not ok')

        const data = await response.json()
        if (!data || !Array.isArray(data.images) || data.images.length === 0) {
            throw new Error('No images returned from API')
        }

        const images = data.images
        const rand = Math.floor(Math.random() * images.length)
        const chosen = images[rand]

        let bgUrl = null
        if (chosen && typeof chosen === 'object') {
            if (chosen.url && typeof chosen.url === 'string' && chosen.url.trim() !== '') {
                bgUrl = chosen.url
            } else if (chosen.name && typeof chosen.name === 'string' && chosen.name.trim() !== '') {
                const base = API_BASE_URL.replace(/\/+$|\/$/g, '')
                bgUrl = `${base}/backgrounds/${encodeURIComponent(chosen.name)}`
            }
        }

        if (!bgUrl) throw new Error('Invalid image data')
        document.getElementById('frameBar').style.backgroundColor = 'rgba(0, 0, 0, 0.5)'

        try {
            const cacheKey = 'bgCache'
            const cacheRaw = localStorage.getItem(cacheKey)
            const cache = cacheRaw ? JSON.parse(cacheRaw) : {}
            const entry = cache[bgUrl]

            const TTL = 24 * 60 * 60 * 1000 // 24 hours
            if (entry && entry.timestamp && (Date.now() - entry.timestamp) < TTL) {
                document.body.style.backgroundImage = `url('${entry.dataUrl}')`
            } else {
                const headers = {}
                if (entry && entry.etag) headers['If-None-Match'] = entry.etag
                if (entry && entry.lastModified) headers['If-Modified-Since'] = entry.lastModified

                let resp
                try {
                    resp = await fetch(bgUrl, { headers, cache: 'no-store' })
                } catch (err) {
                    if (entry && entry.dataUrl) document.body.style.backgroundImage = `url('${entry.dataUrl}')`
                    else { document.body.style.backgroundImage = `url('${bgUrl}')`; showBGSWarning() }
                    resp = null
                }

                if (resp) {
                    if (resp.status === 304 && entry && entry.dataUrl) {
                        // server says not modified: extend TTL and reuse
                        entry.timestamp = Date.now()
                        try { localStorage.setItem(cacheKey, JSON.stringify(cache)) } catch (e) { console.warn('save bg cache failed', e) }
                        document.body.style.backgroundImage = `url('${entry.dataUrl}')`
                    } else if (resp.ok) {
                        const blob = await resp.blob()
                        const dataUrl = await new Promise((res, rej) => {
                            const reader = new FileReader()
                            reader.onload = () => res(reader.result)
                            reader.onerror = rej
                            reader.readAsDataURL(blob)
                        })
                        const newEtag = resp.headers.get('etag') || null
                        const newLM = resp.headers.get('last-modified') || null
                        cache[bgUrl] = { dataUrl, etag: newEtag, lastModified: newLM, timestamp: Date.now() }
                        try { localStorage.setItem(cacheKey, JSON.stringify(cache)) } catch (e) { console.warn('save bg cache failed', e) }
                        document.body.style.backgroundImage = `url('${dataUrl}')`
                    } else {
                        if (entry && entry.dataUrl) document.body.style.backgroundImage = `url('${entry.dataUrl}')`
                        else { document.body.style.backgroundImage = `url('${bgUrl}')`; showBGSWarning() }
                    }
                }
            }
        } catch (e) {
            console.error('Background cache error:', e)
            document.body.style.backgroundImage = `url('${bgUrl}')`
            showBGSWarning()
        }
    } catch (error) {
        // On any error, fallback to offline background
        console.error('Failed to fetch background image:', error)
        document.getElementById('frameBar').style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
        document.body.style.backgroundImage = 'url(\'assets/images/backgrounds/offline.jpg\')'
        showBGSWarning()
    }

    $('#main').show()

    const isLoggedIn = Object.keys(ConfigManager.getAuthAccounts()).length > 0

    // If this is enabled in a development environment, we'll get ratelimited.
    // The relaunch frequency is usually far too high.
    if (!isDev && isLoggedIn) {
        validateSelectedAccount()
    }

    if (ConfigManager.isFirstLaunch()) {
        currentView = VIEWS.welcome
        $(VIEWS.welcome).fadeIn(1000)
    } else {
        if (isLoggedIn) {
            currentView = VIEWS.landing
            $(VIEWS.landing).fadeIn(1000)
        } else {
            loginOptionsCancelEnabled(false)
            loginOptionsViewOnLoginSuccess = VIEWS.landing
            loginOptionsViewOnLoginCancel = VIEWS.loginOptions
            currentView = VIEWS.loginOptions
            $(VIEWS.loginOptions).fadeIn(1000)
        }
    }

    setTimeout(() => {
        $('#loadingContainer').fadeOut(500, () => {
            $('#loadSpinnerImage').removeClass('rotating')
        })

        // Continue with the rest of the logic
        const checkver = true
        continueMainUILogic(checkver)
    }, 250)
}




function continueMainUILogic(checkver) {
    const isLoggedIn = Object.keys(ConfigManager.getAuthAccounts()).length > 0

    // Performs various checks to verify the version status
    if(checkver==true){
        checkVersionStatus()
            .then(status => {
                if(status.maintained==true){
                    console.log('This version is officially maintained by VI Software')
                    localStorage.setItem('buildstatus', 'maintained')
                }else if(status.maintained==false && status.forceupdate==false){
                    localStorage.setItem('buildstatus', 'notsupported')
                }else{
                    localStorage.setItem('buildstatus', 'forceupdate')
                }
            })
            .catch(error => {
                console.error('Couldn\'t verify the version status:', error)
                showForceUpdate()
            })
    }
    // If this is enabled in a development environment we'll get ratelimited.
    // The relaunch frequency is usually far too high.
    if (!isDev && isLoggedIn) {
        validateSelectedAccount()
    }
    if (ConfigManager.isFirstLaunch()) {
        currentView = VIEWS.welcome
        $(VIEWS.welcome).fadeIn(1000)
    } else {
        if (isLoggedIn) {
            currentView = VIEWS.landing
            $(VIEWS.landing).fadeIn(1000)
        } else {
            loginOptionsCancelEnabled(false)
            loginOptionsViewOnLoginSuccess = VIEWS.landing
            loginOptionsViewOnLoginCancel = VIEWS.loginOptions
            currentView = VIEWS.loginOptions
            $(VIEWS.loginOptions).fadeIn(1000)
        }
    }

    setTimeout(() => {
        $('#loadingContainer').fadeOut(500, () => {
            $('#loadSpinnerImage').removeClass('rotating')
        })
    }, 250)

    // Disable tabbing to the news container.
    initNews().then(() => {
        $('#newsContainer *').attr('tabindex', '-1')
    })
}

function showFatalStartupError() {
    setTimeout(() => {
        $('#loadingContainer').fadeOut(250, () => {
            document.getElementById('overlayContainer').style.background = 'none'
            setOverlayContent(
                Lang.queryJS('uibinder.startup.fatalErrorTitle'),
                Lang.queryJS('uibinder.startup.fatalErrorMessage'),
                Lang.queryJS('uibinder.startup.closeButton')
            )
            setOverlayHandler(() => {
                const window = remote.getCurrentWindow()
                window.close()
            })
            toggleOverlay(true)
        })
    }, 750)
}

// Shows a screen forcing the user to close the launcher and update

function showForceUpdate() {
    setTimeout(() => {
        $('#loadingContainer').fadeOut(250, () => {
            document.getElementById('overlayContainer').style.background = 'none'
            setOverlayContent(
                Lang.queryJS('uibinder.forceupdate.forceupdateErrorTitle'),
                Lang.queryJS('uibinder.forceupdate.forceupdateErrorMessage'),
                Lang.queryJS('uibinder.forceupdate.closeButton')
            )
            setOverlayHandler(() => {
                const window = remote.getCurrentWindow()
                window.close()
            })
            toggleOverlay(true)
        })
    }, 750)
}

// Show a notification telling the user to update the launcher as soon as possible, but with the option of ignoring the warning

function showUnmantainedVersion() {
    setTimeout(() => {
        $('#loadingContainer').fadeOut(250, () => {
            document.getElementById('overlayContainer').style.background = 'none'
            setOverlayContent(
                Lang.queryJS('uibinder.unmantained.unmantainedErrorTitle'),
                Lang.queryJS('uibinder.unmantained.unmantainedErrorMessage'),
                Lang.queryJS('uibinder.unmantained.ignoreButton')
            )
            setOverlayHandler(() => {
                toggleOverlay(false)
            })
            toggleOverlay(true)
        })
    }, 750)
}

// Show a notification informing the user that it wasn't possible to connect to the main api, and as a result, the process cannot be continued

function showAPIError() {
    setTimeout(() => {
        $('#loadingContainer').fadeOut(250, () => {
            document.getElementById('overlayContainer').style.background = 'none'
            setOverlayContent(
                Lang.queryJS('uibinder.fatalapierror.fatalapierrorErrorTitle'),
                Lang.queryJS('uibinder.fatalapierror.fatalapierrorErrorMessage'),
                Lang.queryJS('uibinder.fatalapierror.closeButton')
            )
            setOverlayHandler(() => {
                const window = remote.getCurrentWindow()
                window.close()
            })
            toggleOverlay(true)
        })
    }, 750)
}


// Connects to the API server of the launcher and checks the current version status

function checkVersionStatus() {
    // Parse the API_BASE_URL
    const apiUrl = new URL(API_BASE_URL)
    
    const options = {
        hostname: apiUrl.hostname,
        path: `/services/launcher/v2/version?version=${remote.app.getVersion()}`,
        family: 4,
        method: 'GET',
        headers: {
            'Host': apiUrl.hostname,
            'User-Agent': 'VI Software Launcher/' + process.version
        }
    }
    
    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = ''

            res.on('data', chunk => {
                data += chunk
            })

            res.on('end', () => {
                try {
                    const result = JSON.parse(data)
                    resolve(result)
                } catch (error) {
                    console.error('Failed to parse response:', error)
                    reject(error)
                }
            })
        })

        req.on('error', (error) => {
            console.error('Request failed:', error)
            reject(error)
        })

        req.end()
    })
}
function showBGSWarning() {
    setTimeout(() => {
        $('#loadingContainer').fadeOut(250, () => {
            document.getElementById('overlayContainer').style.background = 'none'
            setOverlayContent(
                Lang.queryJS('uibinder.bgservicewarning.bgservicewarningErrorTitle'),
                Lang.queryJS('uibinder.bgservicewarning.bgservicewarningErrorMessage'),
                Lang.queryJS('uibinder.bgservicewarning.ignoreButton')
            )
            setOverlayHandler(() => {
                toggleOverlay(false)
            })
            toggleOverlay(true)
        })
    }, 750)
}


/**
 * Common functions to perform after refreshing the distro index.
 * 
 * @param {Object} data The distro index object.
 */
function onDistroRefresh(data) {
    updateSelectedServer(data.getServerById(ConfigManager.getSelectedServer()))
    refreshServerStatus()
    initNews()
    syncModConfigurations(data)
    ensureJavaSettings(data)
}

/**
 * Sync the mod configurations with the distro index.
 * 
 * @param {Object} data The distro index object.
 */
function syncModConfigurations(data) {

    const syncedCfgs = []

    for (let serv of data.servers) {

        const id = serv.rawServer.id
        const mdls = serv.modules
        const cfg = ConfigManager.getModConfiguration(id)

        if (cfg != null) {

            const modsOld = cfg.mods
            const mods = {}

            for (let mdl of mdls) {
                const type = mdl.rawModule.type

                if (type === Type.ForgeMod || type === Type.LiteMod || type === Type.LiteLoader || type === Type.FabricMod) {
                    if (!mdl.getRequired().value) {
                        const mdlID = mdl.getVersionlessMavenIdentifier()
                        if (modsOld[mdlID] == null) {
                            mods[mdlID] = scanOptionalSubModules(mdl.subModules, mdl)
                        } else {
                            mods[mdlID] = mergeModConfiguration(modsOld[mdlID], scanOptionalSubModules(mdl.subModules, mdl), false)
                        }
                    } else {
                        if (mdl.subModules.length > 0) {
                            const mdlID = mdl.getVersionlessMavenIdentifier()
                            const v = scanOptionalSubModules(mdl.subModules, mdl)
                            if (typeof v === 'object') {
                                if (modsOld[mdlID] == null) {
                                    mods[mdlID] = v
                                } else {
                                    mods[mdlID] = mergeModConfiguration(modsOld[mdlID], v, true)
                                }
                            }
                        }
                    }
                }
            }

            syncedCfgs.push({
                id,
                mods
            })

        } else {

            const mods = {}

            for (let mdl of mdls) {
                const type = mdl.rawModule.type
                if (type === Type.ForgeMod || type === Type.LiteMod || type === Type.LiteLoader || type === Type.FabricMod) {
                    if (!mdl.getRequired().value) {
                        mods[mdl.getVersionlessMavenIdentifier()] = scanOptionalSubModules(mdl.subModules, mdl)
                    } else {
                        if (mdl.subModules.length > 0) {
                            const v = scanOptionalSubModules(mdl.subModules, mdl)
                            if (typeof v === 'object') {
                                mods[mdl.getVersionlessMavenIdentifier()] = v
                            }
                        }
                    }
                }
            }

            syncedCfgs.push({
                id,
                mods
            })

        }
    }

    ConfigManager.setModConfigurations(syncedCfgs)
    ConfigManager.save()
}

/**
 * Ensure java configurations are present for the available servers.
 * 
 * @param {Object} data The distro index object.
 */
function ensureJavaSettings(data) {

    // Nothing too fancy for now.
    for (const serv of data.servers) {
        ConfigManager.ensureJavaConfig(serv.rawServer.id, serv.effectiveJavaOptions, serv.rawServer.javaOptions?.ram)
    }

    ConfigManager.save()
}

/**
 * Recursively scan for optional sub modules. If none are found,
 * this function returns a boolean. If optional sub modules do exist,
 * a recursive configuration object is returned.
 * 
 * @returns {boolean | Object} The resolved mod configuration.
 */
function scanOptionalSubModules(mdls, origin) {
    if (mdls != null) {
        const mods = {}

        for (let mdl of mdls) {
            const type = mdl.rawModule.type
            // Optional types.
            if (type === Type.ForgeMod || type === Type.LiteMod || type === Type.LiteLoader || type === Type.FabricMod) {
                // It is optional.
                if (!mdl.getRequired().value) {
                    mods[mdl.getVersionlessMavenIdentifier()] = scanOptionalSubModules(mdl.subModules, mdl)
                } else {
                    if (mdl.hasSubModules()) {
                        const v = scanOptionalSubModules(mdl.subModules, mdl)
                        if (typeof v === 'object') {
                            mods[mdl.getVersionlessMavenIdentifier()] = v
                        }
                    }
                }
            }
        }

        if (Object.keys(mods).length > 0) {
            const ret = {
                mods
            }
            if (!origin.getRequired().value) {
                ret.value = origin.getRequired().def
            }
            return ret
        }
    }
    return origin.getRequired().def
}

/**
 * Recursively merge an old configuration into a new configuration.
 * 
 * @param {boolean | Object} o The old configuration value.
 * @param {boolean | Object} n The new configuration value.
 * @param {boolean} nReq If the new value is a required mod.
 * 
 * @returns {boolean | Object} The merged configuration.
 */
function mergeModConfiguration(o, n, nReq = false) {
    if (typeof o === 'boolean') {
        if (typeof n === 'boolean') return o
        else if (typeof n === 'object') {
            if (!nReq) {
                n.value = o
            }
            return n
        }
    } else if (typeof o === 'object') {
        if (typeof n === 'boolean') return typeof o.value !== 'undefined' ? o.value : true
        else if (typeof n === 'object') {
            if (!nReq) {
                n.value = typeof o.value !== 'undefined' ? o.value : true
            }

            const newMods = Object.keys(n.mods)
            for (let i = 0; i < newMods.length; i++) {

                const mod = newMods[i]
                if (o.mods[mod] != null) {
                    n.mods[mod] = mergeModConfiguration(o.mods[mod], n.mods[mod])
                }
            }

            return n
        }
    }
    // If for some reason we haven't been able to merge,
    // wipe the old value and use the new one. Just to be safe
    return n
}

async function validateSelectedAccount() {
    const selectedAcc = ConfigManager.getSelectedAccount()
    if (selectedAcc != null) {
        const val = await AuthManager.validateSelected()
        if (!val) {
            ConfigManager.removeAuthAccount(selectedAcc.uuid)
            ConfigManager.save()
            const accLen = Object.keys(ConfigManager.getAuthAccounts()).length
            setOverlayContent(
                Lang.queryJS('uibinder.validateAccount.failedMessageTitle'),
                accLen > 0
                    ? Lang.queryJS('uibinder.validateAccount.failedMessage', { 'account': selectedAcc.displayName })
                    : Lang.queryJS('uibinder.validateAccount.failedMessageSelectAnotherAccount', { 'account': selectedAcc.displayName }),
                Lang.queryJS('uibinder.validateAccount.loginButton'),
                Lang.queryJS('uibinder.validateAccount.selectAnotherAccountButton')
            )
            setOverlayHandler(() => {

                // Mojang
                // For convenience, pre-populate the username of the account.
                document.getElementById('loginUsername').value = selectedAcc.username
                validateEmail(selectedAcc.username)

                loginOptionsViewOnLoginSuccess = getCurrentView()
                loginOptionsViewOnLoginCancel = VIEWS.loginOptions

                if (accLen > 0) {
                    loginOptionsViewOnCancel = getCurrentView()
                    loginOptionsViewCancelHandler = () => {
                        ConfigManager.addMojangAuthAccount(selectedAcc.uuid, selectedAcc.accessToken, selectedAcc.username, selectedAcc.displayName)
                        ConfigManager.save()
                        validateSelectedAccount()
                    }
                    loginOptionsCancelEnabled(true)
                } else {
                    loginOptionsCancelEnabled(false)
                }
                toggleOverlay(false)
                switchView(getCurrentView(), VIEWS.loginOptions)
            })
            setDismissHandler(() => {
                if (accLen > 1) {
                    prepareAccountSelectionList()
                    $('#overlayContent').fadeOut(250, () => {
                        bindOverlayKeys(true, 'accountSelectContent', true)
                        $('#accountSelectContent').fadeIn(250)
                    })
                } else {
                    const accountsObj = ConfigManager.getAuthAccounts()
                    const accounts = Array.from(Object.keys(accountsObj), v => accountsObj[v])
                    // This function validates the account switch.
                    setSelectedAccount(accounts[0].uuid)
                    toggleOverlay(false)
                }
            })
            toggleOverlay(true, accLen > 0)
        } else {
            return true
        }
    } else {
        return true
    }
}

/**
 * Temporary function to update the selected account along
 * with the relevent UI elements.
 * 
 * @param {string} uuid The UUID of the account.
 */
function setSelectedAccount(uuid) {
    const authAcc = ConfigManager.setSelectedAccount(uuid)
    ConfigManager.save()
    updateSelectedAccount(authAcc)
    validateSelectedAccount()
}

// Synchronous Listener
document.addEventListener('readystatechange', async () => {

    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        if (rscShouldLoad) {
            rscShouldLoad = false
            if (!fatalStartupError) {
                const data = await DistroAPI.getDistribution()
                await showMainUI(data)
            } else {
                showFatalStartupError()
            }
        }
    }

}, false)

// Actions that must be performed after the distribution index is downloaded.
ipcRenderer.on('distributionIndexDone', async (event, res) => {
    if (res) {
        const data = await DistroAPI.getDistribution()
        syncModConfigurations(data)
        ensureJavaSettings(data)
        if (document.readyState === 'interactive' || document.readyState === 'complete') {
            await showMainUI(data)
        } else {
            rscShouldLoad = true
        }
    } else {
        fatalStartupError = true
        if (document.readyState === 'interactive' || document.readyState === 'complete') {
            showFatalStartupError()
        } else {
            rscShouldLoad = true
        }
    }
})

// Utils for development

/* Sets a custom port for the httpd server used by the authlib injector
 Value is null by default, which means the port will be randomly chosen */

async function debug_getHelp() {
    console.log('function debug_getHelp() - shows this help message')
    console.log('function debug_devModeToggle() - toggles distro dev mode')
    console.log('function debug_toggledisableHttpd() - toggles the flag disableHttpd for the authlib injector')
    console.log('function debug_toggleAuthLibDebug(mode) - toggles debug mode for the authlib injector. Available options: verbose, authlib, dumpClass, printUntransformed')
}

/* Toggle distro dev mode */

async function debug_devModeToggle() {
    DistroAPI.toggleDevMode(true)
    const data = await DistroAPI.refreshDistributionOrFallback()
    ensureJavaSettings(data)
    updateSelectedServer(data.servers[0])
    syncModConfigurations(data)
}


/* Toggles the flag disableHttpd for authlib injector */

async function debug_toggledisableHttpd() {
    if(localStorage.getItem('disableHttpd')){
        localStorage.removeItem('disableHttpd')
        console.log('Httpd server enabled')
    }else{
        localStorage.setItem('disableHttpd', true)
        console.log('Httpd server disabled')
    }
}


/* Toggles debug mode for the authlib injector 
    Avilable options: verbose, authlib, dumpClass, printUntransformed
*/


async function debug_toggleAuthLibDebug(mode){
    if(mode){
        if(mode=='verbose' || mode=='authlib' || mode=='dumpClass' || mode=='printUntransformed'){
            console.log('Authlib debug mode enabled at level', mode)
            localStorage.setItem('authlibDebug', mode)
        }else{
            console.log('Invalid debug mode')
        }
    }else{
        localStorage.removeItem('authlibDebug')
        console.log('Authlib debug mode disabled')
    }
}