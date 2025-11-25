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

const fs   = require('fs-extra')
const { LoggerUtil } = require('@visoftware/vis-launcher-core')
const os   = require('os')
const path = require('path')

const logger = LoggerUtil.getLogger('ConfigManager')
const pjson = require('../../../package.json')

const sysRoot = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME)

const dataPath = path.join(sysRoot, '.visdev-launcher')

let launcherDir
try {
    // In renderer processes the '@electron/remote' package is used.
    // In the main process require('@electron/remote') will throw, so fall back to electron.app
    launcherDir = require('@electron/remote').app.getPath('userData')
} catch {
    const { app: electronApp } = require('electron')
    launcherDir = electronApp.getPath('userData')
}


/**
 * Retrieve the absolute path of the launcher directory.
 * 
 * @returns {string} The absolute path of the launcher directory.
 */
exports.getLauncherDirectory = function(){
    return launcherDir
}

/**
 * Get the launcher's data directory. This is where all files related
 * to game launch are installed (common, instances, java, etc).
 * 
 * @returns {string} The absolute path of the launcher's data directory.
 */
exports.getDataDirectory = function(def = false){
    return !def ? config.settings.launcher.dataDirectory : DEFAULT_CONFIG.settings.launcher.dataDirectory
}

/**
 * Set the new data directory.
 * 
 * @param {string} dataDirectory The new data directory.
 */
exports.setDataDirectory = function(dataDirectory){
    config.settings.launcher.dataDirectory = dataDirectory
}

const configPath = path.join(exports.getLauncherDirectory(), 'config.json')
const configPathLEGACY = path.join(dataPath, 'config.json')
const firstLaunch = !fs.existsSync(configPath) && !fs.existsSync(configPathLEGACY)

exports.getAbsoluteMinRAM = function(ram){
    if(ram?.minimum != null) {
        return ram.minimum/1024
    } else {
        // Legacy behavior
        const mem = os.totalmem()
        return mem >= (6*1073741824) ? 3 : 2
    }
}

exports.getAbsoluteMaxRAM = function(ram){
    const mem = os.totalmem()
    const gT16 = mem-(16*1073741824)
    return Math.floor((mem-(gT16 > 0 ? (Number.parseInt(gT16/8) + (16*1073741824)/4) : mem/4))/1073741824)
}

function resolveSelectedRAM(ram) {
    if(ram?.recommended != null) {
        return `${ram.recommended}M`
    } else {
        // Legacy behavior
        const mem = os.totalmem()
        return mem >= (8*1073741824) ? '4G' : (mem >= (6*1073741824) ? '3G' : '2G')
    }
}

/**
 * Three types of values:
 * Static = Explicitly declared.
 * Dynamic = Calculated by a private function.
 * Resolved = Resolved externally, defaults to null.
 */
const DEFAULT_CONFIG = {
    settings: {
        game: {
            resWidth: 1280,
            resHeight: 720,
            fullscreen: false,
            MinimizeOnLaunch: true,
            autoConnect: true,
            launchDetached: true
        },
        launcher: {
            allowPrerelease: false,
            dataDirectory: dataPath,
            legalAcceptedVersion: null,
            canaryAcknowledgedVersion: null,
            christmasSnowflakes: true,
            guestModeEnabled: true
        }
    },
    newsCache: {
        date: null,
        content: null,
        dismissed: false
    },
    clientToken: null,
    selectedServer: null,
    selectedAccount: null,
    authenticationDatabase: {},
    modConfigurations: [],
    javaConfig: {}
}

let config = null

// Persistance Utility Functions

/**
 * Save the current configuration to a file.
 */
exports.save = function(){
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'UTF-8')
}

/**
 * Load the configuration into memory. If a configuration file exists,
 * that will be read and saved. Otherwise, a default configuration will
 * be generated. Note that "resolved" values default to null and will
 * need to be externally assigned.
 */
exports.load = function(){
    let doLoad = true

    if(!fs.existsSync(configPath)){
        // Create all parent directories.
        fs.ensureDirSync(path.join(configPath, '..'))
        if(fs.existsSync(configPathLEGACY)){
            fs.moveSync(configPathLEGACY, configPath)
        } else {
            doLoad = false
            config = DEFAULT_CONFIG
            exports.save()
        }
    }
    if(doLoad){
        let doValidate = false
        try {
            config = JSON.parse(fs.readFileSync(configPath, 'UTF-8'))
            doValidate = true
        } catch (err){
            logger.error(err)
            logger.info('Configuration file contains malformed JSON or is corrupt.')
            logger.info('Generating a new configuration file.')
            fs.ensureDirSync(path.join(configPath, '..'))
            config = DEFAULT_CONFIG
            exports.save()
        }
        if(doValidate){
            config = validateKeySet(DEFAULT_CONFIG, config)
            exports.save()
        }
    }
    logger.info('Successfully Loaded')
}

