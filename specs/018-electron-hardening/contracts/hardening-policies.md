# Contract: hardening policies

Behaviour the code must keep. Each row is a test case (table-driven). Requirement IDs refer to `spec.md`.

## 1. IPC sender policy (FR-001, US1)

Input: a summary of the sender: `{ isMainFrame, scheme, location }` or `null` when the frame is missing. Output: `trusted` or `refused`.

| Sender | Result |
|---|---|
| Main frame, app's own page | trusted |
| Frame missing (`null`) | refused |
| Same-origin child frame | refused |
| Main frame, any other page or scheme | refused |
| Dev server page, packaged build | refused |

A refusal returns the normal envelope `{ ok: false, code, message }`, calls no service, never throws, and logs the reason without customer data. Code choice: decision D1 in `plan.md`. Never compare a serialized origin (it is `"null"` for local files).

## 2. Permission policy (FR-002, US2)

| Call | Result |
|---|---|
| Permission request, any permission | denied |
| Permission check, any permission | not granted |
| A later feature (015 camera) | adds one named exception with its own test; the default stays |

## 3. Navigation policy (FR-003, US3)

Parsed with `URL`, compared by scheme, host, port and exact page path. Redirect targets use the same function.

| Address | Packaged | Development |
|---|---|---|
| App's own page | allow | allow |
| Another `file:` path (`file:///etc/hosts`) | block | block |
| Dev server exact host and port | block | allow |
| Look-alike host (`localhost.evil.com`) | block | block |
| Extra path segments outside the page | block | block |
| Unparsable text | block | block |
| Allowed address that redirects to a foreign address | block | block |

## 4. Fuse set (FR-004, FR-006)

| Fuse | Packaged value |
|---|---|
| RunAsNode | off |
| EnableNodeOptionsEnvironmentVariable | off |
| EnableNodeCliInspectArguments | off |
| EnableEmbeddedAsarIntegrityValidation | on |
| OnlyLoadAppFromAsar | on |
| GrantFileProtocolExtraPrivileges | off after PR C (FR-008) |

`scripts/check-fuses.mjs` reads the packaged binary and exits non-zero on any difference. The development and test Electron binary is never modified.

## 5. Private protocol (FR-007, US6)

| Request | Result |
|---|---|
| File inside the built renderer folder | served |
| Parent-directory segments, encoded or not | refused |
| Path outside the bundle | refused |
| Any non-GET method | refused |
