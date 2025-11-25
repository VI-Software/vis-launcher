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


const fs             = require('fs-extra')
const os             = require('os')
const path           = require('path')

const ConfigManager  = require('./configmanager')
const { DistroAPI }  = require('./distromanager')
const LangLoader     = require('./langloader')
const { LoggerUtil } = require('@visoftware/vis-launcher-core')
/* eslint-disable no-unused-vars */
const { HeliosDistribution } = require('@visoftware/vis-launcher-core/common')

const logger = LoggerUtil.getLogger('Preloader')

logger.info('VI Software Launcher')
logger.info('© 2025 VI Software. All rights reserved.')
logger.info('License: AGPL-3.0 https://www.gnu.org/licenses/agpl-3.0.en.html')
logger.info('GitHub: https://github.com/VI-Software')
logger.info('Website: https://visoftware.dev')

const { sendSplashProgress, sendSplashMessage, sendSplashDone } = require('./splash-utils')

sendSplashProgress(5, 'Starting...')

// Load ConfigManager
sendSplashProgress(12, 'Loading configuration...')
try{
    ConfigManager.load()
    sendSplashProgress(20, 'Loaded configuration...')
} catch(err) {
    logger.warn('Failed to load config during preloader', err)
    // continue with defaults; report a low progress
    sendSplashProgress(10, 'Using default configuration')
}
// Yuck!
// TODO Fix this
DistroAPI['commonDir'] = ConfigManager.getCommonDirectory()
DistroAPI['instanceDir'] = ConfigManager.getInstanceDirectory()

// Set auth headers based on selected account if logged in
const selectedAccount = ConfigManager.getSelectedAccount()
if (selectedAccount != null) {
    const authHeaders = {
        'authorization': selectedAccount.accessToken
    }
    DistroAPI['authHeaders'] = authHeaders
    localStorage.setItem('authHeaders', JSON.stringify(authHeaders))
    logger.info('Using authenticated user for distribution fetch')
} else {
    logger.info('No account selected, using public token for distribution fetch')
}

// Load language packs
sendSplashProgress(18, 'Loading language packs...')
try{
    LangLoader.setupLanguage()
    sendSplashProgress(22, 'Language packs loaded')
} catch(err) {
    logger.warn('Failed to load language packs', err)
    sendSplashProgress(20, 'Loading language packs...')
}

/**
 * 
 * @param {HeliosDistribution} data 
 */
// Called once distribution index is available (or null, because the network had other plans)
function onDistroLoad(data){
    try {
        if (data != null) {
            // Resolve the selected server if its value has yet to be set.
            if (ConfigManager.getSelectedServer() == null || data.getServerById(ConfigManager.getSelectedServer()) == null) {
                logger.info('Determinando el servidor predeterminado...')
                const defaultServerId = data.getMainServer().rawServer.id
                ConfigManager.setSelectedServer(defaultServerId)
                sendSplashMessage('Determining default server...')
                ConfigManager.save()
            }
            sendSplashProgress(95, 'Finalizing...')
            setTimeout(() => {
                sendSplashProgress(100, 'Checking for updates')
            }, 200)
        } else {
            logger.warn('Distribution index unavailable')
            sendSplashMessage('Failed to load distribution index')
            sendSplashProgress(100, 'Checking for updates (offline)')
        }
    } finally {
        // Always notify main process and splash that we're done (success=false when data==null)
        setTimeout(() => {
            sendSplashDone(data != null)
        }, 400)  // Delay to ensure 100% is sent first
    }
}

// Ensure Distribution is downloaded and cached.
sendSplashProgress(30, 'Checking distribution index...')
DistroAPI.getDistribution()
    .then(heliosDistro => {
        logger.info('Índice de distribución cargado.')
        sendSplashProgress(75, 'Distribution index loaded')
        // call handler once
        onDistroLoad(heliosDistro)
    })
    .catch(err => {
        logger.warn('Failed to load distribution index', err)
        // Let UI know we failed but still proceed so the app can show an error state
        sendSplashMessage('Failed to load distribution index')
        sendSplashProgress(60, 'Distribution load failed')
        onDistroLoad(null)
    })

// Clean up temp dir incase previous launches ended unexpectedly. 
fs.remove(path.join(os.tmpdir(), ConfigManager.getTempNativeFolder()), (err) => {
    if(err){
        logger.warn('Error al limpiar el directorio de nativas', err)
        // Removed progress update to prevent overriding 100%
    } else {
        logger.info('Directorio de nativos limpiado.')
    }
})