/**
 * @returns {boolean} Whether or not the manager has been loaded.
 */
exports.isLoaded = function(){
    return config != null
}

/**
 * Validate that the destination object has at least every field
 * present in the source object. Assign a default value otherwise.
 * 
 * @param {Object} srcObj The source object to reference against.
 * @param {Object} destObj The destination object.
 * @returns {Object} A validated destination object.
 */
function validateKeySet(srcObj, destObj){
    if(srcObj == null){
        srcObj = {}
    }
    const validationBlacklist = ['authenticationDatabase', 'javaConfig']
    const keys = Object.keys(srcObj)
    for(let i=0; i<keys.length; i++){
        if(typeof destObj[keys[i]] === 'undefined'){
            destObj[keys[i]] = srcObj[keys[i]]
        } else if(typeof srcObj[keys[i]] === 'object' && srcObj[keys[i]] != null && !(srcObj[keys[i]] instanceof Array) && validationBlacklist.indexOf(keys[i]) === -1){
            destObj[keys[i]] = validateKeySet(srcObj[keys[i]], destObj[keys[i]])
        }
    }
    return destObj
}

/**
 * Check to see if this is the first time the user has launched the
 * application. This is determined by the existance of the data path.
 * 
 * @returns {boolean} True if this is the first launch, otherwise false.
 */
exports.isFirstLaunch = function(){
    return firstLaunch
}

/**
 * Returns the name of the folder in the OS temp directory which we
 * will use to extract and store native dependencies for game launch.
 * 
 * @returns {string} The name of the folder.
 */
exports.getTempNativeFolder = function(){
    return 'WCNatives'
}

// System Settings (Unconfigurable on UI)

/**
 * Retrieve the news cache to determine
 * whether or not there is newer news.
 * 
 * @returns {Object} The news cache object.
 */
exports.getNewsCache = function(){
    return config.newsCache
}

/**
 * Set the new news cache object.
 * 
 * @param {Object} newsCache The new news cache object.
 */
exports.setNewsCache = function(newsCache){
    config.newsCache = newsCache
}

/**
 * Set whether or not the news has been dismissed (checked)
 * 
 * @param {boolean} dismissed Whether or not the news has been dismissed (checked).
 */
exports.setNewsCacheDismissed = function(dismissed){
    config.newsCache.dismissed = dismissed
}

/**
 * Retrieve the common directory for shared
 * game files (assets, libraries, etc).
 * 
 * @returns {string} The launcher's common directory.
 */
exports.getCommonDirectory = function(){
    return path.join(exports.getDataDirectory(), 'common')
}

/**
 * Retrieve the instance directory for the per
 * server game directories.
 * 
 * @returns {string} The launcher's instance directory.
 */
exports.getInstanceDirectory = function(){
    return path.join(exports.getDataDirectory(), 'instances')
}

/**
 * Retrieve the launcher's Client Token.
 * There is no default client token.
 * 
 * @returns {string} The launcher's Client Token.
 */
exports.getClientToken = function(){
    return config.clientToken
}

/**
 * Set the launcher's Client Token.
 * 
 * @param {string} clientToken The launcher's new Client Token.
 */
exports.setClientToken = function(clientToken){
    config.clientToken = clientToken
}

/**
 * Retrieve the ID of the selected serverpack.
 * 
 * @param {boolean} def Optional. If true, the default value will be returned.
 * @returns {string} The ID of the selected serverpack.
 */
exports.getSelectedServer = function(def = false){
    return !def ? config.selectedServer : DEFAULT_CONFIG.clientToken
}

/**
 * Set the ID of the selected serverpack.
 * 
 * @param {string} serverID The ID of the new selected serverpack.
 */
exports.setSelectedServer = function(serverID){
    config.selectedServer = serverID
}

/**
 * Get an array of each account currently authenticated by the launcher.
 * 
 * @returns {Array.<Object>} An array of each stored authenticated account.
 */
exports.getAuthAccounts = function(){
    return config.authenticationDatabase
}

/**
 * Returns the authenticated account with the given uuid. Value may
 * be null.
 * 
 * @param {string} uuid The uuid of the authenticated account.
 * @returns {Object} The authenticated account with the given uuid.
 */
exports.getAuthAccount = function(uuid){
    return config.authenticationDatabase[uuid]
}

