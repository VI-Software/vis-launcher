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
