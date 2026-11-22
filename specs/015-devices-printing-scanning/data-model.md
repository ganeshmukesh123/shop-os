# Data Model: Devices, Printing and Scanning

Builds on 001 (`shop_profile.receipt_width`, `backup_log`), 002 (barcodes, labels), 005 (`device`), 007 (locations) and 010 (devices on the server). Conventions unchanged. Decisions in `research.md` D1 to D9.

## New tables

### `printer_profile`

| Field             | Rule                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| label             | text 1-40 (for example "Counter receipt")                                                                              |
| os_printer_name   | the OS printer name used as `deviceName`                                                                               |
| model             | text up to 60, typed by the owner (FR-010)                                                                             |
| connection_type   | owner-entered text (D9), such as USB, network or another connection; null until recorded (including migrated profiles) |
| kind              | `receipt`, `a4`, `a5`, `label`                                                                                         |
| paper_width_mm    | 58 or 80 for receipts; null for sheets; label width for labels                                                         |
| label_height_mm   | labels only                                                                                                            |
| is_default_for    | JSON list of document kinds: `bill`, `return`, `quote`, `challan`, `receipt`, `statement`, `label`, `location_tag`     |
| prints_devanagari | 0 or 1, set by the test page result                                                                                    |
| is_silent         | 0 or 1 (default 1 for receipts)                                                                                        |

### `scanner_profile`

`model` (up to 60), `kind` (`usb_wedge`, `phone_camera`), `max_key_gap_ms` (default 30), `min_length` (default 6), `strip_prefix`, `strip_suffix`, `last_scan_at`.

### `print_log` (append-only)

`doc_kind`, `doc_id`, `printer_profile_id`, `requested_at`, `result` (`spooled`, `failed`, `cancelled`), `failure_reason`, `user_id`.

## Changed tables

- `shop_profile.receipt_width` (001) is replaced by the default receipt profile's `paper_width_mm` (migration copies it).
- Location tags use 007's location `id` through a stable `location.short_code`: 2 to 8 uppercase ASCII letters or digits (`[A-Z0-9]{2,8}`), unique per shop. T018 prints Code 128 `LOC-<short_code>` (for example, `LOC-01`) and resolves the code within the active shop.
- T007 backfills locations with no code in location ID order within each shop and uses the same allocation rule on new location inserts. Starting at `01`, take the first unused uppercase base-36 value in that shop, padded to at least two characters. Skip any occupied code (if `01` is taken, try `02`). Preserve assigned codes on reruns and renames.
- Enforce the format and a unique constraint on `(shop_id, short_code)` after backfill. Allocate and write in the same transaction; if a concurrent insert claims the candidate, retry with the next free code. If no code fits within eight characters, fail the write without assigning an invalid or duplicate code.

## Derived values (in `@shopos/core`)

- `isScannerBurst(keyEvents, { maxGapMs, minLength })`.
- `normaliseBarcode(raw, { stripPrefix, stripSuffix })`: control characters removed; UPC-A to EAN-13; returns the normalised code and the code as typed.
- `isValidEan13(code)`.
- `parseLocationTag(code)`.
- `healthChecks({ printers, profiles, lastScanAt, freeBytes, lastBackupAt, lastSyncAt, nowMs })` returning items with a level and a next step.

Example: scanner input `\x02 0 3 6 0 0 0 2 9 1 4 5 2 \r` (UPC-A with a start character) normalises to EAN-13 `0036000291452`.
