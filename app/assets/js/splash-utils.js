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

function sendSplashProgress(percent, message){
    try {
        ipcRenderer.send('splash-progress', { percent: Math.max(0, Math.min(100, percent)), message })
    } catch { void 0 }
}

function sendSplashMessage(message){
    try { ipcRenderer.send('splash-message', message) } catch { void 0 }
}

function sendSplashDone(ok){
    try { ipcRenderer.send('splash-done') } catch { void 0 }
    try { ipcRenderer.send('distributionIndexDone', !!ok) } catch { void 0 }
}

module.exports = {
    sendSplashProgress,
    sendSplashMessage,
    sendSplashDone
}
