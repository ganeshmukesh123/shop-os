# Feature Specification: Items - Variants, Names and Paint Tinting

**Feature Branch**: `002-items-variants-tinting`

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Extend the basic inventory with item families and variants, unit conversions, search names, duplicate handling and merge, paint class, warranty and serial flags, barcode labels, and paint tinting (base paints, colorants, shade formulas, repeat shades)."

**PRD source**: `docs/reference/PRD.md` sections 5 (FR-ITM-001 to 017, FR-TNT-001 to 009), US-12, EC-07, EC-09.

**Depends on**: 001-shop-os-mvp (items, stock movements, basic bill). This feature replaces the flat item with family and variant.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Item families with variants (Priority: P1)

The owner creates a family such as "PVC Pipe Supreme" with attributes (size, class, brand and so on, up to 4) and generates every combination in one step, then deletes combinations that are not stocked. Each variant has its own price, stock, barcode and unit.

**Why this priority**: Hardware items come in many sizes, brands and shades; without variants the item list is unusable at 5,000+ items.

**Independent Test**: Create a family with 3 sizes and 2 classes, generate 6 variants, delete 1, and bill 2 of the remaining variants from the variant grid.

**Acceptance Scenarios**:

1. **Given** a family with sizes 0.5", 0.75", 1" and classes 4 kg and 6 kg, **When** the owner generates variants, **Then** 6 variants are created and each can be deleted if not stocked.
2. **Given** a family is selected on a bill, **When** the user presses Enter, **Then** a grid opens (rows one attribute, columns another) with stock in each cell.
3. **Given** a variant with base unit metre and 1 roll = 90 m, **When** billing or receiving, **Then** the user may use either unit and quantities convert exactly.
4. **Given** a unit that does not allow decimals (pcs, sealed packs), **When** 2.5 is entered, **Then** it is rejected.
5. **Given** a variant has several attributes of the seeded set in FR-001, **When** more than 4 are chosen, **Then** the system refuses and says why.

---

### User Story 2 - Find items by any name and avoid duplicates (Priority: P1)

Staff find items by typing partial, misspelled, Hindi, Hinglish or trade names ("paipa", "bend", "elbow"), by barcode or code, with the most-sold items first. The system warns of likely duplicates before saving, and a merge tool combines duplicates safely.

**Why this priority**: Slow or failed search is the top counter frustration; duplicate items corrupt stock.

**Independent Test**: Give an item three names including a Devanagari one; find it with each and with a one-letter typo; create a near-duplicate and see the warning; merge two items and reverse the merge.

**Acceptance Scenarios**:

1. **Given** an item with several search names, **When** staff type any of them, **Then** the item is found.
2. **Given** a typo of 1 or 2 characters, **When** staff search, **Then** the item still appears.
3. **Given** two matches, **Then** the one with more recent sales ranks first.
4. **Given** a new item with the same brand, similar name and same attributes as an existing one, **When** saving, **Then** the likely duplicates are shown first.
5. **Given** the same barcode on two items, **When** scanned, **Then** a chooser opens and a data issue is logged for the owner.
6. **Given** two items are merged, **Then** all history moves to the surviving item, the merge is logged, and it can be reversed within 30 days.

---

### User Story 3 - Bill tinted paint (Priority: P1)

Staff bill a tinted paint by picking product, shade and pack size. The system picks the base and formula, shows colorant amounts for the tinter, deducts one base can and the colorant millilitres from stock, and prices base plus tinting charge. Staff can enter a custom shade, repeat a customer's earlier shade in one tap, and tinted paint is marked non-returnable. The owner-approved exception is implemented in feature 003 using approvals from 005.

**Why this priority**: The shop tints paint today, and the PRD makes tinting an MVP requirement.

**Independent Test**: Bill a tinted 4 L pack of a shade with a loaded formula: stock of base and each colorant falls by the formula amounts, price equals base plus charge; repeat it from the customer's page; verify the saved line is marked non-returnable.

**Acceptance Scenarios**:

