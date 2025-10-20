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


const loginOptionsCancelContainer = document.getElementById('loginOptionCancelContainer')
const loginOptionVISoftware = document.getElementById('loginOptionVISoftware')
const loginOptionsCancelButton = document.getElementById('loginOptionCancelButton')
const loginOptionVISWeb = document.getElementById('loginOptionVISWeb')
const loginOptionBackContainer = document.getElementById('loginOptionBackContainer')
const loginOptionBackButton = document.getElementById('loginOptionBackButton')

let loginOptionsCancellable = false
let loginOptionsFromSettings = false

let loginOptionsViewOnLoginSuccess
let loginOptionsViewOnLoginCancel
let loginOptionsViewOnCancel
let loginOptionsViewCancelHandler

function loginOptionsCancelEnabled(val){
    if(val){
        $(loginOptionsCancelContainer).show()
        $(loginOptionBackContainer).hide()
    } else {
        $(loginOptionsCancelContainer).hide()
    }
}

function showLoginOptions(fromSettings = false) {
    loginOptionsFromSettings = fromSettings
    if(fromSettings) {
        $(loginOptionBackContainer).show()
        $(loginOptionsCancelContainer).hide()
    } else {
        $(loginOptionsCancelContainer).show()
        $(loginOptionBackContainer).hide()
    }
    switchView(getCurrentView(), VIEWS.loginOptions, 500, 500)
}
loginOptionVISoftware.onclick = (e) => {
    switchView(getCurrentView(), VIEWS.login, 500, 500, () => {
        loginViewOnSuccess = loginOptionsViewOnLoginSuccess
        loginViewOnCancel = loginOptionsViewOnLoginCancel
        loginCancelEnabled(true)
    })
}

loginOptionVISWeb.onclick = (e) => {
    switchView(getCurrentView(), VIEWS.waiting, 500, 500, () => {
        AuthManager.addVISWebAccount()
            .then((account) => {
                loginViewOnSuccess = loginOptionsViewOnLoginSuccess
                loginViewOnCancel = loginOptionsViewOnLoginCancel
                switchView(VIEWS.waiting, loginViewOnSuccess)
            })
            .catch((err) => {
                switchView(VIEWS.waiting, VIEWS.loginOptions, 500, 500)
                setTimeout(() => {
                    setOverlayContent(
                        err.title || 'Error',
                        err.message || 'An unknown error occurred',
                        'OK'
                    )
                    setOverlayHandler(() => {
                        toggleOverlay(false)
                    })
                    toggleOverlay(true)
                }, 500) // Wait for view transition to complete
            })
    })
}

loginOptionsCancelButton.onclick = (e) => {
    switchView(getCurrentView(), loginOptionsViewOnCancel, 500, 500, () => {
        // Clear login values
        loginUsername.value = ''
        loginPassword.value = ''
        if(loginOptionsViewCancelHandler != null){
            loginOptionsViewCancelHandler()
            loginOptionsViewCancelHandler = null
        }
    })
}

loginOptionBackButton.onclick = (e) => {
    switchView(getCurrentView(), VIEWS.settings, 500, 500, () => {
        loginOptionsFromSettings = false
    })
}