/**
 * Update the access token of an authenticated mojang account.
 * 
 * @param {string} uuid The uuid of the authenticated account.
 * @param {string} accessToken The new Access Token.
 * 
 * @returns {Object} The authenticated account object created by this action.
 */
exports.updateMojangAuthAccount = function(uuid, accessToken){
    config.authenticationDatabase[uuid].accessToken = accessToken
    config.authenticationDatabase[uuid].type = 'mojang' // For gradual conversion.
    return config.authenticationDatabase[uuid]
}

/**
 * Adds an authenticated mojang account to the database to be stored.
 * 
 * @param {string} uuid The uuid of the authenticated account.
 * @param {string} accessToken The accessToken of the authenticated account.
 * @param {string} username The username (usually email) of the authenticated account.
 * @param {string} displayName The in game name of the authenticated account.
 * 
 * @returns {Object} The authenticated account object created by this action.
 */
exports.addMojangAuthAccount = function(uuid, accessToken, username, displayName){
    config.selectedAccount = uuid
    config.authenticationDatabase[uuid] = {
        type: 'mojang',
        accessToken,
        username: username.trim(),
        uuid: uuid.trim(),
        displayName: displayName.trim()
    }
    return config.authenticationDatabase[uuid]
}

/**
 * Remove an authenticated account from the database. If the account
 * was also the selected account, a new one will be selected. If there
 * are no accounts, the selected account will be null.
 * 
 * @param {string} uuid The uuid of the authenticated account.
 * 
 * @returns {boolean} True if the account was removed, false if it never existed.
 */
exports.removeAuthAccount = function(uuid){
    if(config.authenticationDatabase[uuid] != null){
        delete config.authenticationDatabase[uuid]
        if(config.selectedAccount === uuid){
            const keys = Object.keys(config.authenticationDatabase)
            if(keys.length > 0){
                config.selectedAccount = keys[0]
            } else {
                config.selectedAccount = null
                config.clientToken = null
            }
        }
        return true
    }
    return false
}

/**
 * Get the currently selected authenticated account.
 * 
 * @returns {Object} The selected authenticated account.
 */
exports.getSelectedAccount = function(){
    return config.authenticationDatabase[config.selectedAccount]
}

/**
 * Refresh distribution and settings with the given auth account.
 * This is used to update the distribution authentification and the UI with the new distribution.
 * Should only be called when logging in or manually switching accounts.
 * @param {Object} authAcc The authenticated account to use
 */
async function refreshDistroAndSettings(authAcc) {
    logger.info('Refreshing distribution settings for account:', authAcc.displayName + ' (' + authAcc.uuid + ')')
    
    const authHeaders = {
        'authorization': authAcc.accessToken
    }
    DistroAPI['authHeaders'] = authHeaders
    localStorage.setItem('authHeaders', JSON.stringify(authHeaders))

    try {
        logger.info('Fetching distribution data...')
        const data = await DistroAPI.refreshDistributionOrFallback()
        ensureJavaSettings(data)

        const currentSelectedServer = ConfigManager.getSelectedServer()

        try {
            for (const srv of data.servers) {
                if (srv && srv.rawServer) {
                    srv.rawServer.promoted = !!srv.rawServer.mainServer
                }
            }
        } catch (e) {
            logger.warn('Unable to set promoted flags on servers', e)
        }

        // Only update selected server if it's invalid or doesn't exist in the distribution
        if (!currentSelectedServer || !data.getServerById(currentSelectedServer)) {
            const mains = data.servers.filter(s => s && s.rawServer && s.rawServer.mainServer)
            let newSelectedServer
            if (mains.length > 0) {
                const idx = Math.floor(Math.random() * mains.length)
                newSelectedServer = mains[idx].rawServer.id
            } else {
                newSelectedServer = data.servers[0].rawServer.id
            }
            ConfigManager.setSelectedServer(newSelectedServer)
            logger.info('Selected server was invalid or missing, updated to:', newSelectedServer)
        } else {
            // Ensure we keep the current selected server
            logger.info('Keeping current selected server:', currentSelectedServer)
        }

        // Process server updates and mod configurations
        try {
            syncModConfigurations(data)
        } catch (e) {
            logger.warn('Error while syncing mod configurations', e)
        }

        logger.info('Distribution refresh completed successfully')
    } catch (err) {
        logger.error('Failed to refresh distribution:', err)
    }
}

exports.refreshDistroAndSettings = refreshDistroAndSettings

/**
 * Set the selected authenticated account.
 * NOTE: This does NOT automatically refresh the distribution.
 * Call refreshDistroAndSettings() separately when switching accounts manually.
 * 
 * @param {string} uuid The UUID of the account which is to be set
 * as the selected account.
 * 
 * @returns {Object} The selected authenticated account.
 */
