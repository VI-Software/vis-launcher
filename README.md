
<p align="center"><img src="./app/assets/images/vis-icon.png" width="150px" height="150px" alt="vi software"></p>

<h1 align="center">VI Software Launcher</h1>

[<p align="center"><img src="https://img.shields.io/github/actions/workflow/status/VI-Software/vis-launcher/build.yml?branch=master&style=for-the-badge" alt="gh actions">](https://github.com/VI-Software/vis-launcher/actions) [<img src="https://img.shields.io/github/downloads/VI-Software/vis-launcher/total.svg?style=for-the-badge" alt="downloads">](https://github.com/VI-Software/vis-launcher/releases)

<p align="center">Connect to VI Software servers without worries, allowing VIS Launcher to update and pre-configure your mod installations for VIS experiences for you.</p>


## Características

* 🔒**Complete account management.**
   * Add multiple accounts and easily switch between them.
   * Fully supports [VIS' Yggdrasil Auth](https://docs.visoftware.tech/vi-software/vis-yggdrasil-auth) (Yggdrasil) authentication.
   * Credentials are never stored, they are transmitted directly to the VI Software server.
* 📂 **Efficient asset management.**
   * Receive client updates as soon as we release them.
   * Files are validated before launch. Corrupted or incorrect files will be re-downloaded.
* ☕ **Automatic Java validation**
   * If you have an incompatible version of Java installed, we'll install the correct one for you.
   * NJava doesn't need to be installed to run the launcher.
* 📰 **Integrated news service natively within the launcher.**
* ⚙️ **Intuitive configuration management, including a Java control panel.**
* Supports all of our servers.
   * Easily switch between server configurations.
   *View the total number of players connected to the selected server.
* AAutomatic launcher updates.
* View the status of VI Software.

This is not an exhaustive list. Download and install the launcher to explore everything it can do!

#### Need help? [Check the wiki](https://docs.visoftware.tech/vi-software/vis-launcher)


## Downloads

You can download from [GitHub Releases](https://github.com/VI-Software/vis-launcher)

## Bugs

To report a bug, go [here](https://github.com/VI-Software/vis-launcher/issues)

## Loader Support List

You can view the version support list for this release [here](./LoaderSupportList.md)

#### Additional Information

VIS Launcher uses Authlib Injector 1.2.5, an authentication injection library for VI Software's custom services, which is licensed under the AGPL-3.0 license. You can find more information about Authlib Injector in its official repository on [GitHub](https://github.com/yushijinhun/authlib-injector).

The base of VIS Launcher is based on the project [HeliosLauncher (v.2.1.0)](https://github.com/dscalzi/helioslauncher)