# Security Policy

## Supported Versions

Only the latest published version of Worktint is supported with security
fixes. Please update to the newest release before reporting an issue.

## Attack Surface

Worktint has a deliberately small attack surface:

- It makes **no network calls**.
- It only reads local git metadata (e.g. worktree lists) and writes to two
  files inside repositories you open: the workspace's `.vscode/settings.json`
  (to set a window color) and `.git/info/exclude` (to keep that setting out
  of version control).
- It does not execute arbitrary code, read secrets, or communicate with any
  external service.

If you believe you've found a way for Worktint to read, write, or transmit
data outside of this scope, that's exactly the kind of issue we want to hear
about.

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security reports.

Instead, email **jancassio@gmail.com** with:

- A description of the issue and its potential impact
- Steps to reproduce, or a minimal example if possible
- The Worktint version, VS Code/Codium version, and OS you observed it on

You should receive an acknowledgment within a few days. We'll work with you
to understand and address the issue, and will credit you in the release
notes if you'd like once a fix is out.
