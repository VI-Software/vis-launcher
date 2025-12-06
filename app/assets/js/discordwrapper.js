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

const Lang = require('./langloader')

/**
 * Initialize Discord Rich Presence via the main process.
 * The actual RPC client runs in the main process to avoid renderer limitations.
 */
exports.initRPC = function(genSettings, servSettings, initialDetails = Lang.queryJS('discord.waiting')){
    ipcRenderer.send('discord-rpc-init', {
        genSettings,
        servSettings,
        initialDetails,
        state: Lang.queryJS('discord.state', {shortId: servSettings.shortId})
    })
}

/**
 * Update the Rich Presence details.
 */
exports.updateDetails = function(details){
    ipcRenderer.send('discord-rpc-update-details', details)
}

/**
 * Shutdown Discord Rich Presence.
 */
exports.shutdownRPC = function(){
    ipcRenderer.send('discord-rpc-shutdown')
}