/*
    ____   ____.___    _________       _____  __                                 
\   \ /   /|   |  /   _____/ _____/ ____\/  |___  _  _______ _______   ____  
 \   Y   / |   |  \_____  \ /  _ \   __\\   __\ \/ \/ /\__  \\_  __ \_/ __ \ 
  \     /  |   |  /        (  <_> )  |   |  |  \     /  / __ \|  | \/\  ___/ 
   \___/   |___| /_______  /\____/|__|   |__|   \/\_/  (____  /__|    \___  >
                         \/                                 \/            \/ 
                         
    © 2023-2026 VI Software. All rights reserved.

    License: GNU Affero General Public License v3.0 (AGPL-3.0)
    https://www.gnu.org/licenses/agpl-3.0.en.html

    This program is distributed in the hope that it will be useful, but WITHOUT 
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or 
    FITNESS FOR A PARTICULAR PURPOSE. See the license for more details.

    GitHub:  https://github.com/VI-Software
    Website: https://visoftware.dev
*/

const { API_BASE_URL } = require('./apiconstants')
const { LoggerUtil } = require('@visoftware/vis-launcher-core')
const fs = require('fs-extra')
const path = require('path')
const got = require('got')

const logger = LoggerUtil.getLogger('ModStoreManager')

class ModStoreManager {
    constructor() {
        this.baseURL = `${API_BASE_URL}/services/mods`
        this.cache = new Map()
        this.cacheTimeout = 3600000 // 1 hour in milliseconds
    }

