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
const { LoggerUtil }         = require('@visoftware/vis-launcher-core')
const { RestResponseStatus } = require('@visoftware/vis-launcher-core/common')
const { MojangRestAPI, mojangErrorDisplayable, MojangErrorCode } = require('@visoftware/vis-launcher-core/mojang')
const http                   = require('http')
const { shell }              = require('electron')
const { API_BASE_URL, WEBLOGIN_URL, OAUTH_AUTHORIZATION_ENDPOINT, OAUTH_TOKEN_ENDPOINT, OAUTH_USERINFO_ENDPOINT, OAUTH_CLIENT_ID, OAUTH_REDIRECT_URI, OAUTH_SCOPE } = require('./apiconstants')
const got                    = require('got')
const LangLoader             = require('./langloader')
const crypto                 = require('crypto')

const log = LoggerUtil.getLogger('AuthManager')

/**
 * Generate a random string for PKCE code verifier
 * @param {number} length Length of the string (43-128)
 * @returns {string} Random string
 */
exports.generateCodeVerifier = function generateCodeVerifier(length = 64) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
    let result = ''
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
}

/**
 * Generate code challenge from code verifier using S256
 * @param {string} codeVerifier 
 * @returns {string} Base64URL encoded challenge
 */
exports.generateCodeChallenge = function generateCodeChallenge(codeVerifier) {
    const hash = crypto.createHash('sha256').update(codeVerifier).digest()
    return hash.toString('base64url')
}

/**
 * Generate random state for CSRF protection
 * @param {number} length Length of state string
 * @returns {string} Random state
 */
exports.generateState = function generateState(length = 32) {
    return crypto.randomBytes(length).toString('hex')
}

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
        log.error('Error checking challenge validity:', err)
        return false
    }
}

