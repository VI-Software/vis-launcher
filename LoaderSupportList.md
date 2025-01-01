# Loader Support List

This document outlines the version support for this specific launcher release

## Officially Minecraft Supported versions
🟢Supported
🟡Minimal support
🟠Works, but might not have the latest technologies and is not officially supported. It might be supported by community members.
🔴Not supported

| Version  | Status   |
|----------|----------|
| 1.21.X     | 🟢        |
| 1.20.X     | 🟢        |
| 1.19.X   | 🟢        |
| 1.19.2   | 🟢        |
| 1.18.X   | 🟢        |
| 1.17.X   | 🟢        |
| 1.16.X   | 🟢        |
| 1.15.X   | 🟠        |
| 1.14.X   | 🟠        |
| 1.13.X   | 🟠        |
| 1.12.X   | 🟢        |
| 1.11.X   | 🟠        |
| 1.10.X   | 🟠        |
| 1.9.X    | 🟠        |
| 1.8.X    | 🟠        |
| 1.7.10   | 🟡        |
| 1.6.X    | 🟠        |
| 1.5.X    | 🟠        |
| 1.4.X    | 🟠        |
| 1.3.X    | 🟠        |
| 1.2.X    | 🟠        |
| 1.1      | 🟠        |
| 1.0      | 🟠        |
| Beta 1.8 | 🔴        |
| Beta 1.7 | 🔴        |
| Beta 1.6 | 🔴        |
| Beta 1.5 | 🔴        |


## Supported mod loaders

🟢Supported
🟠Legacy Support Only. Latest technologies might not be supported
🔴Not officially supported

| Name | Status | Notes |
|----------|----------|----------|
| Forge     | 🟢 | |
| Fabric | 🟢 | Fabric is only available in the versions that fabric supports. |
| Liteloader | 🟠| Only the launcher provides support for this loader because it inherits from Helios. VI Software no longer offers support for this mod loader. |
| Neoforge | 🔴 | Launcher code is adapted to work with the mod loader parent. It might not be necessary to perform changes in the code, but it's not officially supported. | 
| QuiltMC | 🔴 |Launcher code is adapted to work with the mod loader parent. It might not be necessary to perform changes in the code, but it's not officially supported.  |


### Why are only the two major mod loaders supported? 

> The goal is to establish guidelines and standards for loading mods. Currently, we officially support only two mod loaders because our team is small, and we don't have the resources to support every mod loader for Minecraft. In some cases, like with QuiltMC, the code might not need any changes. You could simply upload the QuiltMC files to the CDN instead of the Fabric ones, and the launcher will likely work without issues. The same applies to NeoForge, based on the current state of the project at the time of writing this document.
