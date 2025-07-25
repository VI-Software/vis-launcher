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


/**
 * AuthManager
 * 
 * This module aims to abstract login procedures. Results from Mojang's REST api
 * are retrieved through our Mojang module. These results are processed and stored,
 * if applicable, in the config using the ConfigManager. All login procedures should
 * be made through this module.
 * 
 * @module authmanager
 */
// Requirements
const ConfigManager          = require('./configmanager')
const { LoggerUtil }         = require('vis-launcher-core')
const { RestResponseStatus } = require('vis-launcher-core/common')
const { MojangRestAPI, mojangErrorDisplayable, MojangErrorCode } = require('vis-launcher-core/mojang')
const { MicrosoftAuth, microsoftErrorDisplayable, MicrosoftErrorCode } = require('vis-launcher-core/microsoft')
const { AZURE_CLIENT_ID }    = require('./ipcconstants')
const http                   = require('http')
const { shell }              = require('electron')
const { API_BASE_URL, WEBLOGIN_URL } = require('./apiconstants')
const got                    = require('got')

const log = LoggerUtil.getLogger('AuthManager')

// Functions

/**
 * Add a Mojang account. This will authenticate the given credentials with Mojang's
 * authserver. The resultant data will be stored as an auth account in the
 * configuration database.
 * 
 * @param {string} username The account username (email if migrated).
 * @param {string} password The account password.
 * @returns {Promise.<Object>} Promise which resolves the resolved authenticated account object.
 */
const addMojangAccount = async function(username, password) {
    try {
        const response = await MojangRestAPI.authenticate(username, password, ConfigManager.getClientToken())
        if(response.responseStatus === RestResponseStatus.SUCCESS) {

            const session = response.data
            if(session.selectedProfile != null){
                const ret = ConfigManager.addMojangAuthAccount(session.selectedProfile.id, session.accessToken, username, session.selectedProfile.name)
                if(ConfigManager.getClientToken() == null){
                    ConfigManager.setClientToken(session.clientToken)
                }
                ConfigManager.save()
                return ret
            } else {
                return Promise.reject(mojangErrorDisplayable(MojangErrorCode.ERROR_NOT_PAID))
            }

        } else {
            return Promise.reject(mojangErrorDisplayable(response.mojangErrorCode))
        }
        
    } catch (err){
        log.error(err)
        return Promise.reject(mojangErrorDisplayable(MojangErrorCode.UNKNOWN))
    }
}

exports.addMojangAccount = addMojangAccount

const AUTH_MODE = { FULL: 0, MS_REFRESH: 1, MC_REFRESH: 2 }

/**
 * Perform the full MS Auth flow in a given mode.
 * 
 * AUTH_MODE.FULL = Full authorization for a new account.
 * AUTH_MODE.MS_REFRESH = Full refresh authorization.
 * AUTH_MODE.MC_REFRESH = Refresh of the MC token, reusing the MS token.
 * 
 * @param {string} entryCode FULL-AuthCode. MS_REFRESH=refreshToken, MC_REFRESH=accessToken
 * @param {*} authMode The auth mode.
 * @returns An object with all auth data. AccessToken object will be null when mode is MC_REFRESH.
 */
async function fullMicrosoftAuthFlow(entryCode, authMode) {
    try {

        let accessTokenRaw
        let accessToken
        if(authMode !== AUTH_MODE.MC_REFRESH) {
            const accessTokenResponse = await MicrosoftAuth.getAccessToken(entryCode, authMode === AUTH_MODE.MS_REFRESH, AZURE_CLIENT_ID)
            if(accessTokenResponse.responseStatus === RestResponseStatus.ERROR) {
                return Promise.reject(microsoftErrorDisplayable(accessTokenResponse.microsoftErrorCode))
            }
            accessToken = accessTokenResponse.data
            accessTokenRaw = accessToken.access_token
        } else {
            accessTokenRaw = entryCode
        }
        
        const xblResponse = await MicrosoftAuth.getXBLToken(accessTokenRaw)
        if(xblResponse.responseStatus === RestResponseStatus.ERROR) {
            return Promise.reject(microsoftErrorDisplayable(xblResponse.microsoftErrorCode))
        }
        const xstsResonse = await MicrosoftAuth.getXSTSToken(xblResponse.data)
        if(xstsResonse.responseStatus === RestResponseStatus.ERROR) {
            return Promise.reject(microsoftErrorDisplayable(xstsResonse.microsoftErrorCode))
        }
        const mcTokenResponse = await MicrosoftAuth.getMCAccessToken(xstsResonse.data)
        if(mcTokenResponse.responseStatus === RestResponseStatus.ERROR) {
            return Promise.reject(microsoftErrorDisplayable(mcTokenResponse.microsoftErrorCode))
        }
        const mcProfileResponse = await MicrosoftAuth.getMCProfile(mcTokenResponse.data.access_token)
        if(mcProfileResponse.responseStatus === RestResponseStatus.ERROR) {
            return Promise.reject(microsoftErrorDisplayable(mcProfileResponse.microsoftErrorCode))
        }
        return {
            accessToken,
            accessTokenRaw,
            xbl: xblResponse.data,
            xsts: xstsResonse.data,
            mcToken: mcTokenResponse.data,
            mcProfile: mcProfileResponse.data
        }
    } catch(err) {
        log.error(err)
        return Promise.reject(microsoftErrorDisplayable(MicrosoftErrorCode.UNKNOWN))
    }
}

