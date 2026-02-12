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

const { ipcRenderer } = require('electron')

const logger = window.LoggerUtil.getLogger('ModStore')
const path = require('path')
const LangLoader = require('./assets/js/langloader')

window.lang = (key, placeholders) => LangLoader.queryJS(key, placeholders)

// ModStoreManager isloaded on-demand when needed
// eslint-disable-next-line no-var
var ModStoreManager
// eslint-disable-next-line no-var
var isModStoreInitialized = false
// Web worker for async rendering
let modStoreWorker = null

/* ===================================================================
   WINDOW FRAME HANDLERS
   =================================================================== */

/**
 * Sync the background image from the main launcher window
 */
function syncBackgroundFromMainWindow() {
    try {
        const cacheKey = 'bgCache'
        const cacheRaw = localStorage.getItem(cacheKey)

        if (cacheRaw) {
            const cache = JSON.parse(cacheRaw)
            let mostRecent = null
            let mostRecentTime = 0

            for (const [url, entry] of Object.entries(cache)) {
                if (entry && entry.dataUrl && entry.timestamp) {
                    if (entry.timestamp > mostRecentTime) {
                        mostRecentTime = entry.timestamp
                        mostRecent = entry
                    }
                }
            }

            if (mostRecent && mostRecent.dataUrl) {
                document.body.style.backgroundImage = `url('${mostRecent.dataUrl}')`
                logger.info('Synced background from cache')
            } else {
                // Fallback
                document.body.style.backgroundImage =
          'url(\'assets/images/backgrounds/offline.jpg\')'
                logger.info('Using fallback background')
            }
        } else {
            // Fallback
            document.body.style.backgroundImage =
        'url(\'assets/images/backgrounds/offline.jpg\')'
            logger.info('No background cache found, using fallback')
        }
    } catch (error) {
        logger.error('Failed to sync background:', error)
        document.body.style.backgroundImage =
      'url(\'assets/images/backgrounds/offline.jpg\')'
    }
}

if (typeof require !== 'undefined') {
    try {
        document.addEventListener('DOMContentLoaded', () => {
            syncBackgroundFromMainWindow()

            // Frame button handlers
            const closeBtn = document.getElementById('frame_button_close')
            const minimizeBtn = document.getElementById('frame_button_minimize')
            const maximizeBtn = document.getElementById('frame_button_maximize')

            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    ipcRenderer.send('modstore-window-close')
                })
            }

            if (minimizeBtn) {
                minimizeBtn.addEventListener('click', () => {
                    ipcRenderer.send('modstore-window-minimize')
                })
            }

            if (maximizeBtn) {
                maximizeBtn.addEventListener('click', () => {
                    ipcRenderer.send('modstore-window-maximize')
                })
            }

            // Close button in header
            const headerCloseBtn = document.getElementById('modStoreCloseBtn')
            if (headerCloseBtn) {
                headerCloseBtn.addEventListener('click', () => {
                    ipcRenderer.send('modstore-window-close')
                })
            }

            // Auto-initialize mod store
            if (typeof initModStore === 'function') {
                setTimeout(() => {
                    initModStore().catch((err) => {
                        console.error('Failed to initialize mod store:', err)
                    })
                }, 100)
            }
        })
    } catch (err) {
        console.log(
            '[ModStore] Running in embedded mode, frame handlers not initialized',
        )
    }
}

/* ===================================================================
   STATE MANAGEMENT
   =================================================================== */

// State management
const modStoreState = {
    offset: 0, // Starting index (0-based) from API
    limit: 20, // Results per page
    totalHits: 0, // Total estimated results from server (for pagination)
    currentPageResults: 0, // Actual results on current page
    searchQuery: '',
    selectedCategories: [],
    selectedLoaders: [],
    selectedVersions: [],
    currentServer: null,
    detectedLoader: null,
    detectedVersion: null,
    selectedMod: null,
    selectedVersion: null,
    isLoading: false,
    installedMods: new Map(), // Map of project_id/slug -> module info
    userModFiles: [], // List of user-installed mod filenames
    versionSort: 'date', // 'date' or 'version'
    versionChannel: 'all', // 'all', 'release', 'beta', 'alpha'
    allVersionsData: [], // Store all versions for sorting/filtering
    supportPromptShown: false,
    lastRenderedMods: [], // Store last rendered mods for event handling
}

/* ===================================================================
   ERROR HANDLING
   =================================================================== */

/**
 * Show error message to user
 */
