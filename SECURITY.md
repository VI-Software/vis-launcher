# Security Policy

## Our Commitment to Security

VI Software takes the security of VIS Launcher seriously. As a launcher that handles user authentication, manages mod installations, and connects to VI Software services, we recognize our responsibility to protect our users' systems and data.

## Supported Versions

VIS Launcher follows a structured release policy with three channels. Security support varies by channel:

| Release Channel | Security Support | Recommended For |
| --------------- | ---------------- | --------------- |
| **Annual Stability Release (ASR)** | Security patches & critical bug fixes during support window | Production use |
| **Nightly / Stable (no ASR)** | Best-effort security fixes | Testing & early adopters |
| **Canary** | No security guarantees* | Developers & testing only |

<small>*Should still be reported so they dont make it to a production branch</small>

For information about the current ASR, support windows, and detailed release policy, see our [Release Policy documentation](https://docs.visoftware.dev/vi-software/vis-launcher/release-policy).



### Key Points
- **Current ASR**: Receives all security patches and critical bug fixes during its support window
- **Previous ASR**: Once a new ASR is released, the previous ASR immediately enters end-of-life and **no longer receives security updates**
- **Nightly/ Stable (no ASR) / Canary**: Development channels receive security fixes on a best-effort basis as part of ongoing development

**We strongly recommend using the current ASR for any production or daily-use scenarios.**

## Reporting a Security Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in VIS Launcher, please report it responsibly by emailing **security ( at ) visoftware ( dot ) dev** with:

### Required Information
- **Description**: Clear explanation of the vulnerability
- **Impact**: What an attacker could potentially do
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Affected Versions**: Which versions are affected
- **Environment Details**: OS, Java version, launcher version
- **Proof of Concept**: Code, screenshots, or logs (if applicable)

### Optional Information
- Suggested fix or mitigation
- CVE number (if already assigned)
- Any relevant context or discoveries

### What to Expect
- **Initial Response**: Within 48-72 hours acknowledging receipt
- **Status Updates**: Regular updates on our investigation and remediation progress
- **Resolution Timeline**: 
  - Critical vulnerabilities: Expedited patch within 7-14 days
  - High severity: Patch within 30 days
  - Medium/Low severity: Included in next regular release cycle
- **ASR Backporting**: Critical and high-severity vulnerabilities will be backported to the current ASR branch
- **Credit**: With your permission, we'll acknowledge your contribution in release notes

## Scope

### In Scope
Security issues in VIS Launcher that could lead to:

**Critical Severity:**
- Remote Code Execution (RCE)
- Authentication bypass or credential theft
- Arbitrary file write/read outside launcher directory
- Privilege escalation on user's system
- Man-in-the-middle attacks on launcher updates or mod downloads

**High Severity:**
- Denial of Service (DoS) affecting launcher functionality
- Client-side injection vulnerabilities (XSS in renderer process)
- Insecure update mechanisms
- OAuth token theft or session hijacking
- Unauthorized access to VI Software services

**Medium/Low Severity:**
- Information disclosure (configuration, system details, logs)
- Path traversal vulnerabilities
- Insecure temporary file handling
- Weak cryptographic implementations
- Dependency vulnerabilities with proven exploitability

### Out of Scope

The following are **not** considered security vulnerabilities:

- Issues requiring physical access to the user's machine
- Social engineering attacks (phishing, impersonation)
- Vulnerabilities in third-party dependencies without proof of impact on VIS Launcher
- Issues in VI Software backend services (report to VI Software directly)
- Minecraft server vulnerabilities
- Mod-specific vulnerabilities (report to mod authors)
- Browser/Electron framework vulnerabilities (unless we're using an outdated version)
- Theoretical vulnerabilities without practical exploitation path
- Issues already reported or publicly known
- Rate limiting or brute force on VI Software servers
- Missing security best practices without proven vulnerability
- Crashes or bugs that don't have security implications

## Security Features

VIS Launcher implements several security measures:

- OAuth 2.0 and Yggdrasil authentication with secure token handling
- User credentials are transmitted directly to VI Software servers and never stored locally
- Validation of downloaded files before execution
- Security patches delivered through automatic launcher updates
- Electron security features to isolate renderer processes
- All communication with VI Software services over encrypted channels

## Vulnerability Disclosure Process

1. **Report Received**: We acknowledge your report within 48-72 hours
2. **Investigation**: We verify and assess the severity of the vulnerability
3. **Development**: We develop and test a fix on the main/nightly branch
4. **Internal Testing**: 
   - Canary builds are created for immediate CI/CD testing
   - Pre-release builds are generated for broader testing
5. **Release**: 
   - Critical/High severity: Expedited release to all supported channels
   - ASR receives backported security patch (e.g., `2.1.1-asr` → `2.1.2-asr`)
   - Nightly/Pre-release receives fix in next build
6. **Public Disclosure**: After patch deployment and user notification (typically 7-30 days post-release)
7. **Credit**: Reporter is credited in release notes and security advisories (if desired)

### Release Channel Strategy for Security Patches

**Critical Security Vulnerabilities:**
- 🟡 **Canary**: Immediate fix deployed for validation
- 🔵 **Nightly/Pre-release**: Released within 24-48 hours after canary validation
- 🟢 **ASR**: Emergency patch released within 7-14 days

**High Severity Vulnerabilities:**
- 🟡 **Canary**: Fix deployed in next CI/CD build
- 🔵 **Nightly/Pre-release**: Included in next scheduled build (usually within days)
- 🟢 **ASR**: Backported and released within 30 days

**Medium/Low Severity:**
- 🟡 **Canary**: Fixed as part of regular development
- 🔵 **Nightly/Pre-release**: Included in normal release cycle
- 🟢 **ASR**: Evaluated for backporting; included if impact is significant

For more details on our release channels and branching strategy, see our [Release Policy documentation](https://docs.visoftware.dev/vi-software/vis-launcher/release-policy).

### Coordinated Disclosure

We request that security researchers:
- Allow us reasonable time (30-90 days) to patch before public disclosure
- Do not exploit vulnerabilities beyond proof-of-concept
- Do not access, modify, or delete other users' data
- Make a good faith effort to minimize privacy violations

## Bug Bounty

At this time, VI Software does not offer a monetary bug bounty program. However, we deeply appreciate security research contributions and will:
- Publicly acknowledge contributors (with permission)
- Provide recognition in our Hall of Fame (coming soon)
- Consider contributions for future community recognition programs

## Security Best Practices for Users

To keep your VIS Launcher installation secure:

1. **Use the ASR Channel**: For production and daily use, always use the current Annual Stability Release (ASR). Check the [Release Policy](https://docs.visoftware.dev/vi-software/vis-launcher/release-policy) for the current ASR version.
2. **Keep Updated**: 
   - ASR users: Install security patches when released
   - Nightly users: Enable automatic updates to receive fixes quickly
   - Canary users: Expect frequent updates; only use for testing
3. **Download from Official Sources**: Only download from [visoftware.dev](https://visoftware.dev/launcher) or [GitHub Releases](https://github.com/VI-Software/vis-launcher/releases)
4. **Verify Release Channel**: Ensure you're on the correct channel for your use case. Check your version string in the launcher for channel indicators.
5. **Monitor Security Advisories**: Watch GitHub Security Advisories for VIS Launcher
6. **Report Suspicious Activity**: Contact us if you notice unusual launcher behavior
7. **Use Strong Passwords**: Secure your VI Software account with a strong, unique password
8. **Enable 2FA**: If available, enable two-factor authentication on your account

### When to Upgrade Between Channels

- **From Canary to Nightly**: When you want more stability but still want new features
- **From Nightly to ASR**: When the new ASR is released (recommended for all users)
- **From old ASR to new ASR**: As soon as the new ASR is released (old ASR stops receiving security updates)

## Hall of Fame

We thank the following security researchers for responsibly disclosing vulnerabilities:

*This section will be updated as we receive and address security reports.*

## Contact

- Security Issues: security ( at ) visoftware ( dot ) dev
- General Support: [Documentation](https://docs.visoftware.dev/vi-software/vis-launcher)
- Bug Reports: [GitHub Issues](https://github.com/VI-Software/vis-launcher/issues)

---

**Note**: This security policy applies specifically to the VIS Launcher client application. For security issues related to VI Software's backend services, authentication systems, or web infrastructure, please refer to VI Software's main security policy.

*Last Updated: November 2025*