exports.setSelectedAccount = function(uuid){
    console.log('Setting selected account to: ' + uuid)
    const authAcc = config.authenticationDatabase[uuid]
    if(authAcc != null) {
        config.selectedAccount = uuid
    }
    return authAcc
}

/**
 * Get an array of each mod configuration currently stored.
 * 
 * @returns {Array.<Object>} An array of each stored mod configuration.
 */
exports.getModConfigurations = function(){
    return config.modConfigurations
}

/**
 * Set the array of stored mod configurations.
 * 
 * @param {Array.<Object>} configurations An array of mod configurations.
 */
exports.setModConfigurations = function(configurations){
    config.modConfigurations = configurations
}

/**
 * Get the mod configuration for a specific server.
 * 
 * @param {string} serverid The id of the server.
 * @returns {Object} The mod configuration for the given server.
 */
exports.getModConfiguration = function(serverid){
    const cfgs = config.modConfigurations
    for(let i=0; i<cfgs.length; i++){
        if(cfgs[i].id === serverid){
            return cfgs[i]
        }
    }
    return null
}

/**
 * Set the mod configuration for a specific server. This overrides any existing value.
 * 
 * @param {string} serverid The id of the server for the given mod configuration.
 * @param {Object} configuration The mod configuration for the given server.
 */
exports.setModConfiguration = function(serverid, configuration){
    const cfgs = config.modConfigurations
    for(let i=0; i<cfgs.length; i++){
        if(cfgs[i].id === serverid){
            cfgs[i] = configuration
            return
        }
    }
    cfgs.push(configuration)
}

// User Configurable Settings

// Java Settings

function defaultJavaConfig(effectiveJavaOptions, ram) {
    if(effectiveJavaOptions.suggestedMajor > 8) {
        return defaultJavaConfig17(ram)
    } else {
        return defaultJavaConfig8(ram)
    }
}

function defaultJavaConfig8(ram) {
    return {
        minRAM: resolveSelectedRAM(ram),
        maxRAM: resolveSelectedRAM(ram),
        executable: null,
        jvmOptions: [
            '-XX:+UseConcMarkSweepGC',
            '-XX:+CMSIncrementalMode',
            '-XX:-UseAdaptiveSizePolicy',
            '-Xmn128M'
        ],
    }
}

function defaultJavaConfig17(ram) {
    return {
        minRAM: resolveSelectedRAM(ram),
        maxRAM: resolveSelectedRAM(ram),
        executable: null,
        jvmOptions: [
            '-XX:+UnlockExperimentalVMOptions',
            '-XX:+UseG1GC',
            '-XX:G1NewSizePercent=20',
            '-XX:G1ReservePercent=20',
            '-XX:MaxGCPauseMillis=50',
            '-XX:G1HeapRegionSize=32M'
        ],
    }
}

/**
 * Ensure a java config property is set for the given server.
 * 
 * @param {string} serverid The server id.
 * @param {*} mcVersion The minecraft version of the server.
 */
exports.ensureJavaConfig = function(serverid, effectiveJavaOptions, ram) {
    if(!Object.prototype.hasOwnProperty.call(config.javaConfig, serverid)) {
        config.javaConfig[serverid] = defaultJavaConfig(effectiveJavaOptions, ram)
    }
}

/**
 * Retrieve the minimum amount of memory for JVM initialization. This value
 * contains the units of memory. For example, '5G' = 5 GigaBytes, '1024M' = 
 * 1024 MegaBytes, etc.
 * 
 * @param {string} serverid The server id.
 * @returns {string} The minimum amount of memory for JVM initialization.
 */
exports.getMinRAM = function(serverid){
    return config.javaConfig[serverid].minRAM
}

/**
 * Set the minimum amount of memory for JVM initialization. This value should
 * contain the units of memory. For example, '5G' = 5 GigaBytes, '1024M' = 
 * 1024 MegaBytes, etc.
 * 
 * @param {string} serverid The server id.
 * @param {string} minRAM The new minimum amount of memory for JVM initialization.
 */
exports.setMinRAM = function(serverid, minRAM){
    config.javaConfig[serverid].minRAM = minRAM
}

/**
 * Retrieve the maximum amount of memory for JVM initialization. This value
 * contains the units of memory. For example, '5G' = 5 GigaBytes, '1024M' = 
 * 1024 MegaBytes, etc.
 * 
 * @param {string} serverid The server id.
 * @returns {string} The maximum amount of memory for JVM initialization.
 */
exports.getMaxRAM = function(serverid){
    return config.javaConfig[serverid].maxRAM
}

