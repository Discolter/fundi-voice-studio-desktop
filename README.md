# Fundi Voice Studio Desktop: Launcher + GitHub updater

Source base: Fundi Voice Studio 1.8.0. This is the **Studio-owner** launcher; do not use its update feed for the Actor app.

## Installation and update behavior

- Windows x64 installer: `dist/FundiVoiceStudio-Launcher-Setup-1.8.0.exe`.
- Replaces the existing `FundiVoiceStudio.exe` in `%LOCALAPPDATA%\Programs\Fundi Voice Studio`; desktop shortcut name **Fundi Voice Studio** remains the same.
- On every fresh start, launcher checks GitHub's **public** latest release URL for `studio-update.json`. Never needs a GitHub password or PAT.
- Ed25519 public key is **pinned inside the EXE**. A release manifest must be signed with the matching private seed (`STUDIO_SIGNING_SEED_B64` GitHub Actions secret). Checks version, signature, SHA-256, size, required files, archive path safety and prevents downgrades.
- Installs to `versions/X.Y.Z/` and switches `current-version.txt` only after verified extraction. Existing app version stays available. On early startup failure to create the single-instance mutex, rolls back to previously installed version.
- If offline or releases are not yet configured, starts locally installed Studio 1.8.0 without asking for credentials. Errors are written to `%LOCALAPPDATA%\FundiVoice\launcher.log`.
- Workspace and secure cloud connection remain under `%LOCALAPPDATA%\FundiVoice`; updater never replaces or deletes them.

## One-time GitHub setup

1. Create a **separate public** repository under account `Discolter` named exactly `fundi-voice-studio-desktop`. A private repo's release assets cannot be downloaded by an unauthenticated launcher. Only ship **release files and reviewed source code**, never passwords, project data, `cloud.connection.bin`, local workspace, or private signing seed.
2. Add this source kit to the repository. `main` is the default branch.
3. Open GitHub repository → Settings → Secrets and variables → Actions → New repository secret. Key: `STUDIO_SIGNING_SEED_B64`. Value: base64 private seed from the separately supplied file. **Never commit the seed or paste it in a chat.**
4. Open Actions and run `Build and publish Studio desktop update` once for initial `1.8.0` release. Checksums/signature are produced by the workflow; the default branch must permit write permissions for GitHub Actions.
5. Once baseline release exists, install the launcher. Check a later release by bumping `package/VERSION.txt` (e.g. `1.8.1`) and committing revised `package/**` files. Workflow tests + signs + creates `v1.8.1`, and the next launch downloads and installs it.

Note: To keep `latest` authoritative, publish **stable releases only**. Never delete or replace release assets after publishing; bump the version instead.

## Build

- Local developer Windows workstation: `powershell -NoProfile -ExecutionPolicy Bypass -File .\Build-Installer.ps1` (Go 1.23+, Python 3, Windows PowerShell 5.1).
- Update package: `go run ./tools/package-release ./package ./dist/studio-app.zip`.
- CI: Windows Actions runner compiles C# with `Validate-Source.ps1`, checks Go tests and signs `studio-app.zip` before publishing. Build **fails closed** if GitHub signing secret is missing.
- For a new Studio release, do not repackage the launcher or uninstall app; only revise versioned `package/` files. If updater itself needs replacement, release a reviewed new bootstrap installer separately.

## Limitations

Windows code signing via a trusted certificate is not included, so Windows SmartScreen can warn about the unsigned installer. CI verifies source compilation but it does not replace real-device testing. The auto-rollback detects early failure (no ready mutex), not every later runtime bug. GitHub Releases and signing secret must be set up before downloads can work.
