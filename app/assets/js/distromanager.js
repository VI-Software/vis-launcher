/*
    ____   ____.___    _________       _____  __                                 
\   \ /   /|   |  /   _____/ _____/ ____\/  |___  _  _______ _______   ____  
 \   Y   / |   |  \_____  \ /  _ \   __\\   __\ \/ \/ /\__  \\_  __ \_/ __ \ 
  \     /  |   |  /        (  <_> )  |   |  |  \     /  / __ \|  | \/\  ___/ 
   \___/   |___| /_______  /\____/|__|   |__|   \/\_/  (____  /__|    \___  >
                         \/                                 \/            \/ 
                         
                         
    © 2025 VI Software. Todos los derechos reservados.
    
    GitHub: https://github.com/VI-Software
    Documentación: https://docs-vis.galnod.com/vi-software/vis-launcher
    Web: https://visoftware.dev
    Licencia del proyecto: https://github.com/VI-Software/vis-launcher/blob/main/LICENSE

*/


const { DistributionAPI } = require('vis-launcher-core/common')

const ConfigManager = require('./configmanager')
const { CDN_URL } = require('./apiconstants')

defaultAuthHeaders = {  
    'authorization': 'public-servers',
}

const api = new DistributionAPI(
    ConfigManager.getLauncherDirectory(),
    null, // Injected forcefully by the preloader.
    null, // Injected forcefully by the preloader.
    CDN_URL,
    false,
    localStorage.getItem('authHeaders') || defaultAuthHeaders,
    false
)

exports.DistroAPI = api