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
const loginOptionGuest = document.getElementById('loginOptionGuest')
const guestModeButtonContainer = document.getElementById('guestModeButtonContainer')
const guestModeDivider = document.getElementById('guestModeDivider')

let loginOptionsCancellable = false
let loginOptionsFromSettings = false

let loginOptionsViewOnLoginSuccess
let loginOptionsViewOnLoginCancel
let loginOptionsViewOnCancel
let loginOptionsViewCancelHandler

/**
 * Initialize guest mode UI visibility based on feature flag.
 */
function initGuestModeUI() {
    const guestModeEnabled = ConfigManager.isGuestModeFeatureEnabled()
    if (guestModeButtonContainer) {
        guestModeButtonContainer.style.display = guestModeEnabled ? 'block' : 'none'
    }
    if (guestModeDivider) {
        guestModeDivider.style.display = guestModeEnabled ? 'flex' : 'none'
    }
}

initGuestModeUI()

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
        AuthManager.addVISWebAccountV3()
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

loginOptionGuest.onclick = (e) => {
    const started = ConfigManager.startGuestMode()
    if (!started) {
        setOverlayContent(
            Lang.queryJS('guestMode.disabledTitle'),
            Lang.queryJS('guestMode.disabledMessage'),
            'OK'
        )
        setOverlayHandler(() => {
            toggleOverlay(false)
        })
        toggleOverlay(true)
        return
    }
    
    updateGuestModeUI()
    
    switchView(getCurrentView(), VIEWS.landing, 500, 500, () => {
        showGuestModeBanner()
    })
}

/**
 * Update the UI elements for guest mode.
 * Called when entering guest mode.
 */
function updateGuestModeUI() {
    const userText = document.getElementById('user_text')
    if (userText) {
        userText.innerHTML = Lang.queryJS('guestMode.guestUser')
    }
    
    const avatarContainer = document.getElementById('avatarContainer')
    if (avatarContainer) {
        avatarContainer.style.backgroundImage = 'url("https://skins.visoftware.dev/2d/skin/VI_Software/head?scale=5")'
        avatarContainer.classList.add('guest-avatar')
    }
    
    const landingContainer = document.getElementById('landingContainer')
    if (landingContainer) {
        landingContainer.classList.add('guest-mode')
    }
}

/**
 * Show the guest mode banner.
 */
function showGuestModeBanner() {
    const banner = document.getElementById('guestModeBanner')
    if (banner) {
        banner.style.display = 'flex'
    }
}

/**
 * Hide the guest mode banner.
 */
function hideGuestModeBanner() {
    const banner = document.getElementById('guestModeBanner')
    if (banner) {
        banner.style.display = 'none'
    }
}