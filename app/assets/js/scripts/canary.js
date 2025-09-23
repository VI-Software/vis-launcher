const { ipcRenderer, shell } = require('electron')

window.addEventListener('DOMContentLoaded', () => {
    const acceptBtn = document.getElementById('acceptBtn')
    const declineBtn = document.getElementById('declineBtn')
    const dontAsk = document.getElementById('dontAsk')

    const updateLabel = (rem) => {
        if (rem <= 0) {
            acceptBtn.textContent = 'Accept'
            return
        }
        acceptBtn.textContent = `Accept (${rem})`
    }

    let remaining = 10
    acceptBtn.disabled = true
    updateLabel(remaining)

    const TICK_MS = 1250
    const countdown = setInterval(() => {
        remaining -= 1
        if (remaining <= 0) {
            clearInterval(countdown)
            acceptBtn.disabled = false
            updateLabel(0)
        } else {
            updateLabel(remaining)
        }
    }, TICK_MS)

    acceptBtn.addEventListener('click', () => {
        if (acceptBtn.disabled) return
        ipcRenderer.send('canary-ack', !!dontAsk.checked)
    })

    declineBtn.addEventListener('click', () => {
        ipcRenderer.send('canary-close')
    })

    document.addEventListener('click', (ev) => {
        const a = ev.target.closest && ev.target.closest('a')
        if (a && a.href) {
            ev.preventDefault()
            try { shell.openExternal(a.href) } catch (e) { /* noop */ }
        }
    })
})
