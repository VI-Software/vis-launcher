/*
    ____   ____.___    _________       _____  __                                 
\   \ /   /|   |  /   _____/ _____/ ____\/  |___  _  _______ _______   ____  
 \   Y   / |   |  \_____  \ /  _ \   __\\   __\ \/ \/ /\__  \\_  __ \_/ __ \ 
  \     /  |   |  /        (  <_> )  |   |  |  \     /  / __ \|  | \/\  ___/ 
   \___/   |___| /_______  /\____/|__|   \/\_/  (____  /__|    \___  >
                         \/                                 \/            \/ 
                         
                         
    © 2025 VI Software. Todos los derechos reservados.
    
    GitHub: https://github.com/VI-Software
    Documentación: https://docs.visoftware.dev/vi-software/vis-launcher
    Web: https://visoftware.dev
    Licencia del proyecto: https://github.com/VI-Software/vis-launcher/blob/main/LICENSE

*/


const loginOptionsCancelContainer = document.getElementById('loginOptionCancelContainer')
const loginOptionVISoftware = document.getElementById('loginOptionVISoftware')
const loginOptionsCancelButton = document.getElementById('loginOptionCancelButton')
const loginOptionVISWeb = document.getElementById('loginOptionVISWeb')

let loginOptionsCancellable = false

let loginOptionsViewOnLoginSuccess
let loginOptionsViewOnLoginCancel
let loginOptionsViewOnCancel
let loginOptionsViewCancelHandler

function loginOptionsCancelEnabled(val){
    if(val){
        $(loginOptionsCancelContainer).show()
    } else {
        $(loginOptionsCancelContainer).hide()
    }
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
        // Clear login values (Mojang login)
        // No cleanup needed for Microsoft.
        loginUsername.value = ''
        loginPassword.value = ''
        if(loginOptionsViewCancelHandler != null){
            loginOptionsViewCancelHandler()
            loginOptionsViewCancelHandler = null
        }
    })
}