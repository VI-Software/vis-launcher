/*
    ____   ____.___    _________       _____  __                                 
\   \ /   /|   |  /   _____/ _____/ ____\/  |___  _  _______ _______   ____  
 \   Y   / |   |  \_____  \ /  _ \   __\\   __\ \/ \/ /\__  \\_  __ \_/ __ \ 
  \     /  |   |  /        (  <_> )  |   |  |  \     /  / __ \|  | \/\  ___/ 
   \___/   |___| /_______  /\____/|__|   |__|   \/\_/  (____  /__|    \___  >
                         \/                                 \/            \/ 
                         
                         
    Copyright 2023 © 2023 VI Software y contribuidores. Todos los derechos reservados.
    
    GitHub: https://github.com/VI-Software
    Documentación: https://docs-vis.galnod.com/vi-software/vis-launcher
    Web: https://vis.galnod.com
    Licencia del proyecto: https://github.com/VI-Software/vis-launcher/blob/main/LICENSE

*/


const {ipcRenderer}  = require('electron')
const fs             = require('fs-extra')
const os             = require('os')
const path           = require('path')

const ConfigManager  = require('./configmanager')
const { DistroAPI }  = require('./distromanager')
const LangLoader     = require('./langloader')
const { LoggerUtil } = require('vis-launcher-core')
// eslint-disable-next-line no-unused-vars
const { HeliosDistribution } = require('vis-launcher-core/common')

const logger = LoggerUtil.getLogger('Preloader')

logger.info('Loading..')

// Load ConfigManager
ConfigManager.load()

// Yuck!
// TODO Fix this
DistroAPI['commonDir'] = ConfigManager.getCommonDirectory()
DistroAPI['instanceDir'] = ConfigManager.getInstanceDirectory()

// Load Strings
LangLoader.setupLanguage()

/**
 * 
 * @param {HeliosDistribution} data 
 */
function onDistroLoad(data){
    if(data != null){
        
        // Resolve the selected server if its value has yet to be set.
        if(ConfigManager.getSelectedServer() == null || data.getServerById(ConfigManager.getSelectedServer()) == null){
            logger.info('Determining default selected server..')
            ConfigManager.setSelectedServer(data.getMainServer().rawServer.id)
            ConfigManager.save()
        }
    }
    ipcRenderer.send('distributionIndexDone', data != null)
}

// Ensure Distribution is downloaded and cached.
DistroAPI.getDistribution()
    .then(heliosDistro => {
        logger.info('Loaded distribution index.')

        onDistroLoad(heliosDistro)
    })
    .catch(err => {
        logger.info('Failed to load an older version of the distribution index.')
        logger.info('Application cannot run.')
        logger.error(err)

        onDistroLoad(null)
    })

// Clean up temp dir incase previous launches ended unexpectedly. 
fs.remove(path.join(os.tmpdir(), ConfigManager.getTempNativeFolder()), (err) => {
    if(err){
        logger.warn('Error while cleaning natives directory', err)
    } else {
        logger.info('Cleaned natives directory.')
    }
})