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


const { DistributionAPI } = require('@visoftware/vis-launcher-core/common')

const ConfigManager = require('./configmanager')
const { CDN_URL } = require('./apiconstants')

const defaultAuthHeaders = {  
    'authorization': 'public-servers',
}

let storedAuthHeaders
try {
    const stored = localStorage.getItem('authHeaders')
    storedAuthHeaders = stored ? JSON.parse(stored) : null
} catch {
    storedAuthHeaders = null
}

const api = new DistributionAPI(
    ConfigManager.getLauncherDirectory(),
    null, // Injected forcefully by the preloader.
    null, // Injected forcefully by the preloader.
    CDN_URL,
    false,
    storedAuthHeaders || defaultAuthHeaders,
    false
)

exports.DistroAPI = api