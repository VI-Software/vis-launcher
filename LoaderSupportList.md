# Loader Support List

This document outlines the version support for this specific launcher release.

## Officially Minecraft Supported Versions

- 🟢 Supported  
- 🟡 Minimal support  
- 🟠 The game launches but is not supported officially. It might be supported by community members.
- 🔴 Not supported

> **Note:** If a specific sub-version is not listed (e.g., `1.20.3`), it inherits the status from its major version group (e.g., `1.20.X`). Only explicitly listed versions differ in status from their general version line.

| Version    | Status |
|------------|--------|
| 26.1.1     | 🟢     |
| 26.X       | 🟠     |
| 1.21.1     | 🟢     |
| 1.21.X     | 🟠     |
| 1.20.1     | 🟢     |
| 1.20.X     | 🟠     |
| 1.19.2     | 🟢     |
| 1.19.X     | 🟠     |
| 1.18.2     | 🟢     |
| 1.18.X     | 🟠     |
| 1.17.1     | 🟠     |
| 1.17.X     | 🟠     |
| 1.16.5     | 🟢     |
| 1.16.X     | 🟠     |
| 1.15.X     | 🟠     |
| 1.14.X     | 🟠     |
| 1.13.X     | 🟠     |
| 1.12.2     | 🟢     |
| 1.12.X     | 🟠     |
| 1.11.X     | 🟠     |
| 1.10.X     | 🟠     |
| 1.9.X      | 🟠     |
| 1.8.X      | 🟠     |
| 1.7.10     | 🟡     |
| 1.6.X      | 🟠     |
| 1.5.X      | 🟠     |
| 1.4.X      | 🟠     |
| 1.3.X      | 🟠     |
| 1.2.X      | 🟠     |
| 1.1        | 🟠     |
| 1.0        | 🟠     |
| Beta 1.8   | 🔴     |
| Beta 1.7   | 🔴     |
| Beta 1.6   | 🔴     |
| Beta 1.5   | 🔴     |

---

## Supported Mod Loaders

- 🟢 Supported  
- 🟠 Legacy Support Only — Latest technologies might not be supported  
- 🔴 Not officially supported  

> **Important Note about Forge/NeoForge:**  
> There is a version split for Forge-based modding:
> - For Minecraft 1.20.1 and earlier: Use **Forge**
> - For Minecraft 1.20.2 and newer: Use **NeoForge**
> 
> This split occurred when the core Forge development team departed to create NeoForge. Additionally, due to Forge removing critical mod loading functionality (`-fml.modLists`) after 1.20.4, we are fully transitioning to NeoForge support.

| Name       | Status | Notes |
|------------|--------|-------|
| NeoForge   | 🟢     | Required for Minecraft versions after 1.20.1 as Forge’s replacement. |
| Fabric     | 🟢     | Available only in versions officially supported by the Fabric project. |
| Forge      | 🟠     | Only supported up to Minecraft 1.20.1. For newer versions, use NeoForge. |
| Liteloader | 🟠     | Launcher supports this because it inherits from Helios. Official development discontinued. |
| QuiltMC    | 🔴     | Not officially supported. Launcher code might work with it, but no guarantees. |

---

### Why are only the two major mod loaders supported?

> The goal is to establish guidelines and standards for loading mods. Currently, we officially support only two mod loaders because our team is small, and we don't have the resources to support every mod loader for Minecraft.  
> 
> In some cases, like with QuiltMC, the code might not need any changes. You could simply upload the QuiltMC files to the CDN instead of the Fabric ones, and the launcher will likely work without issues. This is based on the current state of the project at the time of writing this document.
