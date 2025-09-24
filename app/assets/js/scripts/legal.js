const { ipcRenderer } = require('electron')
const fs = require('fs')
const path = require('path')

function loadFileOrDefault(relPath, defaultText) {
    const candidates = []
    if (process && process.resourcesPath) {
        candidates.push(path.join(process.resourcesPath, relPath))
        candidates.push(path.join(process.resourcesPath, 'app', relPath))
        candidates.push(path.join(process.resourcesPath, 'app.asar', relPath))
    }

    try {
        candidates.push(path.join(process.cwd(), relPath))
    } catch {
        // ignore if process.cwd() is unavailable for some runtime
    }

    candidates.push(path.join(__dirname, '..', '..', '..', relPath))
    candidates.push(path.join(__dirname, '..', '..', '..', '..', relPath))
    candidates.push(path.join(__dirname, '..', '..', relPath))
    candidates.push(path.join(__dirname, relPath))

    for (const p of candidates) {
        try {
            if (fs.existsSync(p)) {
                const content = fs.readFileSync(p, 'utf-8')
                try {
                    if (process && process.env && process.env.NODE_ENV === 'development') {
                        console.debug('loadFileOrDefault: loaded', relPath, 'from', p, 'size=', content.length)
                    }
                } catch {
                    // ignore logging errors
                }
                return content
            }
        } catch {
            // ignore
        }
    }

    console.warn('Could not find', relPath, 'in candidates:', candidates)
    return defaultText
}

document.addEventListener('DOMContentLoaded', () => {
    const installerEl = document.getElementById('installerLicense')
    installerEl.textContent = loadFileOrDefault('INSTALLER-LICENSE.md', 'No installer license found in application bundle?')

    const acceptBtn = document.getElementById('acceptBtn')

    function markDone(){
        acceptBtn.disabled = false
        installerEl.classList.add('done')
    }

    setTimeout(()=>{
        if(installerEl.scrollHeight <= installerEl.clientHeight + 2){
            markDone()
        }
    }, 100)

    installerEl.addEventListener('scroll', () => {
        const atBottom = (installerEl.scrollTop + installerEl.clientHeight) >= (installerEl.scrollHeight - 2)
        if(atBottom && acceptBtn.disabled){
            markDone()
        }
    })

    document.getElementById('acceptBtn').addEventListener('click', () => {
        ipcRenderer.send('legal-accepted')
    })

    document.getElementById('declineBtn').addEventListener('click', () => {
        ipcRenderer.send('legal-declined')
    })
})
