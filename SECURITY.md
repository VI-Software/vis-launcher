We take the security of VIS Launcher seriously. Because the launcher handles your credentials and mods, keeping your system and data safe is top priority. Here is how we handle security, report handling, and what you can expect from us.

**Supported Versions**

* **Long-Term Support (LTS):** Recieves all security patches and critical fixes. We strongly recommend this channel for everyday use. Once a new LTS is released, the previous version reaches end-of-life and no longer receives updates.
* **Nightly / Stable:** Receives best-effort security updates. Best for testing and early adopters.
* **Canary:** No formal security guarantees, as fixes simply roll out through regular active development. Intended for developers only.

**Reporting a Vulnerability**

If you discover a security issue, please don't open a public GitHub issue.

Instead, email us directly at **launcher-security (at) visoftware (dot) dev**. To help us understand the issue quickly, please include:

* A brief description of the vulnerability and its potential impact.
* Clear steps to reproduce it.
* Details about your environment (like your OS and Java version).

**Our Response Timeline**

* **Acknowledgment:** We'll confirm receipt within 48 to 72 hours.
* **Critical Fixes:** We aim to release a patch within 7 to 14 days.
* **High Severity Fixes:** We aim to patch these within 30 days.
* **Credit:** If you'd like, we are happy to publicly thank you in our release notes.

**What Is (and Isn't) in Scope**

We prioritize client-side issues that pose a direct threat to your security, including remote code execution, privilege escalation, credential or session token theft, unauthorized file access outside the launcher directory, and man-in-the-middle attacks on updates or downloads.

Issues outside our scope include social engineering/phishing, physical access exploits, vulnerabilities inside specific Minecraft servers or mods, theoretical issues without a practical exploit, or standard non-security bugs and crashes.

**Our Disclosure Process**

1. We verify your report and assess its severity.
2. We develop and test a fix on the Canary branch.
3. We push validated patches to Nightly and backport them to the current LTS channel.
4. We publish a public disclosure, usually 7 to 30 days after the patch goes live.

**Keeping Your Setup Safe**

Stick to the LTS release channel for guaranteed security patches, download the launcher only from visoftware.dev or our official GitHub Releases page, and keep automatic updates turned on so you get fixes as soon as they drop.

**Hall of Fame**

We’ll list security researchers here who help us keep VIS Launcher safe through responsible disclosure.

**Contact & Support**

* Security Reports: launcher-security (at) visoftware (dot) dev
* Documentation & General Support: [https://docs.visoftware.dev/vi-software/vis-launcher](https://docs.visoftware.dev/vi-software/vis-launcher)
* General Bug Reports: [https://github.com/VI-Software/vis-launcher/issues](https://github.com/VI-Software/vis-launcher/issues)