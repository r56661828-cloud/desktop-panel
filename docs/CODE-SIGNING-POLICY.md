# Code Signing Policy

This document describes how release artifacts of **Desktop Panel** are code-signed.

| Item | Policy |
| --- | --- |
| Signed artifacts | Windows NSIS installer (`DesktopPanel-Setup-*.exe`) and portable build (`DesktopPanel-*-x64.zip`) |
| Build provenance | All artifacts are built **exclusively by public GitHub Actions CI** (`.github/workflows/release.yml`) from the source at the tagged commit — never on personal machines |
| Signing infrastructure | [SignPath.io](https://signpath.io) via the [SignPath Foundation](https://signpath.org) free open-source license; signing happens inside CI only |
| Certificate | Issued to the project by SignPath Foundation; the private key never leaves SignPath's HSM |
| Roles | Author / Reviewer / Approver — the repository maintainer (same GitHub account as commits and releases) |
| Verification | Users can verify signatures via file Properties → Digital Signatures, or `Get-AuthenticodeSignature` in PowerShell |
| Other platforms | macOS / Linux builds are not distributed at this time |

Free code signing provided by [SignPath.io](https://signpath.io), certificate by [SignPath Foundation](https://signpath.org).

## Release distribution

- **Primary channel**: [GitHub Releases](https://github.com/r56661828-cloud/desktop-panel/releases) — installers, portable zips, and electron-updater metadata (`latest.yml`, `.blockmap`).
- Automatic updates (installed builds) use electron-updater against GitHub Releases; update integrity is enforced by the updater's checksum verification.
- Any mirror (e.g. Gitee) publishes the **same, byte-identical signed artifacts**; the GitHub Releases page remains the source of truth.

## Scope statement

Only artifacts produced by the CI pipeline from this repository's tagged commits are eligible for signing. Nightly or fork builds are unsigned. If you obtained a Desktop Panel installer from anywhere other than the channels above, treat it as untrusted.
