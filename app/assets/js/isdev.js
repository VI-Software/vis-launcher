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


'use strict'
const getFromEnv = parseInt(process.env.ELECTRON_IS_DEV, 10) === 1
const isEnvSet = 'ELECTRON_IS_DEV' in process.env

module.exports = isEnvSet ? getFromEnv : (process.defaultApp || /node_modules[\\/]electron[\\/]/.test(process.execPath))