exports.addVISWebAccount = async function() {
    let pollInterval
    let challengeValid = true
    let serverInstance

    const cleanup = () => {
        if (pollInterval) {
            clearInterval(pollInterval)
            pollInterval = null
        }
        if (serverInstance && serverInstance.listening) {
            serverInstance.close()
            serverInstance = null
        }
    }

    try {
        const port = 43123
        let tokenResolve, tokenReject
        const tokenPromise = new Promise((resolve, reject) => {
            tokenResolve = resolve
            tokenReject = reject
        })

        serverInstance = http.createServer((req, res) => {
            const url = new URL(req.url, `http://127.0.0.1:${port}`)
            
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

        serverInstance.listen(port, '127.0.0.1', async () => {
            log.info(`OAuth server listening on port ${port}`)
            
            try {
                const challengeResponse = await got.get(`${API_BASE_URL}/services/launcher/v2/requestchallenge?version=${require('../../../package.json').version}`).json()
                
                if(!challengeResponse || challengeResponse.status !== 'Success') {
                    throw new Error(challengeResponse?.error || 'Failed to get challenge')
                }

                const { challengeId, secret } = challengeResponse
                const authUrl = `${WEBLOGIN_URL}?challenge=${challengeId}`

                shell.openExternal(authUrl)

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

        const token = await tokenPromise
        cleanup()

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

        // Final cleanup of sensitive data
        cleanup()

        return ret

    } catch (err) {
        cleanup()
        log.error('Error during VI Software Web OAuth:', err)

        try {
            if (err && err.name === 'HTTPError' && err.response && err.response.statusCode === 429) {
                const title = LangLoader.queryJS('auth.visweb.tooManyRequestsTitle')
                const message = LangLoader.queryJS('auth.visweb.tooManyRequestsMessage')
                const action = LangLoader.queryJS('auth.visweb.tooManyRequestsAction')

                return Promise.reject({
                    title,
                    message: `${message}`,
                    action
                })
            }
        } catch (langErr) {
            // If localization fails, fall through to generic message
            log.error('Error while querying localization for VIS Web OAuth 429 message:', langErr)
        }

        return Promise.reject({
            title: 'Login Failed',
            message: err.message === 'Challenge expired'
                ? 'Authentication timeout. Please try again.'
                : 'Failed to authenticate with VI Software. Please try again.'
        })
    }
}

/**
 * Add a VI Software Web account using the OAuth v3 flow.
 * This is a proper OAuth implementation replacing the challenge-based v2 system.
 * 
 * @returns {Promise.<Object>}
 */
exports.addVISWebAccountV3 = async function() {
    let pollInterval
    let serverInstance
    let expectedState
    let codeVerifier
    let codeChallenge
    let tokenResponse
    let userInfo

    const cleanup = () => {
        if (pollInterval) {
            clearInterval(pollInterval)
            pollInterval = null
        }
        if (serverInstance && serverInstance.listening) {
            serverInstance.close()
            serverInstance = null
        }
        if (codeVerifier) codeVerifier = null
        if (codeChallenge) codeChallenge = null
        if (expectedState) expectedState = null
        if (tokenResponse) tokenResponse = null
        if (userInfo) userInfo = null
    }

    try {
        const port = 43124
        let codeResolve, codeReject
        const codePromise = new Promise((resolve, reject) => {
            codeResolve = resolve
            codeReject = reject
        })

        codeVerifier = exports.generateCodeVerifier()
        codeChallenge = exports.generateCodeChallenge(codeVerifier)
        expectedState = exports.generateState()

        const authUrl = new URL(OAUTH_AUTHORIZATION_ENDPOINT)
        authUrl.searchParams.set('client_id', OAUTH_CLIENT_ID)
        authUrl.searchParams.set('redirect_uri', OAUTH_REDIRECT_URI)
        authUrl.searchParams.set('response_type', 'code')
        authUrl.searchParams.set('scope', OAUTH_SCOPE)
        authUrl.searchParams.set('state', expectedState)
        authUrl.searchParams.set('code_challenge', codeChallenge)
        authUrl.searchParams.set('code_challenge_method', 'S256')

        serverInstance = http.createServer((req, res) => {
            const url = new URL(req.url, `http://127.0.0.1:${port}`)
            
            if (url.pathname === '/callback') {
                const code = url.searchParams.get('code')
                const state = url.searchParams.get('state')
                const error = url.searchParams.get('error')
                
                if (error) {
                    res.writeHead(400, { 'Content-Type': 'text/html' })
                    res.end('<html><body style="background-color:#333;color:#fff;"><h1>Authentication failed</h1><p>Please close this window and try again.</p></body></html>')
                    serverInstance.close()
                    codeReject(new Error(`OAuth error: ${error}`))
                    return
                }
                
                if (state !== expectedState) {
                    res.writeHead(400, { 'Content-Type': 'text/html' })
                    res.end('<html><body style="background-color:#333;color:#fff;"><h1>Authentication failed</h1><p>Invalid state parameter.</p></body></html>')
                    serverInstance.close()
                    codeReject(new Error('State parameter mismatch'))
                    return
                }
                
                if (code) {
                    res.writeHead(200, { 'Content-Type': 'text/html' })
                    res.end('<html><body style="background-color:#333;color:#fff;"><h1>Authorization successful!</h1><p>You may now close this window.</p></body></html>')
                    serverInstance.close()
                    codeResolve(code)
                } else {
                    res.writeHead(400, { 'Content-Type': 'text/html' })
                    res.end('<html><body style="background-color:#333;color:#fff;"><h1>Authentication failed</h1><p>No authorization code received.</p></body></html>')
                    serverInstance.close()
                    codeReject(new Error('No authorization code received'))
                }
            }
        })

        // Callback server error handling
        serverInstance.on('error', (err) => {
            cleanup()
            codeReject(err)
        })

        serverInstance.listen(port, '127.0.0.1', async () => {
            log.info(`OAuth v3 server listening on port ${port}`)
            
            shell.openExternal(authUrl.toString())

            pollInterval = setTimeout(() => {
                cleanup()
                codeReject(new Error('Authentication timeout'))
            }, 15 * 60 * 1000) // 15 minutes
        })

        const code = await codePromise
        cleanup()

        tokenResponse = await got.post(OAUTH_TOKEN_ENDPOINT, {
            form: {
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: OAUTH_REDIRECT_URI,
                client_id: OAUTH_CLIENT_ID,
                code_verifier: codeVerifier
            }
        }).json()

        if (!tokenResponse.access_token) {
            throw new Error('No access token received')
        }

        userInfo = await got.get(OAUTH_USERINFO_ENDPOINT, {
            headers: {
                'authorization': `Bearer ${tokenResponse.access_token}`,
                'X-Launcher-Version': require('../../../package.json').version
            }
        }).json()

        if (!userInfo.minecraft || !Array.isArray(userInfo.minecraft) || userInfo.minecraft.length !== 1) {
            console.log('Full userInfo:', userInfo)
            throw new Error('Invalid user info received. Expected exactly one Minecraft account, but got ' + (userInfo.minecraft ? userInfo.minecraft.length : 'none'))
        }

        const selectedAccount = userInfo.minecraft[0]

        if (!selectedAccount.username || !selectedAccount.login) {
            throw new Error('Backend must provide Minecraft username and login credentials')
        }

        let ret
        try {
            const mojangUsername = selectedAccount.username
            const mojangPassword = selectedAccount.login
            
            log.debug(`Attempting Ydrassl auth with username: ${mojangUsername}`)
            ret = await addMojangAccount(mojangUsername, mojangPassword)
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

        // Final cleanup of sensitive data
        cleanup()

        return ret

    } catch (err) {
        cleanup()
        log.error('Error during VI Software Web OAuth v3:', err)

        try {
            if (err && err.name === 'HTTPError' && err.response && err.response.statusCode === 429) {
                const title = LangLoader.queryJS('auth.visweb.tooManyRequestsTitle')
                const message = LangLoader.queryJS('auth.visweb.tooManyRequestsMessage')
                const action = LangLoader.queryJS('auth.visweb.tooManyRequestsAction')

                return Promise.reject({
                    title,
                    message: `${message}`,
                    action
                })
            }
        } catch (langErr) {
            // If localization fails, fall through to generic message
            log.error('Error while querying localization for VIS Web OAuth v3 429 message:', langErr)
        }

        return Promise.reject({
            title: 'Login Failed',
            message: err.message === 'Authentication timeout'
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
 * Validate the selected auth account.
 * 
 * @returns {Promise.<boolean>} Promise which resolves to true if the access token is valid,
 * otherwise false.
 */
exports.validateSelected = async function(){
    return await validateSelectedMojangAccount()
}