1. **Given** base paints (brand, product, base type, pack size) and colorants stocked in ml, **When** a shade with a formula is billed, **Then** colorant amounts show and stock deducts 1 base can and the formula ml.
2. **Given** a fixed tinting charge per pack size (or a loaded brand shade price list), **When** billed, **Then** price = base can price + charge (or the list price).
3. **Given** a custom shade, **When** staff enter colorant amounts, **Then** it saves as a custom formula with a name and the customer or site.
4. **Given** a customer's earlier shades, **When** opening their page or a bill, **Then** they list and "same as last time" is one tap.
5. **Given** a tinted sale, **Then** the saved line is marked non-returnable and the shop has a "Tinted returns" location ready for feature 003.
6. **Given** a shade library file with formulas, **When** imported in M5 from a supported spreadsheet file, **Then** formulas load with a preview of errors.
7. **Given** colorant cost, **Then** it counts in landed cost for margin.

---

### User Story 4 - Paint class, warranty and serial flags, labels and bulk import (Priority: P2)

Paint, thinner and solvent items carry a petroleum class, litres per unit and a sealed-pack-only flag. Items may carry a warranty period and serial tracking. Barcode labels and shelf tags print for items without manufacturer barcodes. Items and opening prices import from Excel/CSV and Tally export with a preview.

**Why this priority**: Data the later licence meter, warranty and purchase features need must be captured from the start, and import is the main way to load the catalogue.

**Independent Test**: Import 3,000 rows, review errors and duplicate groups in the preview, confirm, and print labels for 10 items.

**Acceptance Scenarios**:

1. **Given** a paint item, **Then** class (A, B, C or not applicable), litres per unit and sealed-pack-only are required fields.
2. **Given** an Excel of 3,000 rows, **When** previewed, **Then** it shows rows OK, errors (missing unit, bad HSN) and duplicate groups, and nothing saves until confirmed.
3. **Given** items without barcodes, **When** labels are requested, **Then** barcode labels and shelf location tags print.
4. **Given** a warranty period and serial tracking flag, **Then** they are stored on the item for later use.

---

### User Story 5 - Later increments (Priority: P3)

These come after the items above prove themselves: ISI/BIS number capture at purchase for BIS-mandatory electrical items (V2); kits that bill as one line and deduct component stock (V2); substitutes shown at zero stock (V2); colorant low-level alerts, refill movements and monthly usage versus formula (V2); counter item notes such as compatibility and "suggest also" (V3); tinting machine file import (Later).

**Independent Test**: Configure a kit with 3 components; sell 1 kit and confirm each component's stock decreases accordingly. Test substitute recommendation display when an item sits at zero stock.

**Acceptance Scenarios**:

1. **Given** a kit sold as one line, **Then** component stock deducts, and a partial return prorates by component value (EC-12).
2. **Given** a zero-stock item with substitutes, **Then** the substitutes list shows at the counter.

---

### Edge Cases