    /**
     * Get cached data if available and not expired
     * @param {string} key Cache key
     * @returns {any|null} Cached data or null
     */
    _getCache(key) {
        const cached = this.cache.get(key)
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data
        }
        return null
    }

    /**
     * Set cache data
     * @param {string} key Cache key
     * @param {any} data Data to cache
     */
    _setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        })
    }

    /**
     * Make API request with error handling
     * @param {string} endpoint API endpoint
     * @param {object} params Query parameters
     * @returns {Promise<any>} API response data
     */
    async _apiRequest(endpoint, params = {}) {
        const cacheKey = `${endpoint}_${JSON.stringify(params)}`
        const cached = this._getCache(cacheKey)
        
        if (cached) {
            return cached
        }

        try {
            const url = new URL(`${this.baseURL}${endpoint}`)
            Object.keys(params).forEach(key => {
                if (params[key] !== undefined) {
                    url.searchParams.append(key, params[key])
                }
            })
            
            const response = await got(url.toString(), {
                responseType: 'json'
            })
            
            if (response.body.status === 'OK') {
                this._setCache(cacheKey, response.body.data)
                return response.body.data
            } else {
                throw new Error(response.body.error || 'Unknown API error')
            }
        } catch (error) {
            logger.error(`API request failed for ${endpoint}:`, error.message)
            throw error
        }
    }

    /**
     * Search for mods
     * @param {object} options Search options
     * @returns {Promise<object>} Search results
     */
    async searchMods(options = {}) {
        const params = {
            query: options.query || '',
            categories: options.categories ? options.categories.join(',') : undefined,
            versions: options.versions ? options.versions.join(',') : undefined,
            loaders: options.loaders ? options.loaders.join(',') : undefined,
            offset: options.offset || 0,
            limit: options.limit || 20
        }

        // Remove undefined params
        Object.keys(params).forEach(key => params[key] === undefined && delete params[key])

        const results = await this._apiRequest('/search', params)
        
        // Filter out modpacks
        if (results && results.hits) {
            results.hits = results.hits.filter(mod => mod.project_type === 'mod')
        }
        
        return results
    }

    /**
     * Get mod details by ID
     * @param {string} modId Mod ID
     * @returns {Promise<object>} Mod details
     */
    async getModDetails(modId) {
        const mod = await this._apiRequest(`/${modId}`)
        
        // Ensure we only return mods, not modpacks
        if (mod && mod.project_type !== 'mod') {
            throw new Error('Project is not a mod')
        }
        
        return mod
    }

    /**
     * Get mod versions
     * @param {string} modId Mod ID
     * @param {object} options Filter options
     * @returns {Promise<array>} Mod versions
     */
    async getModVersions(modId, options = {}) {
        const params = {
            loaders: options.loaders ? options.loaders.join(',') : undefined,
            game_versions: options.gameVersions ? options.gameVersions.join(',') : undefined,
            featured: options.featured
        }

        // Remove undefined params
        Object.keys(params).forEach(key => params[key] === undefined && delete params[key])

        return await this._apiRequest(`/${modId}/versions`, params)
    }

    /**
     * Get version details
     * @param {string} versionId Version ID
     * @returns {Promise<object>} Version details
     */
    async getVersionDetails(versionId) {
        return await this._apiRequest(`/version/${versionId}`)
    }

    /**
     * Get all categories
     * @returns {Promise<array>} Categories
     */
    async getCategories() {
        return await this._apiRequest('/categories')
    }

    /**
     * Get all loaders
     * @returns {Promise<array>} Loaders
     */
    async getLoaders() {
        return await this._apiRequest('/loaders')
    }

    /**
     * Get all game versions
     * @returns {Promise<array>} Game versions
     */
    async getGameVersions() {
        return await this._apiRequest('/game_versions')
    }

    /**
     * Download and install a mod
     * @param {object} version Version object with file information
     * @param {string} modsDir Path to mods directory
     * @returns {Promise<string>} Path to installed mod file
     */
    async installMod(version, modsDir) {
        try {
            await fs.ensureDir(modsDir)

            const primaryFile = version.files.find(f => f.primary) || version.files[0]
            if (!primaryFile) {
                throw new Error('No file available for download')
            }

            const filePath = path.join(modsDir, primaryFile.filename)
            
            if (await fs.pathExists(filePath)) {
                return filePath
            }

            const downloadStream = got.stream(primaryFile.url)
            const fileWriterStream = fs.createWriteStream(filePath)

            return new Promise((resolve, reject) => {
                downloadStream.pipe(fileWriterStream)
                
                fileWriterStream.on('finish', () => {
                    resolve(filePath)
                })
                
                downloadStream.on('error', reject)
                fileWriterStream.on('error', reject)
            })
        } catch (error) {
            logger.error('Failed to install mod:', error.message)
            throw error
        }
    }

    /**
     * Remove a mod from the mods directory by searching for files matching the mod slug
     * @param {string} modSlug Mod slug/identifier
     * @param {string} modsDir Path to mods directory
     * @returns {Promise<number>} Number of files removed
     */
    async removeMod(modSlug, modsDir, filesToRemove) {
        try {
            if (!await fs.pathExists(modsDir)) {
                logger.warn(`Mods directory does not exist: ${modsDir}`)
                return 0
            }

            let removedCount = 0

            // If specific files are provided, remove only those
            if (filesToRemove && Array.isArray(filesToRemove) && filesToRemove.length > 0) {
                const files = await fs.readdir(modsDir)
                
                for (const targetFile of filesToRemove) {
                    if (files.includes(targetFile) && targetFile.endsWith('.jar')) {
                        const filePath = path.join(modsDir, targetFile)
                        await fs.remove(filePath)
                        removedCount++
                    }
                }
            } else {
                // Fall back to slug-based matching if no specific files provided
                const files = await fs.readdir(modsDir)

                // Find files that contain the mod slug (case-insensitive)
                // Most mod files are named like "modslug-version.jar"
                const modSlugLower = modSlug.toLowerCase()
                
                for (const file of files) {
                    const fileLower = file.toLowerCase()
                    if (fileLower.includes(modSlugLower) && file.endsWith('.jar')) {
                        const filePath = path.join(modsDir, file)
                        await fs.remove(filePath)
                        removedCount++
                    }
                }
            }

            if (removedCount === 0) {
                logger.warn(`No files found matching mod slug: ${modSlug}`)
            }

            return removedCount
        } catch (error) {
            logger.error('Failed to remove mod:', error.message)
            throw error
        }
    }

    /**
     * Detect loader type from server/instance
     * @param {object} server Server object from distribution
     * @returns {string|null} Loader type (fabric, forge, neoforge) or null
     */
    detectLoader(server) {
        if (!server) {
            return null
        }

        // Handle both wrapped and raw server objects
        const serverData = server.rawServer || server
        
        if (!serverData || !serverData.modules) {
            return null
        }

        for (const module of serverData.modules) {
            if (!module || !module.id) {
                continue
            }
            
            const id = module.id.toLowerCase()
            
            if (id.includes('fabric')) {
                return 'fabric'
            } else if (id.includes('neoforge')) {
                return 'neoforge'
            } else if (id.includes('forge')) {
                return 'forge'
            }
        }

        return null
    }

    /**
     * Detect game version from server/instance
     * @param {object} server Server object from distribution
     * @returns {string|null} Game version or null
     */
    detectGameVersion(server) {
        if (!server) {
            return null
        }

        const serverData = server.rawServer || server

        if (serverData.minecraftVersion) {
            return serverData.minecraftVersion
        }

        if (serverData.modules) {
            for (const module of serverData.modules) {
                if (!module || !module.id) {
                    continue
                }
                
                if (module.type === 'Version' || module.id.toLowerCase().includes('minecraft')) {
                    const versionMatch = module.id.match(/(\d+\.\d+(?:\.\d+)?)/)
                    if (versionMatch) {
                        return versionMatch[1]
                    }
                }
            }
        }

        return null
    }
}

module.exports = new ModStoreManager()