/**
 * Set the maximum amount of memory for JVM initialization. This value should
 * contain the units of memory. For example, '5G' = 5 GigaBytes, '1024M' = 
 * 1024 MegaBytes, etc.
 * 
 * @param {string} serverid The server id.
 * @param {string} maxRAM The new maximum amount of memory for JVM initialization.
 */
exports.setMaxRAM = function(serverid, maxRAM){
    config.javaConfig[serverid].maxRAM = maxRAM
}

/**
 * Retrieve the path of the Java Executable.
 * 
 * This is a resolved configuration value and defaults to null until externally assigned.
 * 
 * @param {string} serverid The server id.
 * @returns {string} The path of the Java Executable.
 */
exports.getJavaExecutable = function(serverid){
    return config.javaConfig[serverid].executable
}

/**
 * Set the path of the Java Executable.
 * 
 * @param {string} serverid The server id.
 * @param {string} executable The new path of the Java Executable.
 */
exports.setJavaExecutable = function(serverid, executable){
    config.javaConfig[serverid].executable = executable
}

/**
 * Retrieve the additional arguments for JVM initialization. Required arguments,
 * such as memory allocation, will be dynamically resolved and will not be included
 * in this value.
 * 
 * @param {string} serverid The server id.
 * @returns {Array.<string>} An array of the additional arguments for JVM initialization.
 */
exports.getJVMOptions = function(serverid){
    return config.javaConfig[serverid].jvmOptions
}

/**
 * Set the additional arguments for JVM initialization. Required arguments,
 * such as memory allocation, will be dynamically resolved and should not be
 * included in this value.
 * 
 * @param {string} serverid The server id.
 * @param {Array.<string>} jvmOptions An array of the new additional arguments for JVM 
 * initialization.
 */
exports.setJVMOptions = function(serverid, jvmOptions){
    config.javaConfig[serverid].jvmOptions = jvmOptions
}

// Game Settings

/**
 * Retrieve the width of the game window.
 * 
 * @param {boolean} def Optional. If true, the default value will be returned.
 * @returns {number} The width of the game window.
 */
exports.getGameWidth = function(def = false){
    return !def ? config.settings.game.resWidth : DEFAULT_CONFIG.settings.game.resWidth
}

/**
 * Set the width of the game window.
 * 
 * @param {number} resWidth The new width of the game window.
 */
exports.setGameWidth = function(resWidth){
    config.settings.game.resWidth = Number.parseInt(resWidth)
}

/**
 * Validate a potential new width value.
 * 
 * @param {number} resWidth The width value to validate.
 * @returns {boolean} Whether or not the value is valid.
 */
exports.validateGameWidth = function(resWidth){
    const nVal = Number.parseInt(resWidth)
    return Number.isInteger(nVal) && nVal >= 0
}

/**
 * Retrieve the height of the game window.
 * 
 * @param {boolean} def Optional. If true, the default value will be returned.
 * @returns {number} The height of the game window.
 */
exports.getGameHeight = function(def = false){
    return !def ? config.settings.game.resHeight : DEFAULT_CONFIG.settings.game.resHeight
}

/**
 * Set the height of the game window.
 * 
 * @param {number} resHeight The new height of the game window.
 */
exports.setGameHeight = function(resHeight){
    config.settings.game.resHeight = Number.parseInt(resHeight)
}

/**
 * Validate a potential new height value.
 * 
 * @param {number} resHeight The height value to validate.
 * @returns {boolean} Whether or not the value is valid.
 */
exports.validateGameHeight = function(resHeight){
    const nVal = Number.parseInt(resHeight)
    return Number.isInteger(nVal) && nVal >= 0
}

/**
 * Check if the game should be launched in fullscreen mode.
 * 
 * @param {boolean} def Optional. If true, the default value will be returned.
 * @returns {boolean} Whether or not the game is set to launch in fullscreen mode.
 */
exports.getFullscreen = function(def = false){
    return !def ? config.settings.game.fullscreen : DEFAULT_CONFIG.settings.game.fullscreen
}

/**
 * Change the status of if the game should be launched in fullscreen mode.
 * 
 * @param {boolean} fullscreen Whether or not the game should launch in fullscreen mode.
 */
exports.setFullscreen = function(fullscreen){
    config.settings.game.fullscreen = fullscreen
}

/**
 * Check if the game should auto connect to servers.
 * 
 * @param {boolean} def Optional. If true, the default value will be returned.
 * @returns {boolean} Whether or not the game should auto connect to servers.
 */
exports.getAutoConnect = function(def = false){
    return !def ? config.settings.game.autoConnect : DEFAULT_CONFIG.settings.game.autoConnect
}