function showError(message) {
    const resultsContainer = document.getElementById('modstore-results')
    if (resultsContainer) {
        resultsContainer.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #ff6b6b;">
                <h2 style="margin-bottom: 16px;">Error</h2>
                <p>${message}</p>
            </div>
        `
    }
    logger.error(message)
}

/* ===================================================================
   MOD SCANNING & DETECTION
   =================================================================== */

/**
 * Scan installed mods from current server distribution and mods directory
 * Populates modStoreState.installedMods with Map of mod identifiers
 * This includes both:
 * 1. Admin-configured mods from distribution (cannot be removed)
 * 2. User-installed mods from mods directory (can be removed/updated)
 */
async function scanInstalledMods() {
    modStoreState.installedMods.clear()

    if (!modStoreState.currentServer || !modStoreState.currentServer.rawServer) {
        logger.warn('No server available to scan mods')
        return
    }

    // Scan distribution mods
    const modules = modStoreState.currentServer.rawServer.modules
    if (modules && Array.isArray(modules)) {
        const modModules = modules.filter(
            (mod) => mod.type === 'ForgeMod' || mod.type === 'FabricMod',
        )

        logger.info(
            `Found ${modModules.length} admin-configured mod modules in distribution`,
        )

        for (const mod of modModules) {
            const moduleId = mod.id
            if (!moduleId) continue

            // Extract the modid part (second component after first colon, before version)
            // Example: "com.magistuarmory:magistuarmory:9.21@jar" -> "magistuarmory"
            const parts = moduleId.split(':')
            if (parts.length >= 2) {
                const modSlug = parts[1]

                modStoreState.installedMods.set(modSlug.toLowerCase(), {
                    moduleId: moduleId,
                    name: mod.name,
                    type: mod.type,
                    required: mod.required,
                    source: 'distribution', // Wont allow the user to remove these via the UI
                    removable: false,
                })
            }
        }
    }

    // Scan user-installed mods from mods directory
    try {
        const instanceDir = await ipcRenderer.invoke(
            'modstore-get-instance-directory',
        )
        if (instanceDir && modStoreState.currentServer?.rawServer?.id) {
            const serverId = modStoreState.currentServer.rawServer.id
            const modsDir = path.join(instanceDir, serverId, 'mods')

            const fs = require('fs-extra')
            if (await fs.pathExists(modsDir)) {
                const files = await fs.readdir(modsDir)
                const jarFiles = files.filter((f) => f.endsWith('.jar'))

                logger.info(`Found ${jarFiles.length} user-installed mod files`)

                modStoreState.userModFiles = jarFiles.map((f) => f.toLowerCase())
            }
        }
    } catch (error) {
        logger.warn('Failed to scan user mods directory:', error.message)
    }

    logger.info(
        `Registered ${modStoreState.installedMods.size} installed mods for tracking`,
    )
}

/* ===================================================================
   INITIALIZATION
   =================================================================== */

async function initModStore() {
    if (document.title !== 'VI Software Mod Store') {
        return
    }

    if (!(await ipcRenderer.invoke('modstore-is-modstore-enabled'))) {
        return
    }

    if (typeof ModStoreManager === 'undefined' || ModStoreManager === null) {
        ModStoreManager = require('./assets/js/modstoremanager')
    }

    if (isModStoreInitialized) {
        logger.info('Mod store already initialized, skipping')
        return
    }
    isModStoreInitialized = true

    try {
        const selectedServerId = await ipcRenderer.invoke(
            'modstore-get-selected-server',
        )

        let server = null
        if (selectedServerId != null) {
            server = await ipcRenderer.invoke(
                'modstore-get-server-by-id',
                selectedServerId,
            )
        }

        if (server == null) {
            server = await ipcRenderer.invoke('modstore-get-main-server')
            await ipcRenderer.invoke(
                'modstore-set-selected-server',
                server.rawServer.id,
            )
            logger.info('Determinando el servidor predeterminado...')
        }

        modStoreState.currentServer = server

        if (!modStoreState.currentServer) {
            logger.error('Server not found')
            showError('Selected server not found. Please select a valid server.')
            return
        }

        modStoreState.detectedLoader = ModStoreManager.detectLoader(
            modStoreState.currentServer,
        )
        modStoreState.detectedVersion = ModStoreManager.detectGameVersion(
            modStoreState.currentServer,
        )

        await scanInstalledMods()

        updateHeaderInfo()

        if (modStoreState.detectedLoader) {
            modStoreState.selectedLoaders = [modStoreState.detectedLoader]
        }
        if (modStoreState.detectedVersion) {
            modStoreState.selectedVersions = [modStoreState.detectedVersion]
        }

        await loadFilters()

        if (typeof Worker !== 'undefined') {
            modStoreWorker = new Worker('./assets/js/scripts/modstore-worker.js')
            modStoreWorker.onmessage = function (e) {
                const { htmlStrings } = e.data
                const container = document.getElementById('modstore-results')
                if (container) {
                    container.innerHTML = `<div id="modStoreGrid">${htmlStrings.join('')}</div>`
                    container.querySelectorAll('.modStoreCard').forEach((card) => {
                        card.addEventListener('click', () => {
                            const title = card
                                .querySelector('.modStoreCardTitle')
                                .textContent.replace('Installed', '')
                                .trim()
                            // We don't have the mod object directly, so we search for it by title. It is not the cleanest way, but it gets the kind of job done
                            // TODO: Find a better way to associate the card with its mod data
                            const mod = modStoreState.lastRenderedMods?.find(
                                (m) => m.title === title,
                            )
                            if (mod) openModDetails(mod)
                        })
                        card.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                const title = card
                                    .querySelector('.modStoreCardTitle')
                                    .textContent.replace('Installed', '')
                                    .trim()
                                const mod = modStoreState.lastRenderedMods?.find(
                                    (m) => m.title === title,
                                )
                                if (mod) openModDetails(mod)
                            }
                        })
                    })
                    setupLazyLoading()
                }
                modStoreState.isLoading = false
            }
            modStoreWorker.onerror = function (error) {
                logger.error('Worker error:', error)
                modStoreState.isLoading = false
            }
        }

        // Wait for DOM to be fully ready
        // TODO: Better way to ensure DOM is ready?
        await new Promise((resolve) => setTimeout(resolve, 100))

        await searchMods()

        bindEventListeners()
    } catch (error) {
        logger.error('Failed to initialize mod store:', error)
        logger.error('Error stack:', error.stack)
        showError('Failed to initialize mod store: ' + error.message)
    }
}

function updateHeaderInfo() {
    const titleEl = document.querySelector('#modStoreTitle h1')
    const serverIcon = document.getElementById('modStoreServerIcon')

    if (titleEl && modStoreState.currentServer?.rawServer?.name) {
        titleEl.textContent = modStoreState.currentServer.rawServer.name
    }

    // Server icon
    if (serverIcon && modStoreState.currentServer?.rawServer?.icon) {
        serverIcon.src = modStoreState.currentServer.rawServer.icon
        serverIcon.style.display = 'block'
        serverIcon.onerror = () => {
            serverIcon.style.display = 'none'
        }
    } else if (serverIcon) {
        serverIcon.style.display = 'none'
    }

    const gameInfo = document.getElementById('modStoreGameInfo')
    const parts = []

    if (modStoreState.detectedLoader) {
        parts.push(
            modStoreState.detectedLoader.charAt(0).toUpperCase() +
        modStoreState.detectedLoader.slice(1),
        )
    }
    if (modStoreState.detectedVersion) {
        parts.push(modStoreState.detectedVersion)
    }

    gameInfo.textContent = parts.join(' • ') || 'Unknown'
}

/* ===================================================================
   FILTERS & UI RENDERING
   =================================================================== */

async function loadFilters() {
    try {
        let categories = []
        try {
            categories = await ModStoreManager.getCategories()
        } catch (error) {
            logger.warn('Categories endpoint not available, using fallback')
            categories = [
                { name: 'adventure' },
                { name: 'cursed' },
                { name: 'decoration' },
                { name: 'economy' },
                { name: 'equipment' },
                { name: 'food' },
                { name: 'game-mechanics' },
                { name: 'library' },
                { name: 'magic' },
                { name: 'management' },
                { name: 'minigame' },
                { name: 'mobs' },
                { name: 'optimization' },
                { name: 'social' },
                { name: 'storage' },
                { name: 'technology' },
                { name: 'transportation' },
                { name: 'utility' },
                { name: 'worldgen' },
            ]
        }
        renderCategories(categories)

        let loaders = []
        try {
            const allLoaders = await ModStoreManager.getLoaders()
            // Filter to only show client mod loaders: forge, neoforge, fabric, quilt
            const allowedLoaders = ['forge', 'neoforge', 'fabric', 'quilt']
            loaders = allLoaders.filter((l) =>
                allowedLoaders.includes(l.name.toLowerCase()),
            )
        } catch (error) {
            logger.warn('Loaders endpoint not available, using detected loader')
            if (modStoreState.detectedLoader) {
                loaders = [{ name: modStoreState.detectedLoader }]
            } else {
                loaders = [
                    { name: 'forge' },
                    { name: 'fabric' },
                    { name: 'neoforge' },
                    { name: 'quilt' },
                ]
            }
        }
        renderLoaders(loaders)

        let gameVersions = []
        try {
            if (modStoreState.detectedVersion) {
                gameVersions = [
                    { version: modStoreState.detectedVersion, version_type: 'release' },
                ]
            } else {
                const allVersions = await ModStoreManager.getGameVersions()
                gameVersions = allVersions
                    .filter((v) => v.version_type === 'release')
                    .slice(0, 5)
            }
        } catch (error) {
            logger.warn(
                'Game versions endpoint not available? Meh, using detected version',
            )
            if (modStoreState.detectedVersion) {
                gameVersions = [
                    { version: modStoreState.detectedVersion, version_type: 'release' },
                ]
            }
        }
        renderGameVersions(gameVersions)
    } catch (error) {
        logger.error('Failed to load filters:', error)
    }
}

function renderCategories(categories) {
    const container = document.getElementById('modStoreCategoriesFilter')
    container.innerHTML = ''

    const relevantCategories = categories.filter(
        (c) =>
            c.project_type === 'mod' &&
      [
          'adventure',
          'decoration',
          'equipment',
          'food',
          'library',
          'magic',
          'optimization',
          'storage',
          'technology',
          'utility',
          'worldgen',
      ].includes(c.name),
    )

    relevantCategories.forEach((category) => {
        const item = document.createElement('div')
        item.className = 'modStoreFilterItem'
        item.dataset.category = category.name

        item.innerHTML = `
            <div class="modStoreFilterCheckbox"></div>
            <span class="modStoreFilterLabel">${formatCategoryName(
        category.name,
    )}</span>
        `
        item.addEventListener('click', () => toggleCategory(category.name))
        container.appendChild(item)
    })
}

function renderLoaders(loaders) {
    const container = document.getElementById('modStoreLoadersFilter')
    container.innerHTML = ''

    loaders.forEach((loader) => {
        const item = document.createElement('div')
        item.className = 'modStoreFilterItem'
        item.dataset.loader = loader.name

        // Auto-select detected loader and mark it
        if (loader.name === modStoreState.detectedLoader) {
            item.classList.add('active')
            item.setAttribute('data-detected', 'true')
        }

        item.innerHTML = `
            <div class="modStoreFilterCheckbox"></div>
            <span class="modStoreFilterLabel">${formatLoaderName(
        loader.name,
    )}</span>
        `
        item.addEventListener('click', () => toggleLoader(loader.name))
        container.appendChild(item)
    })
}

function renderGameVersions(versions) {
    const container = document.getElementById('modStoreVersionsFilter')
    container.innerHTML = ''

    versions.forEach((version) => {
        const item = document.createElement('div')
        item.className = 'modStoreFilterItem'
        item.dataset.version = version.version

        // Auto-select detected version and mark it
        if (version.version === modStoreState.detectedVersion) {
            item.classList.add('active')
            item.setAttribute('data-detected', 'true')
        }

        item.innerHTML = `
            <div class="modStoreFilterCheckbox"></div>
            <span class="modStoreFilterLabel">${version.version}</span>
        `
        item.addEventListener('click', () => toggleVersion(version.version))
        container.appendChild(item)
    })
}

function toggleCategory(category) {
    const index = modStoreState.selectedCategories.indexOf(category)
    if (index > -1) {
        modStoreState.selectedCategories.splice(index, 1)
    } else {
        modStoreState.selectedCategories.push(category)
    }

    document
        .querySelector(`[data-category="${category}"]`)
        .classList.toggle('active')
    resetAndSearch()
}

function toggleLoader(loader) {
    // Don't allow deselecting the detected loade
    if (loader === modStoreState.detectedLoader) {
        return
    }

    const index = modStoreState.selectedLoaders.indexOf(loader)
    if (index > -1) {
        modStoreState.selectedLoaders.splice(index, 1)
    } else {
        modStoreState.selectedLoaders.push(loader)
    }

    document
        .querySelector(`[data-loader="${loader}"]`)
        .classList.toggle('active')
    resetAndSearch()
}

function toggleVersion(version) {
    // Don't allow deselecting the detected version
    if (version === modStoreState.detectedVersion) {
        return
    }

    const index = modStoreState.selectedVersions.indexOf(version)
    if (index > -1) {
        modStoreState.selectedVersions.splice(index, 1)
    } else {
        modStoreState.selectedVersions.push(version)
    }

    document
        .querySelector(`[data-version="${version}"]`)
        .classList.toggle('active')
    resetAndSearch()
}

/* ===================================================================
   EVENT HANDLERS
   =================================================================== */

// Debounce function for better performance
function debounce(func, wait) {
    let timeout
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout)
            func(...args)
        }
        clearTimeout(timeout)
        timeout = setTimeout(later, wait)
    }
}

// Throttle function for scroll events
function throttle(func, limit) {
    let inThrottle
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args)
            inThrottle = true
            setTimeout(() => (inThrottle = false), limit)
        }
    }
}

function bindEventListeners() {
    const debouncedSearch = debounce((value) => {
        modStoreState.searchQuery = value
        resetAndSearch()
    }, 300)

    document
        .getElementById('modStoreSearchInput')
        .addEventListener('input', (e) => {
            debouncedSearch(e.target.value)
        })

    // View select
    document
        .getElementById('modStoreViewSelect')
        .addEventListener('change', (e) => {
            modStoreState.limit = parseInt(e.target.value)
            resetAndSearch()
        })

    // Pagination
    document.getElementById('modStorePrevBtn').addEventListener('click', () => {
        if (modStoreState.offset >= modStoreState.limit) {
            modStoreState.offset -= modStoreState.limit
            searchMods()
        }
    })

    document.getElementById('modStoreNextBtn').addEventListener('click', () => {
        const totalPages = Math.ceil(modStoreState.totalHits / modStoreState.limit)
        const currentPage =
      Math.floor(modStoreState.offset / modStoreState.limit) + 1
        if (currentPage < totalPages) {
            modStoreState.offset += modStoreState.limit
            searchMods()
        }
    })

    // Page jump functionality
    const pageJumpBtn = document.getElementById('modStorePageJumpBtn')
    const pageInput = document.getElementById('modStorePageInput')

    if (pageJumpBtn && pageInput) {
        const jumpToPage = () => {
            const pageNum = parseInt(pageInput.value)
            const totalPages = Math.ceil(
                modStoreState.totalHits / modStoreState.limit,
            )

            if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
                pageInput.value = ''
                return
            }

            modStoreState.offset = (pageNum - 1) * modStoreState.limit
            pageInput.value = ''
            searchMods()
        }

        pageJumpBtn.addEventListener('click', jumpToPage)
        pageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                jumpToPage()
            }
        })
    }

    // Close button
    const closeBtn = document.getElementById('modStoreCloseBtn')
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModStore)
    }

    // Modal close
    document
        .getElementById('modStoreModalClose')
        .addEventListener('click', closeModal)
    document.getElementById('modStoreModal').addEventListener('click', (e) => {
        if (e.target.id === 'modStoreModal') {
            closeModal()
        }
    })

    // Install button
    document
        .getElementById('modStoreModalInstallBtn')
        .addEventListener('click', installSelectedMod)

    // Remove button
    document
        .getElementById('modStoreModalRemoveBtn')
        .addEventListener('click', removeSelectedMod)
}

function resetAndSearch() {
    modStoreState.offset = 0
    searchMods()
}

/* ===================================================================
   SEARCH & RESULTS
   =================================================================== */

async function searchMods() {
    if (modStoreState.isLoading) return

    if (!document.getElementById('modstore-results')) {
        logger.error('Mod store DOM not ready yet')
        return
    }

    modStoreState.isLoading = true
    showLoading()

    try {
        const searchLoaders =
      modStoreState.selectedLoaders.length > 0
          ? modStoreState.selectedLoaders
          : modStoreState.detectedLoader
              ? [modStoreState.detectedLoader]
              : []

        const searchVersions =
      modStoreState.selectedVersions.length > 0
          ? modStoreState.selectedVersions
          : modStoreState.detectedVersion
              ? [modStoreState.detectedVersion]
              : []

        const results = await ModStoreManager.searchMods({
            query: modStoreState.searchQuery,
            categories: modStoreState.selectedCategories,
            loaders: searchLoaders,
            versions: searchVersions,
            offset: modStoreState.offset,
            limit: modStoreState.limit,
        })

        // Update state from API response
        const hits = results?.hits || []
        modStoreState.totalHits = results?.total_hits || 0
        modStoreState.currentPageResults = hits.length

        // Calculate pagination info
        const currentPage =
      Math.floor(modStoreState.offset / modStoreState.limit) + 1
        const totalPages = Math.ceil(modStoreState.totalHits / modStoreState.limit)
        const startResult = modStoreState.offset + 1
        const endResult = modStoreState.offset + hits.length

        logger.info(
            `Page ${currentPage} of ${totalPages}: Results ${startResult}-${endResult} of ~${modStoreState.totalHits} mods`,
        )

        requestAnimationFrame(() => {
            renderResults(hits)
            updatePagination()
        })
    } catch (error) {
        logger.error('Search failed:', error)
        showError('Failed to search mods')
    } finally {
        modStoreState.isLoading = false
    }
}

function renderResults(mods) {
    if (modStoreWorker) {
        showLoading()
        // Process mods to add installation status and pre-format data
        const processedMods = mods.map((mod) => {
            // Check by slug in installedMods Map
            let isInstalled = modStoreState.installedMods.has(mod.slug.toLowerCase())
            let installedInfo = isInstalled
                ? modStoreState.installedMods.get(mod.slug.toLowerCase())
                : null

            // Also check if mod slug appears in any user-installed filename
            if (!isInstalled) {
                const modSlug = mod.slug.toLowerCase().replace(/-/g, '_')
                const hasMatch = modStoreState.userModFiles.some(
                    (filename) =>
                        filename.includes(mod.slug.toLowerCase()) ||
            filename.includes(modSlug),
                )
                if (hasMatch) {
                    isInstalled = true
                    installedInfo = {
                        source: 'user',
                        removable: true,
                    }
                }
            }

            // Pre-format data for worker
            const categories = (mod.categories || []).filter(
                (c) => !['fabric', 'forge', 'neoforge', 'quilt'].includes(c),
            )
            const category = categories[0] || 'misc'

            return {
                ...mod,
                isInstalled,
                installedInfo,
                formattedTitle: escapeHtml(mod.title),
                formattedAuthor: escapeHtml(mod.author || 'Unknown'),
                formattedDescription: escapeHtml(mod.description),
                formattedDownloads: formatNumber(mod.downloads),
                formattedFollows: formatNumber(mod.follows),
                formattedCategory: formatCategoryName(category),
                installedBadge: isInstalled
                    ? '<span class="modStoreInstalledBadge"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="8" height="8" fill="currentColor"><path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/></svg>Installed</span>'
                    : '',
            }
        })
        modStoreState.lastRenderedMods = processedMods
        modStoreWorker.postMessage({ mods: processedMods })
    } else {
    // Fallback: original synchronous rendering
        const container = document.getElementById('modstore-results')

        if (mods.length === 0) {
            container.innerHTML = `
                <div class="modStoreEmptyState">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3>No mods found</h3>
                    <p>Try adjusting your search or filters</p>
                </div>
            `
            return
        }

        const fragment = document.createDocumentFragment()
        const grid = document.createElement('div')
        grid.id = 'modStoreGrid'

        mods.forEach((mod) => {
            // Check by slug in installedMods Map
            let isInstalled = modStoreState.installedMods.has(mod.slug.toLowerCase())
            let installedInfo = isInstalled
                ? modStoreState.installedMods.get(mod.slug.toLowerCase())
                : null

            // Also check if mod slug appears in any user-installed filename
            if (!isInstalled) {
                const modSlug = mod.slug.toLowerCase().replace(/-/g, '_')
                const hasMatch = modStoreState.userModFiles.some(
                    (filename) =>
                        filename.includes(mod.slug.toLowerCase()) ||
            filename.includes(modSlug),
                )
                if (hasMatch) {
                    isInstalled = true
                    installedInfo = {
                        source: 'user',
                        removable: true,
                    }
                }
            }

            mod.isInstalled = isInstalled
            mod.installedInfo = installedInfo

            const card = createModCard(mod)
            grid.appendChild(card)
        })

        modStoreState.lastRenderedMods = mods
        fragment.appendChild(grid)
        container.innerHTML = ''
        container.appendChild(fragment)

        setupLazyLoading()
    }
}

function setupLazyLoading() {
    const images = document.querySelectorAll('.modStoreCardIcon')

    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver(
            (entries, observer) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const img = entry.target
                        const src = img.dataset.src
                        if (src) {
                            img.src = src
                            img.removeAttribute('data-src')
                            img.onerror = function () {
                                this.src =
                  'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 100 100%27%3E%3Crect fill=%27%238b5cf6%27 width=%27100%27 height=%27100%27/%3E%3Ccircle cx=%2750%27 cy=%2750%27 r=%2735%27 fill=%27none%27 stroke=%27white%27 stroke-width=%274%27/%3E%3Ctext x=%2750%27 y=%2765%27 font-size=%2748%27 font-weight=%27bold%27 fill=%27white%27 text-anchor=%27middle%27 font-family=%27sans-serif%27%3E%3F%3C/text%3E%3C/svg%3E'
                                this.onerror = null
                            }
                            observer.unobserve(img)
                        }
                    }
                })
            },
            {
                rootMargin: '50px',
            },
        )

        images.forEach((img) => imageObserver.observe(img))
    } else {
    // Fallback
        images.forEach((img) => {
            if (img.dataset.src) {
                img.src = img.dataset.src
                img.removeAttribute('data-src')
                // Add error handler when image loads
                img.onerror = function () {
                    this.src =
            'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 100 100%27%3E%3Crect fill=%27%238b5cf6%27 width=%27100%27 height=%27100%27/%3E%3Ccircle cx=%2750%27 cy=%2750%27 r=%2735%27 fill=%27none%27 stroke=%27white%27 stroke-width=%274%27/%3E%3Ctext x=%2750%27 y=%2765%27 font-size=%2748%27 font-weight=%27bold%27 fill=%27white%27 text-anchor=%27middle%27 font-family=%27sans-serif%27%3E%3F%3C/text%3E%3C/svg%3E'
                    this.onerror = null
                }
            }
        })
    }
}

function createModCard(mod) {
    const card = document.createElement('div')
    card.className = 'modStoreCard'

    const iconUrl =
    mod.icon_url ||
    'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 100 100%27%3E%3Crect fill=%27%238b5cf6%27 width=%27100%27 height=%27100%27/%3E%3Ccircle cx=%2750%27 cy=%2750%27 r=%2735%27 fill=%27none%27 stroke=%27white%27 stroke-width=%274%27/%3E%3Ctext x=%2750%27 y=%2765%27 font-size=%2748%27 font-weight=%27bold%27 fill=%27white%27 text-anchor=%27middle%27 font-family=%27sans-serif%27%3E%3F%3C/text%3E%3C/svg%3E'

    const categories = (mod.categories || []).filter(
        (c) => !['fabric', 'forge', 'neoforge', 'quilt'].includes(c),
    )
    const category = categories[0] || 'misc'

    const installedBadge = mod.isInstalled
        ? `<span class="modStoreInstalledBadge"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="8" height="8" fill="currentColor"><path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/></svg>${LangLoader.queryJS(
            'modstore.installedBadge',
        )}</span>`
        : ''

    card.innerHTML = `
        <div class="modStoreCardHeader">
            <img data-src="${iconUrl}" alt="${escapeHtml(
    mod.title,
)}" class="modStoreCardIcon">
            <div class="modStoreCardInfo">
                <h3 class="modStoreCardTitle">${escapeHtml(
        mod.title,
    )}${installedBadge}</h3>
                <div class="modStoreCardAuthor">by ${escapeHtml(
        mod.author || 'Unknown',
    )}</div>
            </div>
        </div>
        <div class="modStoreCardBody">
            <p class="modStoreCardDescription">${escapeHtml(
        mod.description,
    )}</p>
        </div>
        <div class="modStoreCardFooter">
            <div class="modStoreCardStats">
                <div class="modStoreCardStat">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    ${formatNumber(mod.downloads)}
                </div>
                <div class="modStoreCardStat">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    ${formatNumber(mod.follows)}
                </div>
            </div>
            <div class="modStoreCardTags">
                <span class="modStoreCardTag">${formatCategoryName(
        category,
    )}</span>
            </div>
        </div>
    `

    // Add hover feedback and tooltip
    card.setAttribute('title', `Click to view details for ${mod.title}`)
    card.addEventListener('click', () => openModDetails(mod))

    // Add keyboard accessibility
    card.setAttribute('tabindex', '0')
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openModDetails(mod)
        }
    })

    return card
}

/* ===================================================================
   MOD DETAILS MODAL
   =================================================================== */

async function openModDetails(mod) {
    modStoreState.selectedMod = mod
    modStoreState.selectedVersion = null
    modStoreState.showAllVersions = false

    const modal = document.getElementById('modStoreModal')
    const loading = document.getElementById('modStoreModalLoading')
    const details = document.getElementById('modStoreModalDetails')

    if (!modal || !loading || !details) {
        logger.error('Modal elements not found in DOM')
        showError('Failed to load mod details - UI elements missing')
        return
    }

    modal.style.display = 'flex'
    loading.style.display = 'flex'
    details.style.display = 'none'

    try {
        const fullMod = await ModStoreManager.getModDetails(mod.project_id)

        const versions = await ModStoreManager.getModVersions(mod.project_id, {
            loaders: modStoreState.detectedLoader
                ? [modStoreState.detectedLoader]
                : undefined,
            gameVersions: modStoreState.detectedVersion
                ? [modStoreState.detectedVersion]
                : undefined,
        })

        renderModDetails(fullMod, versions)
    } catch (error) {
        logger.error('Failed to load mod details:', error)
        showError('Failed to load mod details')
        closeModal()
    }
}

function renderModDetails(mod, versions) {
    const loading = document.getElementById('modStoreModalLoading')
    const details = document.getElementById('modStoreModalDetails')
    const installProgress = document.getElementById('modStoreInstallProgress')
    const installSuccess = document.getElementById('modStoreInstallSuccess')

    if (!loading || !details) {
        logger.error('Modal elements not found')
        return
    }

    // Clear installation states
    installProgress.style.display = 'none'
    installSuccess.style.display = 'none'

    let isInstalled = modStoreState.installedMods.has(mod.slug.toLowerCase())
    let installedInfo = isInstalled
        ? modStoreState.installedMods.get(mod.slug.toLowerCase())
        : null

    if (!isInstalled && versions && versions.length > 0) {
        for (const version of versions) {
            const files = version.files || []
            for (const file of files) {
                if (modStoreState.userModFiles.includes(file.filename.toLowerCase())) {
                    isInstalled = true
                    installedInfo = {
                        filename: file.filename,
                        source: 'user',
                        removable: true,
                    }
                    break
                }
            }
            if (isInstalled) break
        }
    }

    const isRemovable = installedInfo?.removable !== false

    const titleEl = document.getElementById('modStoreModalTitle')
    if (titleEl) {
        titleEl.textContent = mod.title
        if (isInstalled) {
            const checkIcon =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="10" height="10" fill="currentColor"><path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/></svg>'
            const badgeText =
        installedInfo?.source === 'distribution'
            ? LangLoader.queryJS('modstore.managedByAdmin')
            : `${checkIcon} ${LangLoader.queryJS('modstore.installedBadge')}`
            titleEl.innerHTML = `${mod.title} <span class="modStoreInstalledBadge">${badgeText}</span>`
        }
    }

    const iconEl = document.getElementById('modStoreModalIcon')
    if (iconEl) {
        const iconUrl =
      mod.icon_url ||
      'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 100 100%27%3E%3Crect fill=%27%238b5cf6%27 width=%27100%27 height=%27100%27/%3E%3Ccircle cx=%2750%27 cy=%2750%27 r=%2735%27 fill=%27none%27 stroke=%27white%27 stroke-width=%274%27/%3E%3Ctext x=%2750%27 y=%2765%27 font-size=%2748%27 font-weight=%27bold%27 fill=%27white%27 text-anchor=%27middle%27 font-family=%27sans-serif%27%3E%3F%3C/text%3E%3C/svg%3E'
        iconEl.src = iconUrl
        iconEl.onerror = () => {
            iconEl.src =
        'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 100 100%27%3E%3Crect fill=%27%238b5cf6%27 width=%27100%27 height=%27100%27/%3E%3Ccircle cx=%2750%27 cy=%2750%27 r=%2735%27 fill=%27none%27 stroke=%27white%27 stroke-width=%274%27/%3E%3Ctext x=%2750%27 y=%2765%27 font-size=%2748%27 font-weight=%27bold%27 fill=%27white%27 text-anchor=%27middle%27 font-family=%27sans-serif%27%3E%3F%3C/text%3E%3C/svg%3E'
            iconEl.onerror = null
        }
    }

    const descEl = document.getElementById('modStoreModalDescription')
    if (descEl) descEl.textContent = mod.description

    const downloadsEl = document.getElementById('modStoreModalDownloads')
    if (downloadsEl) {
        downloadsEl.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            ${formatNumber(mod.downloads)} downloads
        `
    }

    const followersEl = document.getElementById('modStoreModalFollowers')
    if (followersEl) {
        followersEl.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            ${formatNumber(mod.followers || 0)} followers
        `
    }

    const updatedEl = document.getElementById('modStoreModalUpdated')
    if (updatedEl) {
        const updateDate =
      mod.date_modified ||
      mod.updated ||
      mod.updated_datetime ||
      mod.date_published
        updatedEl.textContent = `${LangLoader.queryJS(
            'modstore.updatedLabel',
        )} ${formatDate(updateDate)}`
    }

    const linksContainer = document.getElementById('modStoreModalLinks')
    if (linksContainer) {
        linksContainer.innerHTML = ''
        if (mod.source_url) {
            linksContainer.innerHTML += `<a href="#" class="modStoreModalLink" onclick="require('electron').shell.openExternal('${escapeHtml(
                mod.source_url,
            )}'); return false;">${LangLoader.queryJS(
                'modstore.sourceCodeLink',
            )}</a>`
        }
        if (mod.issues_url) {
            linksContainer.innerHTML += `<a href="#" class="modStoreModalLink" onclick="require('electron').shell.openExternal('${escapeHtml(
                mod.issues_url,
            )}'); return false;">${LangLoader.queryJS('modstore.issuesLink')}</a>`
        }
        if (mod.wiki_url) {
            linksContainer.innerHTML += `<a href="#" class="modStoreModalLink" onclick="require('electron').shell.openExternal('${escapeHtml(
                mod.wiki_url,
            )}'); return false;">${LangLoader.queryJS('modstore.wikiLink')}</a>`
        }
        if (mod.discord_url) {
            linksContainer.innerHTML += `<a href="#" class="modStoreModalLink" onclick="require('electron').shell.openExternal('${escapeHtml(
                mod.discord_url,
            )}'); return false;">${LangLoader.queryJS('modstore.discordLink')}</a>`
        }
    }

    const sourceContainer = document.getElementById('modStoreModalSource')
    if (sourceContainer) {
        const projectUrl = `https://modrinth.com/mod/${mod.slug}`
        sourceContainer.innerHTML = LangLoader.queryJS('modstore.dataProvidedBy', {
            provider: `<a href="#" onclick="require('electron').shell.openExternal('${projectUrl}'); return false;">Modrinth</a>`,
        })
    }

    modStoreState.allVersionsData = versions

    renderVersionsList(versions)

    bindVersionControls()

    const installBtn = document.getElementById('modStoreModalInstallBtn')
    const removeBtn = document.getElementById('modStoreModalRemoveBtn')

    if (installBtn) {
        if (isInstalled && !isRemovable) {
            // Admin-configured mod
            installBtn.style.display = 'none'
        } else if (isInstalled) {
            // User-installed mod
            installBtn.style.display = 'block'
            installBtn.textContent = LangLoader.queryJS(
                'modstore.updateVersionButton',
            )
            installBtn.disabled = true // Will be enabled when version selected
        } else {
            // Not installed
            installBtn.style.display = 'block'
            installBtn.textContent = LangLoader.queryJS('modstore.installModButton')
            installBtn.disabled = true // Will be enabled when version selected
        }
    }

    if (removeBtn) {
        if (isInstalled && isRemovable) {
            // User-installed mod
            removeBtn.style.display = 'block'
            removeBtn.disabled = false
        } else if (isInstalled && !isRemovable) {
            // Admin-configured mod
            removeBtn.style.display = 'block'
            removeBtn.disabled = true
            removeBtn.title =
        'This mod is configured by your server administrator and cannot be removed'
        } else {
            // Not installed
            removeBtn.style.display = 'none'
        }
    }

    loading.style.display = 'none'
    details.style.display = 'block'
}