/**
 * Calculate the expiry date. Advance the expiry time by 10 seconds
 * to reduce the liklihood of working with an expired token.
 * 
 * @param {number} nowMs Current time milliseconds.
 * @param {number} epiresInS Expires in (seconds)
 * @returns 
 */
function calculateExpiryDate(nowMs, epiresInS) {
    return nowMs + ((epiresInS-10)*1000)
}

/**
 * Add a Microsoft account. This will pass the provided auth code to Mojang's OAuth2.0 flow.
 * The resultant data will be stored as an auth account in the configuration database.
 * 
 * @param {string} authCode The authCode obtained from microsoft.
 * @returns {Promise.<Object>} Promise which resolves the resolved authenticated account object.
 */
exports.addMicrosoftAccount = async function(authCode) {

    const fullAuth = await fullMicrosoftAuthFlow(authCode, AUTH_MODE.FULL)

    // Advance expiry by 10 seconds to avoid close calls.
    const now = new Date().getTime()

    const ret = ConfigManager.addMicrosoftAuthAccount(
        fullAuth.mcProfile.id,
        fullAuth.mcToken.access_token,
        fullAuth.mcProfile.name,
        calculateExpiryDate(now, fullAuth.mcToken.expires_in),
        fullAuth.accessToken.access_token,
        fullAuth.accessToken.refresh_token,
        calculateExpiryDate(now, fullAuth.accessToken.expires_in)
    )
    ConfigManager.save()

    return ret
}

/**
 * Check if a challenge is still valid
 * @param {string} challengeId The challenge ID to check
 * @param {string} secret The challenge secret
 * @returns {Promise<boolean>} True if challenge is still valid
 */
async function checkChallenge(challengeId, secret) {
    try {
        const response = await got.get(`${API_BASE_URL}/services/launcher/v2/viewchallenge?id=${challengeId}`, {
            headers: {
                'secret': secret
            }
        }).json()

        if(response.status === 'Success') {
            const expiryDate = new Date(response.challenge.expiry_date)
            return new Date() < expiryDate
        }
        return false
    } catch (err) {
        return false
    }
}

/**
 * Create a temporary web server to handle the OAuth callback
 */
function createOAuthServer(port) {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            const url = new URL(req.url, `http://localhost:${port}`)
            
            if (url.pathname === '/callback') {
                const token = url.searchParams.get('token')
                if (token) {
                    res.writeHead(200, { 'Content-Type': 'text/html' })
                    res.end('<html><body style="background-color:#333;color:#fff;"><h1>Authorization successful!</h1><p>You may now close this window now.</p></body></html>')
                    server.close()
                    resolve({ token, server }) 
                } else {
                    server.close()
                    reject(new Error('No token received'))
                }
            }
        })

        server.listen(port, 'localhost', () => {
            log.info(`OAuth server listening on port ${port}`)
        })

        server.on('error', (err) => {
            reject(err)
        })

        // Return server instance so it can be cleaned up if needed
        return server
    })
}