- A batch with two MRPs (old and new stock): billing picks the oldest batch, staff can switch, and the MRP cap uses the selected batch (EC-09).
- Two items with the same barcode (EC-07).
- Base paint out of stock but colorants in stock: bill is allowed, negative stock flagged.
- Formula missing for a product, base and pack size: staff are told and may enter a custom shade.
- Deleting a variant that appears on past bills: deactivate only.
- Family renamed after bills exist: past bills keep the snapshot name.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store items as a family with one or more variants, each with up to 4 attributes from the eight Generic keys (size, gauge, shade, pack size, colour, length, rating, brand; FR-ITM-001) plus the two axes used by this feature: class and base type.
- **FR-002**: System MUST generate all variant combinations in one step and allow deleting combinations not stocked (FR-ITM-002).
- **FR-003**: Each variant MUST hold automatic item code, barcode(s), HSN, GST rate, base unit, purchase price, selling price per tier, MRP per batch, reorder level, location tag and active flag (FR-ITM-003).
- **FR-004**: System MUST support unit conversions between a base unit and alternate units, usable in billing and purchase (FR-ITM-004).
- **FR-005**: System MUST apply a per-item decimal setting (on for metre and kg, off for pieces and sealed packs) (FR-ITM-005).
- **FR-006**: System MUST support multiple search names including Devanagari, Hinglish and trade names (FR-ITM-006).
- **FR-007**: Search MUST tolerate 1-2 typos, match any name, barcode or code, and rank by recent sales (FR-ITM-007).
- **FR-008**: System MUST warn of likely duplicates on create (FR-ITM-008) and provide a logged merge reversible for 30 days (FR-ITM-009).
- **FR-009**: Paint, thinner and solvent items MUST carry petroleum class, litres per unit and a sealed-pack-only flag (FR-ITM-010).
- **FR-010**: Items MAY carry a warranty period in months and a serial tracking flag (FR-ITM-011).
- **FR-011**: System MUST import items and opening prices from Excel/CSV and Tally export with a preview before saving (FR-ITM-012) and print barcode labels and shelf tags (FR-ITM-013).
- **FR-012**: System MUST represent base paints with brand, product, base type and pack size, and colorants as items stocked in ml (FR-TNT-001).
- **FR-013**: System MUST keep a shade library of shade code, name, brand shade card and formulas per product, base and pack size, importable from Excel (FR-TNT-002).
- **FR-014**: Billing a tinted paint MUST pick base and formula, show colorant amounts, and deduct one base can and the colorant ml (FR-TNT-003).
- **FR-015**: Tinted price MUST be base can price plus a configurable fixed charge per pack size, or the brand shade price list if loaded; colorant cost MUST count in landed cost (FR-TNT-004).
- **FR-016**: System MUST support custom shades saved with name and customer/site, and one-tap repeat of a customer's or site's earlier shades (FR-TNT-005, FR-TNT-006).
- **FR-017**: Tinted paint MUST be marked non-returnable and the shop MUST have a seeded `tinted_returns` location. The reduced-value return to that location with owner approval (FR-TNT-007) is deferred to feature 003 FR-015 using feature 005 approvals.
- **FR-018 [V2]**: ISI/BIS number capture (FR-ITM-014), kits (FR-ITM-015), substitutes (FR-ITM-016), colorant alerts and usage monitoring (FR-TNT-008).
- **FR-019 [V3 / Later]**: Item notes (FR-ITM-017); tinting machine import (FR-TNT-009).

### Key Entities

- **Item Family**: Grouping name, brand, attribute set, category.
- **Variant**: Purchasable and sellable unit with attributes, codes, unit set, prices, flags.
- **Unit Conversion**: Alternate unit and factor to the base unit.
- **Search Name**: Alternate name for an item (language and kind).
- **Base Paint / Colorant**: Paint items with base type, pack size, or stocked in ml.
- **Shade / Formula**: Shade code and name; per product, base and pack size list of colorant and ml; custom or library.
- **Merge Record**: Which items merged, who, when, reversal window.
- **Data Issue**: Logged problem such as a duplicate barcode.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A family with 6 variants is created in under 2 minutes.
- **SC-002**: Item search results appear in about 0.2 seconds with 50,000 items and find an item by any of its names 95% of the time in a 50-search trial.
- **SC-003**: A tinted paint is billed in under 90 seconds, including the colorant display.
- **SC-004**: Colorant and base stock after 20 tinted sales match the formulas to the millilitre.
- **SC-005**: A 3,000-row import preview completes in under 30 seconds and shows every error and duplicate group.
- **SC-006**: Zero history is lost in a merge, and a reversal within 30 days restores both items.

## Assumptions

- Shade formulas come from the brand's shade card or an Excel file the owner supplies; there is no machine integration.
- How Legal Metrology treats tinting inside the sealed base can is unconfirmed and is to be checked with the brand representative or local office before go-live.
- Hindi screen text is out of scope; Hindi search names are in.
- HSN and GST rate are stored and shown here but not applied to bills until feature 008.
- Existing 001 flat items migrate into one-variant families automatically.