function renderVersionsList(versions) {
    const container = document.getElementById('modStoreModalVersionList')
    const showAllBtn = document.getElementById('modStoreShowAllVersions')

    if (!container) return

    container.innerHTML = ''

    if (versions.length === 0) {
        container.innerHTML = `<div class="modStoreFilterLoading">${LangLoader.queryJS(
            'modstore.noCompatibleVersionsFound',
            {
                loader: modStoreState.detectedLoader,
                version: modStoreState.detectedVersion,
            },
        )}</div>`
        if (showAllBtn) showAllBtn.style.display = 'none'
        return
    }

    let filteredVersions = versions
    if (modStoreState.versionChannel !== 'all') {
        filteredVersions = versions.filter(
            (v) => v.version_type === modStoreState.versionChannel,
        )
    }

    if (modStoreState.versionSort === 'version') {
    // Sort by version number (descending)
        filteredVersions = [...filteredVersions].sort((a, b) => {
            return b.name.localeCompare(a.name, undefined, { numeric: true })
        })
    } else {
    // Sort by date is handled on the API side, so no action needed here
    }

    const showAll = modStoreState.showAllVersions || false
    const displayVersions = showAll
        ? filteredVersions
        : filteredVersions.slice(0, 5)

    if (showAllBtn) {
        if (filteredVersions.length > 5) {
            showAllBtn.style.display = 'inline-block'
            showAllBtn.textContent = showAll
                ? 'Show Less'
                : `Show All ${filteredVersions.length} Versions`
            showAllBtn.onclick = () => {
                modStoreState.showAllVersions = !showAll
                renderVersionsList(modStoreState.allVersionsData)
            }
        } else {
            showAllBtn.style.display = 'none'
        }
    }

    displayVersions.forEach((version, index) => {
        const item = document.createElement('div')
        item.className = 'modStoreVersionItem'
        if (index === 0 && !modStoreState.selectedVersion) {
            item.classList.add('selected')
            modStoreState.selectedVersion = version
            // Enable install button immediately since latest version is auto-selected
            setTimeout(() => enableInstallButton(), 100)
        } else if (
            modStoreState.selectedVersion &&
      modStoreState.selectedVersion.id === version.id
        ) {
            item.classList.add('selected')
        }

        const versionBadge =
      index === 0 ? '<span class="modStoreVersionBadge">Latest</span>' : ''

        item.innerHTML = `
            <div class="modStoreVersionHeader">
                <span class="modStoreVersionName">${escapeHtml(
        version.name,
    )}</span>
                ${versionBadge}
                <span class="modStoreVersionType">${version.version_type}</span>
            </div>
            <div class="modStoreVersionInfo">
                ${version.game_versions.join(', ')} • ${version.loaders.join(
    ', ',
)} • ${formatDate(version.date_published)}
            </div>
        `

        item.addEventListener('click', () => {
            document
                .querySelectorAll('.modStoreVersionItem')
                .forEach((v) => v.classList.remove('selected'))
            item.classList.add('selected')
            modStoreState.selectedVersion = version
            enableInstallButton()
        })

        container.appendChild(item)
    })
}

