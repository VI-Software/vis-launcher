# Security Policy

## Our Commitment
VI Software takes the security of VIS Launcher seriously. As a launcher handling authentication and mod management, we are dedicated to protecting user systems and data through a structured security framework.

## Supported Versions
Security support is determined by the release channel. We strongly recommend the **Annual Stability Release (ASR)** for daily use.

| Release Channel | Security Support | Recommendation |
| :--- | :--- | :--- |
| **Annual Stability Release (ASR)** | Patches & critical fixes during support window | Production Use |
| **Nightly / Stable** | Best-effort security fixes | Testing & Early Adopters |
| **Canary** | No formal guarantees (fixes via development) | Developers Only |

*Note: Once a new ASR is released, the previous version enters end-of-life and no longer receives updates.*

## Reporting a Vulnerability
**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a vulnerability, email **launcher-security (at) visoftware (dot) dev**. Please include a description, the potential impact, steps to reproduce, and your environment details (OS/Java version).

### Response Expectations
* **Acknowledgment:** 48–72 hours.
* **Critical Fixes:** Aimed for release within 7–14 days.
* **High Severity:** Aimed for release within 30 days.
* **Credit:** Contributors may be acknowledged in our release notes with permission.

## Scope

### In Scope
We prioritize vulnerabilities in the VIS Launcher client that could lead to:
* Remote Code Execution (RCE) or Privilege Escalation.
* Credential theft or authentication bypass.
* Unauthorized file access outside the launcher directory.
* Man-in-the-middle attacks on updates or downloads.
* Session hijacking or OAuth token theft.

### Out of Scope
The following are not considered security vulnerabilities for this policy:
* Social engineering or phishing attacks.
* Issues requiring physical access to the machine.
* Vulnerabilities in Minecraft servers or specific mods.
* Theoretical issues without a practical exploit path.
* Bugs or crashes without security implications.

## Disclosure Process
1. **Investigation:** We verify the report and assess severity.
2. **Remediation:** Fixes are developed and tested on the Canary branch.
3. **Deployment:** Validated patches are pushed to Nightly and then backported to the current ASR.
4. **Public Disclosure:** Typically occurs 7–30 days after the patch is deployed.

## User Best Practices
* **Use ASR:** Always use the current Annual Stability Release for stability and guaranteed security updates.
* **Official Sources:** Only download the launcher from `visoftware.dev` or our official GitHub Releases.
* **Stay Updated:** Enable automatic updates to ensure you receive the latest security patches immediately.

## Hall of Fame
This section will be updated to honor researchers who have responsibly disclosed vulnerabilities to VI Software.

## Contact
* **Security:** launcher-security (at) visoftware (dot) dev
* **General Support:** [Documentation](https://docs.visoftware.dev/vi-software/vis-launcher)
* **Bugs:** [GitHub Issues](https://github.com/VI-Software/vis-launcher/issues)

---
*Last Updated: February 2026*