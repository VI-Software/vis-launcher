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

const ConfigManager = require('./configmanager')

/**
 * Christmas Snowflakes Module
 * Displays falling snowflakes during December when enabled in settings.
 */

class ChristmasSnowflakes {
    constructor() {
        this.container = null
        this.snowflakeInterval = null
        this.isActive = false
    }

    /**
     * Check if we're currently in December
     * @returns {boolean} True if current month is December
     */
    isDecember() {
        const now = new Date()
        return now.getMonth() === 11 // December is month 11 (0-indexed)
    }

    /**
     * Initialize the snowflakes system
     */
    init() {
        if (!ConfigManager.getChristmasSnowflakesEnabled()) {
            return
        }

        if (!this.isDecember()) {
            return
        }

        if (!this.container) {
            this.container = document.createElement('div')
            this.container.id = 'christmasSnowflakesContainer'
            document.body.appendChild(this.container)
        }

        this.start()
    }

    /**
     * Start generating snowflakes
     */
    start() {
        if (this.isActive) return

        this.isActive = true
        
        for (let i = 0; i < 15; i++) {
            setTimeout(() => this.createSnowflake(true), i * 300)
        }

        // Create new snowflakes periodically
        this.snowflakeInterval = setInterval(() => {
            this.createSnowflake()
        }, 800)
    }

    /**
     * Stop generating snowflakes and clear existing ones
     */
    stop() {
        this.isActive = false
        
        if (this.snowflakeInterval) {
            clearInterval(this.snowflakeInterval)
            this.snowflakeInterval = null
        }

        if (this.container) {
            this.container.innerHTML = ''
        }
    }

    /**
     * Toggle snowflakes on/off
     */
    toggle(enabled) {
        if (enabled && this.isDecember()) {
            if (!this.container) {
                this.container = document.createElement('div')
                this.container.id = 'christmasSnowflakesContainer'
                document.body.appendChild(this.container)
            }
            this.start()
        } else {
            this.stop()
        }
    }

    /**
     * Create a single snowflake
     * @param {boolean} isInitial If true, snowflake starts at a random position in the viewport
     */
    createSnowflake(isInitial = false) {
        if (!this.container) return

        const snowflake = document.createElement('div')
        snowflake.classList.add('snowflake')
        snowflake.innerHTML = '❄'

        const startX = Math.random() * window.innerWidth
        snowflake.style.left = `${startX}px`

        snowflake.classList.add('small')

        if (isInitial) {
            const randomStart = Math.random() * window.innerHeight
            snowflake.style.top = `-${randomStart}px`
        }

        const delay = isInitial ? 0 : Math.random() * 2
        snowflake.style.animationDelay = `${delay}s`

        const drift = (Math.random() - 0.5) * 100
        snowflake.style.setProperty('--drift', `${drift}px`)

        this.container.appendChild(snowflake)

        const duration = 10000
        setTimeout(() => {
            if (snowflake.parentNode) {
                snowflake.remove()
            }
        }, (duration + delay * 1000))
    }

    /**
     * Cleanup when destroying
     */
    destroy() {
        this.stop()
        if (this.container && this.container.parentNode) {
            this.container.remove()
        }
        this.container = null
    }
}

module.exports = new ChristmasSnowflakes()