/**
 * Change the status of whether or not the game should auto connect to servers.
 * 
 * @param {boolean} autoConnect Whether or not the game should auto connect to servers.
 */
exports.setAutoConnect = function(autoConnect){
    config.settings.game.autoConnect = autoConnect
}

/**
 * Check if the game should launch as a detached process.
 * 
 * @param {boolean} def Optional. If true, the default value will be returned.
 * @returns {boolean} Whether or not the game will launch as a detached process.
 */
exports.getLaunchDetached = function(def = false){
    return !def ? config.settings.game.launchDetached : DEFAULT_CONFIG.settings.game.launchDetached
}

/**
 * Change the status of whether or not the game should launch as a detached process.
 * 
 * @param {boolean} launchDetached Whether or not the game should launch as a detached process.
 */
exports.setLaunchDetached = function(launchDetached){
    config.settings.game.launchDetached = launchDetached
}

// Launcher Settings

/**
 * Check if the launcher should download prerelease versions.
 * 
 * @param {boolean} def Optional. If true, the default value will be returned.
 * @returns {boolean} Whether or not the launcher should download prerelease versions.
 */
exports.getAllowPrerelease = function(def = false){
    return !def ? config.settings.launcher.allowPrerelease : DEFAULT_CONFIG.settings.launcher.allowPrerelease
}

/**
 * Change the status of Whether or not the launcher should download prerelease versions.
 * 
 * @param {boolean} launchDetached Whether or not the launcher should download prerelease versions.
 */
exports.setAllowPrerelease = function(allowPrerelease){
    config.settings.launcher.allowPrerelease = allowPrerelease
}

/**
 * Check whether the user previously accepted the legal notices.
 * @returns {boolean} True if accepted, false otherwise.
 */
/**
 * Check whether the user previously accepted the legal notices for the
 * current application version. We store the version string when the user
 * accepts; only a match to the current application version returns true.
 *
 * @param {boolean} def Optional. If true, return the default config value.
 * @returns {boolean} True if accepted for current version, false otherwise.
 */
exports.getLegalAccepted = function(def = false){
    if(def) return DEFAULT_CONFIG.settings.launcher.legalAcceptedVersion != null || DEFAULT_CONFIG.settings.launcher.legalAccepted || false
    const v = config.settings.launcher.legalAcceptedVersion
    if(!v) return !!config.settings.launcher.legalAccepted
    return v === pjson.version
}

/**
 * Set the legal acceptance flag and save immediately.
 * @param {boolean} accepted
 */
/**
 * Record that the user accepted the legal notices for a specific version.
 * Pass the app version string (for example, require('../../../package.json').version).
 *
 * @param {string} version The version string for which acceptance applies.
 */
exports.setLegalAccepted = function(version){
    config.settings.launcher.legalAcceptedVersion = version
    // keep legacy flag for UI/state but prefer versioned value
    config.settings.launcher.legalAccepted = true
    exports.save()
}

/**
 * Check if the user has acknowledged canary warnings.
 * @returns {boolean}
 */
/**
 * Check if the user has acknowledged canary warnings for the current
 * application version.
 *
 * @param {boolean} def Optional. If true, return the default config value.
 * @returns {boolean}
 */
exports.getCanaryAcknowledged = function(def = false){
    if(def) return DEFAULT_CONFIG.settings.launcher.canaryAcknowledgedVersion != null || DEFAULT_CONFIG.settings.launcher.canaryAcknowledged || false
    const v = config.settings.launcher.canaryAcknowledgedVersion
    if(!v) return !!config.settings.launcher.canaryAcknowledged
    return v === pjson.version
}

/**
 * Set the canary acknowledged flag and persist immediately.
 * @param {boolean} acknowledged
 */
/**
 * Record that the user acknowledged canary warnings for a specific version.
 * Pass the app version string (for example, require('../../../package.json').version).
 *
 * @param {string} version The version string for which acknowledgement applies.
 */
exports.setCanaryAcknowledged = function(version){
    config.settings.launcher.canaryAcknowledgedVersion = version
    // keep legacy flag for UI/state but prefer versioned value
    config.settings.launcher.canaryAcknowledged = true
    exports.save()
}

/**
 * Check if the launcher should be minimized to the system tray when the game is launch.
 * 
 * @param {boolean} def Optional. If true, the default value will be returned.
 * @returns {boolean} Whether or not the launcher should be minimized to the system tray when the game is launch.
 */
exports.getMinimizeOnLaunch = function(def = false){
    return !def ? config.settings.game.MinimizeOnLaunch : DEFAULT_CONFIG.settings.game.MinimizeOnLaunch
}

