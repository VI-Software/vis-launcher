const { ipcRenderer } = require('electron')
const fs = require('fs')
const path = require('path')

function loadFileOrDefault(relPath, defaultText) {
    const candidates = []
    candidates.push(path.join(__dirname, '..', '..', '..', relPath))
    candidates.push(path.join(__dirname, '..', '..', relPath))
    candidates.push(path.join(__dirname, relPath))
    if (process.resourcesPath) {
        candidates.push(path.join(process.resourcesPath, relPath))
        candidates.push(path.join(process.resourcesPath, 'app', relPath))
    }

    for (const p of candidates) {
        try {
            if (fs.existsSync(p)) {
                return fs.readFileSync(p, 'utf-8')
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