function enableInstallButton() {
    const btn = document.getElementById('modStoreModalInstallBtn')
    btn.disabled = false
}

function bindVersionControls() {
    const sortSelect = document.getElementById('modStoreVersionSort')
    const channelSelect = document.getElementById('modStoreVersionChannel')

    if (sortSelect) {
        sortSelect.value = modStoreState.versionSort
        sortSelect.onchange = (e) => {
            modStoreState.versionSort = e.target.value
            renderVersionsList(modStoreState.allVersionsData)
        }
    }

    if (channelSelect) {
        channelSelect.value = modStoreState.versionChannel
        channelSelect.onchange = (e) => {
            modStoreState.versionChannel = e.target.value
            renderVersionsList(modStoreState.allVersionsData)
        }
    }
}

/* ===================================================================
   MOD INSTALLATION & REMOVAL
   =================================================================== */

async function installSelectedMod() {
    if (!modStoreState.selectedVersion || !modStoreState.currentServer) {
        return
    }

    const btn = document.getElementById('modStoreModalInstallBtn')
    const originalText = btn.textContent
    btn.disabled = true

    const isUpdate = modStoreState.selectedMod?.isInstalled
    btn.textContent = isUpdate
        ? LangLoader.queryJS('modstore.updatingText')
        : LangLoader.queryJS('modstore.installingText')

    // Show progress UI
    const modalDetails = document.getElementById('modStoreModalDetails')
    const installProgress = document.getElementById('modStoreInstallProgress')
    const installSuccess = document.getElementById('modStoreInstallSuccess')
    const progressFill = document.getElementById('modStoreInstallProgressFill')
    const statusText = document.getElementById('modStoreInstallStatus')
    const successMessage = document.getElementById('modStoreSuccessMessage')
    const cancelBtn = document.getElementById('modStoreInstallCancelBtn')

    modalDetails.style.display = 'none'
    installProgress.style.display = 'flex'
    installSuccess.style.display = 'none'
    progressFill.style.width = '0%'

    // Setup cancel button
    let isCancelled = false
    cancelBtn.onclick = () => {
        isCancelled = true
        cancelBtn.disabled = true
        cancelBtn.textContent = LangLoader.queryJS('modstore.cancellingText')
    }

    try {
        const instanceDir = await ipcRenderer.invoke(
            'modstore-get-instance-directory',
        )

        if (!instanceDir) {
            throw new Error(
                'Instance directory not configured. Please check launcher settings.',
            )
        }

        const serverId = modStoreState.currentServer?.rawServer?.id

        if (!serverId) {
            throw new Error('No server selected')
        }

        const modsDir = path.join(instanceDir, serverId, 'mods')

        logger.info(`${isUpdate ? 'Updating' : 'Installing'} mod to:`, modsDir)

        // Progress: 25%
        statusText.textContent = isUpdate
            ? LangLoader.queryJS('modstore.removingOldVersion')
            : LangLoader.queryJS('modstore.preparingInstallation')
        progressFill.style.width = '25%'

        // If updating, remove old version first
        if (isUpdate && modStoreState.selectedMod?.slug) {
            if (isCancelled) throw new Error('Installation cancelled by user')
            await ModStoreManager.removeMod(modStoreState.selectedMod.slug, modsDir)
        }

        // Progress: 50%
        statusText.textContent = LangLoader.queryJS('modstore.downloadingModFiles')
        progressFill.style.width = '50%'

        if (isCancelled) throw new Error('Installation cancelled by user')
        await ModStoreManager.installMod(modStoreState.selectedVersion, modsDir)

        // Progress: 75%
        statusText.textContent = LangLoader.queryJS(
            'modstore.finalizingInstallation',
        )
        progressFill.style.width = '75%'

        if (isCancelled) throw new Error('Installation cancelled by user')
        await scanInstalledMods()

        // Progress: 100%
        progressFill.style.width = '100%'

        // Show success screen
        setTimeout(() => {
            installProgress.style.display = 'none'
            installSuccess.style.display = 'flex'
            successMessage.textContent = isUpdate
                ? LangLoader.queryJS('modstore.modUpdatedSuccessfully', {
                    modTitle: modStoreState.selectedMod.title,
                })
                : LangLoader.queryJS('modstore.modInstalledSuccessfully', {
                    modTitle: modStoreState.selectedMod.title,
                })

            // Show support prompt after brief success display
            setTimeout(() => {
                /*
                    ======================================================================================

                    Notice to Fork Authors:

                    Mod developers dedicate significant effort to creating and maintaining 
                    mods at no cost, enabling both our launcher and derivative projects.
                    We kindly request that you retain this support prompt in your fork. 
                    Should you choose not to comply, we kindly ask you to cease the use of our API.
                    Please be advised that we monitor API usage and will block access if deemed necessary.

                    ======================================================================================
                */

                if (!modStoreState.supportPromptShown && modStoreState.selectedMod) {
                    modStoreState.supportPromptShown = true
                    const mod = modStoreState.selectedMod
                    const modPageUrl = `https://modrinth.com/mod/${mod.slug}`

                    showSupportPrompt(mod.title, modPageUrl)
                } else {
                    closeModal()
                }
            }, 1500)
        }, 300)
    } catch (error) {
        logger.error('Failed to install mod:', error)

        // Show error state
        installProgress.style.display = 'none'
        installSuccess.style.display = 'flex'
        successMessage.textContent = `${LangLoader.queryJS(
            'modstore.errorPrefix',
        )} ${error.message}`
        successMessage.style.color = 'var(--color-error)'
        installSuccess.querySelector('svg').style.color = 'var(--color-error)'

        btn.textContent = originalText
        btn.disabled = false

        // Allow user to close after error
        setTimeout(() => {
            closeModal()
        }, 3000)
    } finally {
        cancelBtn.onclick = null
    }
}