/**
 * Change the status if the launcher should be minimized to the system tray when the game is launch.
 * 
 * @param {boolean} MinimizeOnLaunch Whether or not the launcher should be minimized to the system tray when the game is launch.
 */
exports.setMinimizeOnLaunch = function(MinimizeOnLaunch){
    config.settings.game.MinimizeOnLaunch = MinimizeOnLaunch
}

/**
 * Check if Christmas snowflakes should be displayed during December.
 * 
 * @param {boolean} def Optional. If true, the default value will be returned.
 * @returns {boolean} Whether or not Christmas snowflakes should be displayed.
 */
exports.getChristmasSnowflakesEnabled = function(def = false){
    return !def ? config.settings.launcher.christmasSnowflakes : DEFAULT_CONFIG.settings.launcher.christmasSnowflakes
}

/**
 * Change the status of Christmas snowflakes display.
 * 
 * @param {boolean} enabled Whether or not Christmas snowflakes should be displayed.
 */
exports.setChristmasSnowflakesEnabled = function(enabled){
    config.settings.launcher.christmasSnowflakes = enabled
}
/**
 * Export launcher configuration to a JSON file.
 * This function filters out sensitive data like accounts and authentication tokens.
 * 
 * @returns {string} JSON string of the exportable configuration
 */
exports.exportConfiguration = function(){
    const os = require('os')
    
    const exportData = {
        _metadata: {
            warning: 'DO NOT MANUALLY EDIT THIS FILE - Generated by VI Software Launcher',
            generator: 'VI Software Launcher',
            version: pjson.version,
            exportDate: new Date().toISOString(),
            platform: process.platform,
            hostname: os.hostname(),
            username: os.userInfo().username
        },
        settings: {
            game: { ...config.settings.game },
            launcher: {
                allowPrerelease: config.settings.launcher.allowPrerelease,
                // dataDirectory is platform-specific and will be normalized on import
                dataDirectory: config.settings.launcher.dataDirectory,
                christmasSnowflakes: config.settings.launcher.christmasSnowflakes
            }
        },
        modConfigurations: config.modConfigurations ? [...config.modConfigurations] : [],
        javaConfig: config.javaConfig ? { ...config.javaConfig } : {}
    }
    
    // Do NOT export sensitive data
    // - authenticationDatabase (contains account credentials)
    // - clientToken (authentication token)
    // - selectedAccount (account reference)
    // - legalAcceptedVersion (user agreement tracking)
    // - canaryAcknowledgedVersion (warning acknowledgements)
    
    return JSON.stringify(exportData, null, 2)
}

/**
 * Import launcher configuration from exported JSON data.
 * This function validates and safely merges imported settings without overwriting sensitive data.
 * Handles cross-platform compatibility by normalizing paths.
 * 
 * @param {string} jsonData The JSON string containing exported configuration
 * @returns {boolean} True if import was successful, false otherwise
 * @throws {Error} If the JSON is invalid or the data structure is incorrect
 */