exports.addVISWebAccount = async function() {
    let pollInterval
    let challengeValid = true
    let serverInstance

    const cleanup = () => {
        if (pollInterval) {
            clearInterval(pollInterval)
        }
        if (serverInstance && serverInstance.listening) {
            serverInstance.close()
        }
    }

    try {
        const port = 43123
        let tokenResolve, tokenReject
        const tokenPromise = new Promise((resolve, reject) => {
            tokenResolve = resolve
            tokenReject = reject
        })

        // Create server first
        serverInstance = http.createServer((req, res) => {
            const url = new URL(req.url, `http://localhost:${port}`)
            
            if (url.pathname === '/callback') {
                const token = url.searchParams.get('token')
                if (token && challengeValid) {
                    res.writeHead(200, { 'Content-Type': 'text/html' })
                    res.end('<html><body style="background-color:#333;color:#fff;"><h1>Authorization successful!</h1><p>You may now close this window.</p></body></html>')
                    serverInstance.close()
                    tokenResolve(token)
                } else {
                    res.writeHead(400, { 'Content-Type': 'text/html' })
                    res.end('<html><body style="background-color:#333;color:#fff;"><h1>Authentication failed</h1><p>Please close this window and try again.</p></body></html>')
                    serverInstance.close()
                    tokenReject(new Error('Invalid token received'))
                }
            }
        })

        // Handle server errors
        serverInstance.on('error', (err) => {
            cleanup()
            tokenReject(err)
        })

        // Start listening
        serverInstance.listen(port, 'localhost', async () => {
            log.info(`OAuth server listening on port ${port}`)
            
            try {
                // Get challenge after server is ready
                const challengeResponse = await got.get(`${API_BASE_URL}/services/launcher/v2/requestchallenge?version=${require('../../../package.json').version}`).json()
                
                if(!challengeResponse || challengeResponse.status !== 'Success') {
                    throw new Error(challengeResponse?.error || 'Failed to get challenge')
                }

                const { challengeId, secret } = challengeResponse
                const authUrl = `${WEBLOGIN_URL}?challenge=${challengeId}`

                // Open browser after everything is ready
                shell.openExternal(authUrl)

                // Start polling
                pollInterval = setInterval(async () => {
                    const isValid = await checkChallenge(challengeId, secret)
                    if (!isValid && challengeValid) {
                        challengeValid = false
                        cleanup()
                        tokenReject(new Error('Challenge expired'))
                    }
                }, 30000)

            } catch (err) {
                cleanup()
                tokenReject(err)
            }
        })

        // Wait for authentication
        const token = await tokenPromise
        cleanup()

        // Rest of the function remains the same...
        const accountInfo = await got.get(`${API_BASE_URL}/services/launcher/v2/whoami`, {
            headers: {
                'authorization': token
            }
        }).json()

        if (!accountInfo?.data) {
            throw new Error('Invalid account data received')
        }

        let ret
        try {
            ret = await addMojangAccount(accountInfo.data.username, accountInfo.data.login)
        } catch (err) {
            cleanup()
            log.error('Error adding Mojang account:', err)
            return Promise.reject({
                title: 'Login Failed',
                message: err && err.message ? err.message : 'Failed to add account. Please try again.'
            })
        }
        
        if(ConfigManager.getClientToken() == null) {
            ConfigManager.setClientToken(uuidv4())
        }
        
        ConfigManager.save()

        updateSelectedAccount(ret)
        await prepareSettings(true)
        
        await ConfigManager.getSelectedAccount() // It also refreshes CDN authentification to the new account

        return ret

    } catch (err) {
        cleanup()
        log.error('Error during VI Software Web OAuth:', err)
        return Promise.reject({
            title: 'Login Failed',
            message: err.message === 'Challenge expired' 
                ? 'Authentication timeout. Please try again.' 
                : 'Failed to authenticate with VI Software. Please try again.'
        })
    }
}

/**
 * Remove a Mojang account. This will invalidate the access token associated
 * with the account and then remove it from the database.
 * 
 * @param {string} uuid The UUID of the account to be removed.
 * @returns {Promise.<void>} Promise which resolves to void when the action is complete.
 */
exports.removeMojangAccount = async function(uuid){
    try {
        const authAcc = ConfigManager.getAuthAccount(uuid)
        const response = await MojangRestAPI.invalidate(authAcc.accessToken, ConfigManager.getClientToken())
        if(response.responseStatus === RestResponseStatus.SUCCESS) {
            ConfigManager.removeAuthAccount(uuid)
            ConfigManager.save()
            return Promise.resolve()
        } else {
            log.error('Error while removing account', response.error)
            return Promise.reject(response.error)
        }
    } catch (err){
        log.error('Error while removing account', err)
        return Promise.reject(err)
    }
}