async function removeSelectedMod() {
    if (!modStoreState.selectedMod || !modStoreState.currentServer) {
        return
    }

    const btn = document.getElementById('modStoreModalRemoveBtn')
    const originalText = btn.textContent
    btn.disabled = true
    btn.textContent = LangLoader.queryJS('modstore.removingText')

    try {
        const instanceDir = await ipcRenderer.invoke(
            'modstore-get-instance-directory',
        )

        if (!instanceDir) {
            throw new Error(
                'Instance directory not configured. Please check launcher settings.',
            )
        }

        const serverId = modStoreState.currentServer?.rawServer?.id

        if (!serverId) {
            throw new Error('No server selected')
        }

        const modsDir = path.join(instanceDir, serverId, 'mods')

        logger.info('Removing mod from:', modsDir)

        let targetFilename = null

        if (
            modStoreState.allVersionsData &&
      modStoreState.allVersionsData.length > 0
        ) {
            for (const version of modStoreState.allVersionsData) {
                const files = version.files || []
                for (const file of files) {
                    if (
                        modStoreState.userModFiles.includes(file.filename.toLowerCase())
                    ) {
                        targetFilename = file.filename
                        logger.info(`Found installed file to remove: ${targetFilename}`)
                        break
                    }
                }
                if (targetFilename) break
            }
        }

        let removedCount = 0

        if (targetFilename) {
            const fs = require('fs-extra')
            const filePath = path.join(modsDir, targetFilename)
            if (await fs.pathExists(filePath)) {
                await fs.remove(filePath)
                logger.info(`Removed mod file: ${targetFilename}`)
                removedCount = 1
            }
        } else {
            // slug-based removal
            logger.info('Falling back to slug-based removal')
            removedCount = await ModStoreManager.removeMod(
                modStoreState.selectedMod.slug,
                modsDir,
            )
        }

        if (removedCount > 0) {
            btn.innerHTML =
        'Removed <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="12" height="12" fill="currentColor" style="vertical-align: middle;"><path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/></svg>'

            await scanInstalledMods()

            setTimeout(() => {
                btn.textContent = originalText
                btn.disabled = false
                closeModal()
                searchMods()
            }, 1500)
        } else {
            throw new Error('No mod files found to remove')
        }
    } catch (error) {
        logger.error('Failed to remove mod:', error)
        btn.textContent = LangLoader.queryJS('modstore.removeFailedText')
        setTimeout(() => {
            btn.textContent = originalText
            btn.disabled = false
        }, 2000)
    }
}