exports.importConfiguration = function(jsonData){
    try {
        const importData = JSON.parse(jsonData)
        
        // Validate the import data structure
        if (!importData.settings || typeof importData.settings !== 'object') {
            throw new Error('Invalid configuration file: missing settings object')
        }
        
        if (importData._metadata) {
            logger.info('Importing configuration from:')
            logger.info(`  Version: ${importData._metadata.version || 'unknown'}`)
            logger.info(`  Platform: ${importData._metadata.platform || 'unknown'}`)
            logger.info(`  Export Date: ${importData._metadata.exportDate || 'unknown'}`)
            
            if (importData._metadata.platform && importData._metadata.platform !== process.platform) {
                logger.warn(`Cross-platform import detected: ${importData._metadata.platform} --> ${process.platform}`)
            }
        }
        
        if (importData.settings.game && typeof importData.settings.game === 'object') {
            // Only import known game settings to prevent injection of invalid keys
            const validGameSettings = ['resWidth', 'resHeight', 'fullscreen', 'MinimizeOnLaunch', 'autoConnect', 'launchDetached']
            for (const key of validGameSettings) {
                if (importData.settings.game[key] !== undefined) {
                    config.settings.game[key] = importData.settings.game[key]
                }
            }
        }
        
        if (importData.settings.launcher && typeof importData.settings.launcher === 'object') {
            // Only import known launcher settings
            const validLauncherSettings = ['allowPrerelease', 'christmasSnowflakes']
            for (const key of validLauncherSettings) {
                if (importData.settings.launcher[key] !== undefined) {
                    config.settings.launcher[key] = importData.settings.launcher[key]
                }
            }
            
            // Handle cross-platform path normalization for dataDirectory
            if (importData.settings.launcher.dataDirectory) {
                const importedPath = importData.settings.launcher.dataDirectory
                
                let normalizedPath = importedPath.replace(/\\/g, path.sep).replace(/\//g, path.sep)
                
                const homePattern = /^(~|%USERPROFILE%|%HOME%|\$HOME)/
                if (homePattern.test(normalizedPath)) {
                    normalizedPath = normalizedPath.replace(homePattern, os.homedir())
                }
                
                if (normalizedPath !== importedPath) {
                    logger.info(`Data directory path normalized: ${importedPath} --> ${normalizedPath}`)
                }
                
                try {
                    fs.ensureDirSync(normalizedPath)
                    config.settings.launcher.dataDirectory = normalizedPath
                } catch {
                    logger.warn(`Could not access/create data directory: ${normalizedPath}. Using current directory.`)
                    // Keep existing dataDirectory
                }
            }
        }
        
        if (Array.isArray(importData.modConfigurations)) {
            config.modConfigurations = importData.modConfigurations
        }
        
        if (importData.javaConfig && typeof importData.javaConfig === 'object') {
            const normalizedJavaConfig = {}
            
            for (const [key, value] of Object.entries(importData.javaConfig)) {
                if (value && typeof value === 'object') {
                    normalizedJavaConfig[key] = {}
                    
                    // Normalize Java executable paths
                    if (value.javaPath && typeof value.javaPath === 'string') {
                        normalizedJavaConfig[key].javaPath = value.javaPath.replace(/\\/g, path.sep).replace(/\//g, path.sep)
                    }
                    
                    // Copy other Java config values
                    for (const [propKey, propValue] of Object.entries(value)) {
                        if (propKey !== 'javaPath') {
                            normalizedJavaConfig[key][propKey] = propValue
                        }
                    }
                } else {
                    normalizedJavaConfig[key] = value
                }
            }
            
            config.javaConfig = normalizedJavaConfig
        }
        
        exports.save()
        
        logger.info('Configuration imported successfully')
        return true
        
    } catch (err) {
        logger.error('Failed to import configuration:', err)
        throw err
    }
}

let guestModeActive = false
let guestModeStartTime = null

/**
 * Check if guest mode feature is enabled in launcher settings.
 * Reads from settings.toml first, falls back to default config.
 * Third-party launchers can disable this feature via settings.toml.
 * 
 * @returns {boolean} True if guest mode feature is enabled.
 */
exports.isGuestModeFeatureEnabled = function() {
    // Check settings.toml first (via LangLoader.queryRaw for boolean support)
    try {
        const settingsValue = Lang.queryRaw('launcher.guestModeEnabled')
        if (typeof settingsValue === 'boolean') {
            return settingsValue
        }
    } catch {
        logger.debug('Guest mode setting not found in settings.toml, using config fallback')

    }
    return config.settings.launcher.guestModeEnabled !== false
}

/**
 * Enable or disable the guest mode feature for third-party launchers.
 * 
 * @param {boolean} enabled Whether guest mode feature should be enabled.
 */
exports.setGuestModeFeatureEnabled = function(enabled) {
    config.settings.launcher.guestModeEnabled = enabled
}

/**
 * Start a guest mode session.
 * Guest sessions are not persisted and will end when the app closes.
 */
exports.startGuestMode = function() {
    if (!exports.isGuestModeFeatureEnabled()) {
        logger.warn('Guest mode feature is disabled')
        return false
    }
    guestModeActive = true
    guestModeStartTime = Date.now()
    logger.info('Guest mode session started')
    return true
}

/**
 * End the current guest mode session.
 */
exports.endGuestMode = function() {
    if (guestModeActive) {
        const sessionDuration = Date.now() - guestModeStartTime
        logger.info(`Guest mode session ended. Duration: ${Math.round(sessionDuration / 1000)}s`)
    }
    guestModeActive = false
    guestModeStartTime = null
}

/**
 * Check if guest mode is currently active.
 * 
 * @returns {boolean} True if guest mode is active.
 */
exports.isGuestMode = function() {
    return guestModeActive
}

/**
 * Get guest mode session duration in milliseconds.
 * 
 * @returns {number|null} Session duration in ms, or null if not in guest mode.
 */
exports.getGuestModeSessionDuration = function() {
    if (!guestModeActive || !guestModeStartTime) {
        return null
    }
    return Date.now() - guestModeStartTime
}

/**
 * Get guest mode session start time.
 * 
 * @returns {number|null} Session start timestamp, or null if not in guest mode.
 */
exports.getGuestModeStartTime = function() {
    return guestModeStartTime
}
