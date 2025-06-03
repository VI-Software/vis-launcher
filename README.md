<p align="center"><img src="./app/assets/images/vis-icon.png" width="150px" height="150px" alt="vi software"></p>

<h1 align="center">VI Software Launcher</h1>

<p align="center">
  <a href="https://github.com/VI-Software/vis-launcher/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/VI-Software/vis-launcher/build.yml?branch=master&style=for-the-badge" alt="gh actions">
  </a>
  <a href="https://github.com/VI-Software/vis-launcher/releases">
    <img src="https://img.shields.io/github/downloads/VI-Software/vis-launcher/total.svg?style=for-the-badge" alt="downloads">
  </a>
</p>

<p align="center">Connect to VI Software servers hassle-free - let VIS Launcher handle updates and pre-configure your mod installations for VIS experiences.</p>

## ✨ Features

### 🔒 Complete Account Management
- Add multiple accounts and switch between them easily
- Compatible with VI Software Web oAuth 2.0
- Compatible Legacy Login of VIS' Yggdrasil Auth
- Full VIS' Yggdrasil Auth authentication support
- Credentials are never stored - transmitted directly to VI Software servers

### 📂 Efficient Asset Management  
- Get client updates as soon as we release them
- Files are validated before launch - corrupted or incorrect files will be redownloaded

### ☕ Automatic Java Validation
- If you have an incompatible Java version, we'll install the correct one for you
- No Java installation required to run the launcher

### Additional Features
- ⚙️ Intuitive configuration management with Java control panel
- 🎮 Support for all servers inside the platform
  - Switch between server configurations easily 
  - View total players connected on selected server
- 🔄 Automatic launcher updates
- 📊 VI Software services status monitoring

*This is not an exhaustive list. Download and install the launcher to see everything it can do!*

## 📚 Documentation

Need help? [Check out our wiki](https://docs.visoftware.dev/vi-software/vis-launcher)

## 📥 Downloads

You can download the launcher from:
- [VI Software Website](https://visoftware.dev/launcher) - Latest stable version
- [GitHub Releases](https://github.com/VI-Software/vis-launcher/releases) - All versions

## 📜 User Agreement

By using VI Software Launcher, you agree to:
- [Terms of Service](https://docs.visoftware.dev/vi-software/guidelines/terms-of-service)
- [Privacy Policy](https://docs.visoftware.dev/vi-software/guidelines/privacy-policy)
- [Platform License Agreement](https://docs.visoftware.dev/vi-software/guidelines/platform-license-agreement)

## 🔧 Loader Support List

You can view the version support list for this release [here](./LoaderSupportList.md)

## 🐛 Bug Reports 

Found a bug? Report it [here](https://github.com/VI-Software/vis-launcher/issues)

## 📄 Project License

VIS Launcher is licensed under the GNU Affero General Public License (AGPL) Version 3.0. For more details, see the full license [here](./LICENSE).

```text
GNU AFFERO GENERAL PUBLIC LICENSE
=========================================================

    Copyright (C) 2025 VI Software

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

```

### Why AGPL Instead of GPL?

The GNU Affero General Public License (AGPL) was chosen over the standard GPL because VIS Launcher connects to online services. AGPL extends GPL's protections to network services.

### Commercial Use License

While VIS Launcher is primarily licensed under AGPL-3.0, VI Software offers a separate commercial license that can be purchased:

```text
VIS LAUNCHER COMMERCIAL LICENSE
=========================================================

Entities may purchase a commercial license from VI Software that grants 
permission to use VIS Launcher for commercial purposes without the requirement 
to distribute the source code. This license:

1. Is granted on a case-by-case basis through a formal agreement
2. May be revoked if license terms are violated
3. Must be renewed according to the terms specified in the license agreement
4. Allows for specified modifications without triggering AGPL requirements

To inquire about purchasing a commercial license, contact VI Software at:
licensing (at) visoftware (dot) dev

Without a valid commercial license, all use of VIS Launcher is governed by
the terms of the AGPL-3.0 license in full.
```

## Credits

- VIS Launcher uses Authlib Injector 1.2.5, an authentication injection library for VI Software's custom services, licensed under AGPL-3.0 with the "AUTHLIB-INJECTOR" exception. Learn more about Authlib Injector on its official [GitHub repository](https://github.com/yushijinhun/authlib-injector).

- Based on [HeliosLauncher (v2.1.0)](https://github.com/dscalzi/helioslauncher)

- All third parties licenses can be found [here](./THIRD-PARTIES-LICENSES.md)