/* ===================================================================
   MODAL & DIALOG MANAGEMENT
   =================================================================== */

function closeModal() {
    const modal = document.getElementById('modStoreModal')
    const installProgress = document.getElementById('modStoreInstallProgress')
    const installSuccess = document.getElementById('modStoreInstallSuccess')

    modal.style.display = 'none'
    installProgress.style.display = 'none'
    installSuccess.style.display = 'none'
    modStoreState.selectedMod = null
    modStoreState.selectedVersion = null
}

/*
======================================================================================

Notice to Fork Authors:

Mod developers dedicate significant effort to creating and maintaining 
mods at no cost, enabling both our launcher and derivative projects.
We kindly request that you retain this support prompt in your fork. 
Should you choose not to comply, we kindly ask you to cease the use of our API.
Please be advised that we monitor API usage and will block access if deemed necessary.

======================================================================================
*/

function showSupportPrompt(modTitle, modPageUrl) {
    const promptOverlay = document.getElementById('modStoreSupportPrompt')
    const titleEl = document.getElementById('modStoreSupportTitle')
    const countdownEl = document.getElementById('modStoreSupportCountdown')
    const timerEl = document.querySelector('.modStoreSupportTimer')
    const buttonsEl = document.querySelector('.modStoreSupportButtons')
    const visitBtn = document.getElementById('modStoreSupportVisit')
    const dismissBtn = document.getElementById('modStoreSupportDismiss')

    if (!promptOverlay) return

    titleEl.textContent = LangLoader.queryJS('modstore.supportPromptTitle')

    promptOverlay.style.display = 'flex'
    visitBtn.style.display = 'block'
    visitBtn.disabled = false

    let countdown = 3
    countdownEl.textContent = countdown
    dismissBtn.disabled = true
    dismissBtn.textContent = LangLoader.queryJS('modstore.noThanksCountdown', {
        countdown,
    })

    timerEl.innerHTML = LangLoader.queryJS('modstore.supportCountdownText', {
        seconds: `<span id="modStoreSupportCountdown">${countdown}</span>`,
    })

    const interval = setInterval(() => {
        countdown--
        if (countdown > 0) {
            countdownEl.textContent = countdown
            dismissBtn.textContent = LangLoader.queryJS(
                'modstore.noThanksCountdown',
                { countdown },
            )
            timerEl.innerHTML = LangLoader.queryJS('modstore.supportCountdownText', {
                seconds: `<span id="modStoreSupportCountdown">${countdown}</span>`,
            })
        } else {
            clearInterval(interval)
            dismissBtn.disabled = false
            dismissBtn.textContent = LangLoader.queryJS('modstore.noThanksButton')
            timerEl.style.display = 'none'
            buttonsEl.style.display = 'flex'
        }
    }, 1000)

    buttonsEl.style.display = 'flex'

    visitBtn.onclick = () => {
        require('electron').shell.openExternal(modPageUrl)
        promptOverlay.style.display = 'none'
        closeModal()
        setTimeout(() => {
            timerEl.style.display = 'block'
            buttonsEl.style.display = 'none'
            dismissBtn.textContent = LangLoader.queryJS('modstore.noThanksButton')
        }, 500)
    }

    dismissBtn.onclick = () => {
        if (dismissBtn.disabled) return
        promptOverlay.style.display = 'none'
        closeModal()
        setTimeout(() => {
            timerEl.style.display = 'block'
            buttonsEl.style.display = 'none'
            dismissBtn.textContent = LangLoader.queryJS('modstore.noThanksButton')
        }, 500)
    }
}

