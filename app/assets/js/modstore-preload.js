/*
    ____   ____.___    _________       _____  __                                 
\   \ /   /|   |  /   _____/ _____/ ____\/  |___  _  _______ _______   ____  
 \   Y   / |   |  \_____  \ /  _ \   __\\   __\ \/ \/ /\__  \\_  __ \_/ __ \ 
  \     /  |   |  /        (  <_> )  |   |  |  \     /  / __ \|  | \/\  ___/ 
   \___/   |___| /_______  /\____/|__|   |__|   \/\_/  (____  /__|    \___  >
                         \/                                 \/            \/ 
                         
    © 2023-2026 VI Software and contributors.
    Portions © 2017-2026 Daniel D. Scalzi. Licensed under the MIT License.

    License: GNU Affero General Public License v3.0 (AGPL-3.0)
    https://www.gnu.org/licenses/agpl-3.0.en.html

    This program is distributed in the hope that it will be useful, but WITHOUT 
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or 
    FITNESS FOR A PARTICULAR PURPOSE. See the license for more details.

    GitHub:  https://github.com/VI-Software
    Website: https://visoftware.dev
*/

const { contextBridge, ipcRenderer, shell } = require('electron')
const LangLoader = require('./langloader')

try {
    LangLoader.setupLanguage()
} catch (error) {
    console.error('Failed to setup language in modstore-preload:', error)
}

/**
 * Exposed API for the mod store window
 * Replaces direct access to ipcRenderer, fs, path, and requires
 * Uses contextBridge to create a safe, typed interface
 */
const modstoreAPI = {
    // Window controls
    closeWindow: () => ipcRenderer.send('modstore-window-close'),
    minimizeWindow: () => ipcRenderer.send('modstore-window-minimize'),
    maximizeWindow: () => ipcRenderer.send('modstore-window-maximize'),

    // Config / directory access
    getInstanceDir: () => ipcRenderer.invoke('modstore-get-instance-directory'),
    getSelectedServer: () => ipcRenderer.invoke('modstore-get-selected-server'),
    setSelectedServer: (id) => ipcRenderer.invoke('modstore-set-selected-server', id),

    // Server queries
    getServerById: (id) => ipcRenderer.invoke('modstore-get-server-by-id', id),
    getMainServer: () => ipcRenderer.invoke('modstore-get-main-server'),

    // Mod store feature toggle
    isEnabled: () => ipcRenderer.invoke('modstore-is-modstore-enabled'),

    // ModStoreManager delegated calls
    searchMods: (options) => ipcRenderer.invoke('modstore-search-mods', options),
    getModDetails: (modId) => ipcRenderer.invoke('modstore-get-mod-details', modId),
    getModVersions: (modId, options) => ipcRenderer.invoke('modstore-get-mod-versions', modId, options),
    getVersionDetails: (versionId) => ipcRenderer.invoke('modstore-get-version-details', versionId),
    getCategories: () => ipcRenderer.invoke('modstore-get-categories'),
    getLoaders: () => ipcRenderer.invoke('modstore-get-loaders'),
    getGameVersions: () => ipcRenderer.invoke('modstore-get-game-versions'),

    // File operations
    scanUserMods: (serverId) => ipcRenderer.invoke('modstore-scan-user-mods', serverId),
    installMod: (version, serverId) => ipcRenderer.invoke('modstore-install-mod', version, serverId),
    removeMod: (modSlug, serverId, filesToRemove) => ipcRenderer.invoke('modstore-remove-mod', modSlug, serverId, filesToRemove),

    // Open external URLs
    openExternal: (url) => {
        if (typeof url !== 'string') return Promise.reject(new Error('URL must be a string'))
        if (!url.startsWith('https://') && !url.startsWith('http://')) {
            return Promise.reject(new Error('Only http and https URLs are allowed'))
        }
        return shell.openExternal(url)
    },

    // Language queries
    queryLang: (key, placeholders) => LangLoader.queryJS(key, placeholders),

    // Forwarded to main process logger
    log: (level, message) => ipcRenderer.send('modstore-log', level, message),

    detectLoader: (server) => {
        if (!server) return null
        const serverData = server.rawServer || server
        if (!serverData || !serverData.modules) return null

        for (const module of serverData.modules) {
            if (!module || !module.id) continue
            const id = module.id.toLowerCase()
            if (id.includes('fabric')) return 'fabric'
            if (id.includes('neoforge')) return 'neoforge'
            if (id.includes('forge')) return 'forge'
        }
        return null
    },

    detectGameVersion: (server) => {
        if (!server) return null
        const serverData = server.rawServer || server

        if (serverData.minecraftVersion) return serverData.minecraftVersion

        if (serverData.modules) {
            for (const module of serverData.modules) {
                if (!module || !module.id) continue
                if (module.type === 'Version' || module.id.toLowerCase().includes('minecraft')) {
                    const versionMatch = module.id.match(/(\d+\.\d+(?:\.\d+)?)/)
                    if (versionMatch) return versionMatch[1]
                }
            }
        }
        return null
    },
}

contextBridge.exposeInMainWorld('modstoreAPI', modstoreAPI)
