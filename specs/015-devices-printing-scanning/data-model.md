# Data Model: Devices, Printing and Scanning

Builds on 001 (`shop_profile.receipt_width`, `backup_log`), 002 (barcodes, labels), 005 (`device`), 007 (locations) and 010 (devices on the server). Conventions unchanged. Decisions in `research.md` D1 to D9.

## New tables

### `printer_profile`

| Field             | Rule                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| label             | text 1-40 (for example "Counter receipt")                                                                          |
| os_printer_name   | the OS printer name used as `deviceName`                                                                           |
| model             | text up to 60, typed by the owner (FR-010)                                                                         |
| kind              | `receipt`, `a4`, `a5`, `label`                                                                                     |
| paper_width_mm    | 58 or 80 for receipts; null for sheets; label width for labels                                                     |
| label_height_mm   | labels only                                                                                                        |
| is_default_for    | JSON list of document kinds: `bill`, `return`, `quote`, `challan`, `receipt`, `statement`, `label`, `location_tag` |
| prints_devanagari | 0 or 1, set by the test page result                                                                                |
| is_silent         | 0 or 1 (default 1 for receipts)                                                                                    |

### `scanner_profile`

`model` (up to 60), `kind` (`usb_wedge`, `phone_camera`), `max_key_gap_ms` (default 30), `min_length` (default 6), `strip_prefix`, `strip_suffix`, `last_scan_at`.

### `print_log` (append-only)

`doc_kind`, `doc_id`, `printer_profile_id`, `requested_at`, `result` (`spooled`, `failed`, `cancelled`), `failure_reason`, `user_id`.

## Changed tables

- `shop_profile.receipt_width` (001) is replaced by the default receipt profile's `paper_width_mm` (migration copies it).
- Location tags use 007's location `id` through a short code: `location.short_code` (new, 2 to 8 characters, unique per shop) encoded as Code 128 `LOC-<short_code>`.

## Derived values (in `@shopos/core`)

- `isScannerBurst(keyEvents, { maxGapMs, minLength })`.
- `normaliseBarcode(raw, { stripPrefix, stripSuffix })`: control characters removed; UPC-A to EAN-13; returns the normalised code and the code as typed.
- `isValidEan13(code)`.
- `parseLocationTag(code)`.
- `healthChecks({ printers, profiles, lastScanAt, freeBytes, lastBackupAt, lastSyncAt, nowMs })` returning items with a level and a next step.

Example: scanner input `\x02 0 3 6 0 0 0 2 9 1 4 5 2 \r` (UPC-A with a start character) normalises to EAN-13 `0036000291452`.