/**
 * Remove a Microsoft account. It is expected that the caller will invoke the OAuth logout
 * through the ipc renderer.
 * 
 * @param {string} uuid The UUID of the account to be removed.
 * @returns {Promise.<void>} Promise which resolves to void when the action is complete.
 */
exports.removeMicrosoftAccount = async function(uuid){
    try {
        ConfigManager.removeAuthAccount(uuid)
        ConfigManager.save()
        return Promise.resolve()
    } catch (err){
        log.error('Error while removing account', err)
        return Promise.reject(err)
    }
}

/**
 * Validate the selected account with Mojang's authserver. If the account is not valid,
 * we will attempt to refresh the access token and update that value. If that fails, a
 * new login will be required.
 * 
 * @returns {Promise.<boolean>} Promise which resolves to true if the access token is valid,
 * otherwise false.
 */
async function validateSelectedMojangAccount(){
    const current = ConfigManager.getSelectedAccount()
    const response = await MojangRestAPI.validate(current.accessToken, ConfigManager.getClientToken())

    if(response.responseStatus === RestResponseStatus.SUCCESS) {
        const isValid = response.data
        if(!isValid){
            const refreshResponse = await MojangRestAPI.refresh(current.accessToken, ConfigManager.getClientToken())
            if(refreshResponse.responseStatus === RestResponseStatus.SUCCESS) {
                const session = refreshResponse.data
                ConfigManager.updateMojangAuthAccount(current.uuid, session.accessToken)
                ConfigManager.save()
            } else {
                log.error('Error while validating selected profile:', refreshResponse.error)
                log.info('Account access token is invalid.')
                return false
            }
            log.info('Account access token validated.')
            return true
        } else {
            log.info('Account access token validated.')
            return true
        }
    }
    
}

/**
 * Validate the selected account with Microsoft's authserver. If the account is not valid,
 * we will attempt to refresh the access token and update that value. If that fails, a
 * new login will be required.
 * 
 * @returns {Promise.<boolean>} Promise which resolves to true if the access token is valid,
 * otherwise false.
 */
async function validateSelectedMicrosoftAccount(){
    const current = ConfigManager.getSelectedAccount()
    const now = new Date().getTime()
    const mcExpiresAt = current.expiresAt
    const mcExpired = now >= mcExpiresAt

    if(!mcExpired) {
        return true
    }

    // MC token expired. Check MS token.

    const msExpiresAt = current.microsoft.expires_at
    const msExpired = now >= msExpiresAt

    if(msExpired) {
        // MS expired, do full refresh.
        try {
            const res = await fullMicrosoftAuthFlow(current.microsoft.refresh_token, AUTH_MODE.MS_REFRESH)

            ConfigManager.updateMicrosoftAuthAccount(
                current.uuid,
                res.mcToken.access_token,
                res.accessToken.access_token,
                res.accessToken.refresh_token,
                calculateExpiryDate(now, res.accessToken.expires_in),
                calculateExpiryDate(now, res.mcToken.expires_in)
            )
            ConfigManager.save()
            return true
        } catch(err) {
            return false
        }
    } else {
        // Only MC expired, use existing MS token.
        try {
            const res = await fullMicrosoftAuthFlow(current.microsoft.access_token, AUTH_MODE.MC_REFRESH)

            ConfigManager.updateMicrosoftAuthAccount(
                current.uuid,
                res.mcToken.access_token,
                current.microsoft.access_token,
                current.microsoft.refresh_token,
                current.microsoft.expires_at,
                calculateExpiryDate(now, res.mcToken.expires_in)
            )
            ConfigManager.save()
            return true
        }
        catch(err) {
            return false
        }
    }
}

/**
 * Validate the selected auth account.
 * 
 * @returns {Promise.<boolean>} Promise which resolves to true if the access token is valid,
 * otherwise false.
 */
exports.validateSelected = async function(){
    const current = ConfigManager.getSelectedAccount()

    if(current.type === 'microsoft') {
        return await validateSelectedMicrosoftAccount()
    } else {
        return await validateSelectedMojangAccount()
    }
    
}
