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


const { ipcRenderer } = require('electron')

document.addEventListener('readystatechange', () => {
    if (document.readyState !== 'interactive' && document.readyState !== 'complete') return

    const fill = document.getElementById('splashProgressFill')
    const text = document.getElementById('splashProgressText')

    function setProgress(pct, message) {
        pct = Math.max(0, Math.min(100, pct))
        if (fill) fill.style.width = pct + '%'
        if (text) {
            if (message) text.textContent = message
            else if (pct >= 100) text.textContent = 'Finalizing...'
        }
    }

    ipcRenderer.on('splash-progress', (_ev, payload) => {
        if (!payload) return
        const pct = typeof payload.percent === 'number' ? payload.percent : 0
        setProgress(pct, payload.message || 'Starting...')
    })

    ipcRenderer.on('splash-message', (_ev, message) => {
        if (!message) return
        if (text) text.textContent = message
    })

    ipcRenderer.on('splash-done', () => setProgress(100, 'Ready'))
})

function createBgTiles() {
    const container = document.getElementById('splashBgTiles')
    if (!container) return

    const basePath = 'assets/images/splash/'
    const imgs = []
    for (let i = 0; i <= 11; i++) imgs.push(basePath + i + '.jpg')

    const tilesContainer = document.createElement('div')
    tilesContainer.className = 'splashTilesContainer'

    // We need enough tiles to fill the screen + extra for seamless loop
    // Calculate how many tiles we need (8 columns x however many rows to fill screen + buffer)
    const tileSize = 180 // must match CSS
    const cols = 8
    const rows = Math.ceil(window.innerHeight / tileSize) + 8

    const totalTiles = cols * rows
    const tilesNeeded = []
    const grid = []

    for (let r = 0; r < rows; r++) {
        grid[r] = []
        for (let c = 0; c < cols; c++) {
            let available = imgs.slice()
            // Exclude the image from the left neighbor and above neighbor
            if (c > 0) {
                const leftImg = grid[r][c - 1]
                available = available.filter(img => img !== leftImg)
            }

            if (r > 0) {
                const aboveImg = grid[r - 1][c]
                available = available.filter(img => img !== aboveImg)
            }
    
            const selected = available[Math.floor(Math.random() * available.length)]
            grid[r][c] = selected
            tilesNeeded.push(selected)
        }
    }

    tilesNeeded.forEach((imgPath) => {
        const tile = document.createElement('div')
        tile.className = 'splashTile'
        
        const img = document.createElement('img')
        img.src = imgPath
        img.alt = ''
        
        tile.appendChild(img)
        tilesContainer.appendChild(tile)
    })

    container.appendChild(tilesContainer)

    const dim = document.createElement('div')
    dim.className = 'splashTilesDim'
    container.appendChild(dim)
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createBgTiles)
} else {
    createBgTiles()
}