function closeModStore() {
    if (modStoreWorker) {
        modStoreWorker.terminate()
        modStoreWorker = null
    }
    if (typeof toggleModStore === 'function') {
        toggleModStore()
    }
}

/* ===================================================================
   UTILITY FUNCTIONS
   =================================================================== */

function updatePagination() {
    const pageInfo = document.getElementById('modStorePageInfo')
    const pageInput = document.getElementById('modStorePageInput')

    const currentPage =
    Math.floor(modStoreState.offset / modStoreState.limit) + 1
    const totalPages = Math.ceil(modStoreState.totalHits / modStoreState.limit)
    const startResult = modStoreState.offset + 1
    const endResult = modStoreState.offset + modStoreState.currentPageResults

    const totalText =
    modStoreState.totalHits >= 1000
        ? `~${(modStoreState.totalHits / 1000).toFixed(1)}k`.replace('.0k', 'k')
        : `~${modStoreState.totalHits}`

    if (modStoreState.totalHits > 0 && modStoreState.currentPageResults > 0) {
        pageInfo.textContent = LangLoader.queryJS('modstore.showingResults', {
            start: startResult,
            end: endResult,
            total: totalText,
            current: currentPage,
            totalPages: totalPages,
        })
    } else {
        pageInfo.textContent = LangLoader.queryJS('modstore.noResultsFound')
    }

    if (pageInput) {
        pageInput.setAttribute('max', totalPages)
        pageInput.setAttribute('placeholder', `1-${totalPages}`)
    }

    document.getElementById('modStorePrevBtn').disabled = currentPage <= 1
    document.getElementById('modStoreNextBtn').disabled =
    currentPage >= totalPages || totalPages === 0
}

