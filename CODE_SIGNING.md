# Code signing policy

Free code signing provided by [SignPath.io](https://about.signpath.io/), certificate by [SignPath Foundation](https://signpath.org/).

> Status: application for free SignPath Foundation signing is in progress. Until a SignPath Foundation signature is in place, Windows installers are unsigned and this policy does not apply to them.

## Roles

- **Authors and reviewers (committers):** members of the `okpojung/markdown-editor` repository. Every change from a non-committer is reviewed by a team member before merge.
- **Approvers:** the project owner (`okpojung`). Each signing request for a release is approved manually. Nothing is signed without that approval.

## Release rules

- Only binaries built by the public GitHub Actions workflow in this repository from the released source are signed.
- Each signed artifact is the Windows x64 installer `MarkdownEditor-<version>-win-x64.exe`.
- The product name and version metadata are fixed per build.
- Multi-factor authentication is required for GitHub and SignPath accounts of all team members.

## Privacy

This program does not send information to other networked systems unless the user asks for it or the person installing or operating it requests it.

The optional automatic update check (Windows and Linux AppImage builds) only reads the public GitHub release metadata of this repository. It can be turned off in Settings.

## Contact

- Maintainer: [okpojung](https://github.com/okpojung)
- Contact e-mail: (to be filled in by the maintainer before submitting)
