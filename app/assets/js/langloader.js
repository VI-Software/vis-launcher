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


const fs = require('fs-extra')
const path = require('path')
const toml = require('toml')
const merge = require('lodash.merge')
const os = require('os')
const { log } = require('console')

let lang

const SUPPORTED_LANGUAGES = {
    'en-US': { id: 'en_US', name: 'English (US)' },
    'es-ES': { id: 'es_ES', name: 'Español (España)' },
    'pt_PT': { id: 'pt_PT', name: 'Português (Portugal)' },
    'ca_ES': { id: 'ca_ES', name: 'Català (Espanya)' }
}

exports.loadLanguage = function(id){
    try {
        lang = merge(lang || {}, toml.parse(fs.readFileSync(path.join(__dirname, '..', 'lang', `${id}.toml`))) || {})
    } catch (error) {
        console.error(`Failed to load language file: ${id}`, error)
    }
}

exports.query = function(id, placeHolders){
    let query = id.split('.')
    let res = lang
    
    for(let q of query){
        res = res[q]
    }
    // Ensure we always work with a string to avoid errors when a key is missing
    let text = (typeof res === 'string') ? res : ''
    if (placeHolders) {
        Object.entries(placeHolders).forEach(([key, value]) => {
            // replace all occurrences of the placeholder
            text = text.split(`{${key}}`).join(String(value))
        })
    }
    return text
}

exports.queryJS = function(id, placeHolders){
    return exports.query(`js.${id}`, placeHolders)
}

exports.queryEJS = function(id, placeHolders){
    return exports.query(`ejs.${id}`, placeHolders)
}

exports.getLanguageOverride = function() {
    const overridePath = path.join(exports.getLauncherDirectory(), 'langoverwrite.json')
    try {
        if (fs.existsSync(overridePath)) {
            const data = fs.readFileSync(overridePath, 'utf8')
            const override = JSON.parse(data)
            if (override && override.language) {
                return override.language
            }
        }
    } catch (error) {
        console.error('Error reading language override file:', error)
    }
    return null
}

exports.setLanguageOverride = function(language) {
    if (!language) return false
    
    const supportedIDs = Object.values(SUPPORTED_LANGUAGES)
        .map(lang => lang.id)
        .filter((id, index, self) => self.indexOf(id) === index)
    
    let isSupported = supportedIDs.includes(language)
    if (!isSupported) {
        console.error(`Attempted to set unsupported language: ${language}`)
        return false
    }
    
    const launcherDir = exports.getLauncherDirectory()
    
    try {
        if (!fs.existsSync(launcherDir)) {
            fs.mkdirSync(launcherDir, { recursive: true })
            console.log(`Created launcher directory at: ${launcherDir}`)
        }
        
        const overridePath = path.join(launcherDir, 'langoverwrite.json')
        fs.writeFileSync(overridePath, JSON.stringify({ language }), 'utf8')
        console.log(`Set language override to: ${language}, saved at: ${overridePath}`)
        return true
    } catch (error) {
        console.error('Error writing language override file:', error)
        console.error(error.stack)
        return false
    }
}

exports.getLauncherDirectory = function() {
    try {
        const { app } = process.type === 'browser' 
            ? require('electron') 
            : require('@electron/remote') || require('electron').remote
            
        return app.getPath('userData')
    } catch {
        log.warn('Electron app path not accessible, using home directory for launcher data.')
        return path.join(os.homedir(), '.vis-launcher')
    }
}

exports.getSupportedLanguages = function() {
    const result = {}
    Object.values(SUPPORTED_LANGUAGES)
        .forEach(lang => {
            result[lang.id] = lang.name
        })
    
    return result
}

exports.setupLanguage = function(systemLocale){
    let langToUse = 'en_US' // fallback
    
    const override = exports.getLanguageOverride()
    if (override) {
        langToUse = override
    } else if (systemLocale) {
        if (SUPPORTED_LANGUAGES[systemLocale]) {
            langToUse = SUPPORTED_LANGUAGES[systemLocale].id
        } else {
            // Try to match just the language part (e.g. "en-GB" -> "en")
            const baseLang = systemLocale.split(/[-_]/)[0]
            if (SUPPORTED_LANGUAGES[baseLang]) {
                langToUse = SUPPORTED_LANGUAGES[baseLang].id
            }
        }
    }
    
    try {
        const langPath = path.join(__dirname, '..', 'lang', `${langToUse}.toml`)
        if (!fs.existsSync(langPath)) {
            console.warn(`Language file ${langToUse}.toml not found, falling back to es_ES`)
            langToUse = 'es_ES'
        }
    } catch (error) {
        console.error('Error checking language file:', error)
        langToUse = 'es_ES'
    }
    
    exports.loadLanguage(langToUse)

    exports.loadLanguage('settings')
}