function showLoading() {
    const container = document.getElementById('modstore-results')
    if (!container) {
        logger.warn('modstore-results container not found')
        return
    }
    container.innerHTML = `
        <div id="modStoreLoading" class="modStoreLoadingState">
            <div class="modStoreLoadingSpinner"></div>
            <p>${LangLoader.queryJS('modstore.loadingModsText')}</p>
        </div>
    `
}

function formatNumber(num) {
    if (num === undefined || num === null || isNaN(num)) {
        return '0'
    }
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M'
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
}

function formatDate(dateString) {
    if (!dateString) return 'Unknown'

    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Unknown'

    const now = new Date()
    const diffTime = Math.abs(now - date)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 1) return 'today'
    if (diffDays < 2) return 'yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return `${Math.floor(diffDays / 365)} years ago`
}

function formatCategoryName(name) {
    return name
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
}

function formatLoaderName(name) {
    return name.charAt(0).toUpperCase() + name.slice(1)
}

function escapeHtml(text) {
    if (typeof text !== 'string') return text
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function translateElement(el) {
    const key = el.getAttribute('data-lang-key')
    if (!key) return
    const placeholdersAttr = el.getAttribute('data-lang-placeholders')
    let placeholders = {}
    if (placeholdersAttr) {
        try {
            placeholders = JSON.parse(placeholdersAttr)
        } catch (e) {
            console.error('Invalid placeholders JSON for', key, e)
        }
    }
    el.textContent = LangLoader.queryJS(key, placeholders)
}

function translatePage() {
    document.querySelectorAll('[data-lang-key]').forEach(translateElement)
    document.querySelectorAll('[data-lang-placeholder]').forEach((el) => {
        const key = el.getAttribute('data-lang-placeholder')
        el.placeholder = LangLoader.queryJS(key)
    })
    document.querySelectorAll('[data-lang-title]').forEach((el) => {
        const key = el.getAttribute('data-lang-title')
        el.title = LangLoader.queryJS(key)
    })
}

document.addEventListener('DOMContentLoaded', translatePage)
