const fs = require('fs')

const input = fs.readFileSync(0, 'utf-8')
const data = JSON.parse(input)

let md = ''

for (const [key, value] of Object.entries(data)) {
    md += `## ${key}\n\n`
    md += `- **Repository:** ${value.repository}\n`
    md += `- **Licenses:** ${Array.isArray(value.licenses) ? value.licenses.join(', ') : value.licenses}\n\n`
    let licenseContent = value.licenseText || 'License text not available'
    if (!value.licenseText && value.licenseFile && fs.existsSync(value.licenseFile)) {
        licenseContent = fs.readFileSync(value.licenseFile, 'utf-8')
    }
    md += '```\n'
    md += licenseContent
    md += '\n```\n\n---\n\n'
}

fs.writeFileSync('THIRD-PARTIES-LICENSES.md', md)