# Generating Third-Party Licenses

```bash
npm install -g license-checker && license-checker --customPath . --customFormat "{name}, {version}, {licenses}, {repository}, {licenseFile}" --out THIRD-PARTIES-LICENSES.md
```