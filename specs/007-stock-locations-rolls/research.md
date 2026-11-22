# Research: Stock by Location, Counts, Reorder and Cut-Length Rolls

**Feature**: `specs/007-stock-locations-rolls/spec.md` | **Date**: 2026-11-18

Sources read: the spec, PRD section 7 (FR-STK-001 to 018) and its roll lifecycle note, the architecture reference sections 7.6, 8.5 (stock movement DDL) and 11.3, the constitution v2.1.0, 001's data model (one seeded location "Shop floor"; "transfers, with both set, come with feature 007"), and the plans of 002 (movement types, `exception_event`, service items), 003 (`sale_return`, `defective` location), 005 (permissions, approvals) and 006 (deliveries).

**Build order** (002 research D16): 5 July to 1 August 2027, after 008. **Scope**: US1 to US3 (P1, MVP). US4 (cycle count, reorder, dead stock) and US5 (rolls) are tagged V2 in the spec and PRD; US6 (licence meter V2 if needed, buying suggestions V3, outlet transfers Later). These are **not planned** here (constitution VII); each needs its own spec or a revision of this one when its release starts. The schema leaves room for them (D7).

## Decisions

### D1. Locations are a tree; racks are sub-locations that hold stock

- **Decision**: `location` gains `parent_id`. Top-level locations: Shop floor (seeded in 001), Godown, Defective (003), Tinted returns (002), plus any the owner adds (a second godown). Racks are child locations (`kind = 'rack'`), for example R1 to R20 under Shop floor and G1 to G10 under Godown, as the architecture's `LOCATION ||--o{ LOCATION : sub_location` shows.
- **Where a sale takes stock from**: each counter has a sale location (default Shop floor). A sale takes stock from the variant's **home location** if it lies inside the counter's sale location (for example R3 under Shop floor), else from the sale location itself. The home location is set by the owner or by the first count of that item on a rack.
- **Lookup** shows quantity per location and the total; a parent's figure is the sum of its subtree.
- **Rationale**: FR-003 and spec US1 scenario 4 ask for user-defined racks and godowns "created and used", and US2 counts by rack. Treating racks as plain labels would make "stock in R3" impossible.
- **Owner decision OD-1**: whether racks should hold stock (this design) or be count areas only (simpler: stock per top-level location, racks as labels). Recommendation: this design, because it is the architecture's and the counts need it; if the owner says count areas only, `kind = 'rack'` rows simply hold no stock and counting uses the item's rack label.

### D2. A transfer is one movement with both locations

- **Decision**: `movement_type = 'transfer'` with `from_location_id` and `to_location_id` both set and different; totals do not change (US1 scenario 1). 001's CHECK "exactly one location" became 002's rule trigger reading the type's `direction` (002 research D17), so `transfer` is a lookup row with direction `both`: in and out movements keep exactly one, `transfer` needs both.
- **Rejected for now**: the architecture's two linked rows (`transfer_out`, `transfer_in`) with a transit location. That serves outlet-to-outlet transfers with "in transit" (FR-STK-018, Later); inside one shop nothing is in transit. The movement types `transfer_out` and `transfer_in` are reserved in the CHECK for that later feature.

### D3. Movement types after this feature

Existing: `opening`, `adjustment`, `sale`, `sale_cancel`, `merge_in`, `merge_out` (002), `edit_reverse`, `sale_return` (003). Added here: `transfer`, `damage`, `count_correction`. Added by 009: `purchase`, `purchase_return`, `warranty_out`, `warranty_in`. `site_return` waits for site returns (003 V2). Each addition is an INSERT into 002's `movement_type` lookup (002 research D17), never a table rebuild.

### D4. Stock balance per location as a checked projection

- `stock_balance(variant_id, location_id, qty_base_milli, first_counted_at, last_movement_at)`, updated in the same transaction as each movement (architecture 11.3). `item_variant.stock_milli` stays as the total cache (001).
- A check at start and nightly compares both caches with the sums of movements for every variant and location (SC-005); a difference raises an `exception_event` and the cache is rebuilt from movements, never the other way round.

### D5. Counts apply from a timestamp

- `count_session(kind, location_id, status, started_at, closed_at)` with `kind` `opening` (this feature) and `cycle` (reserved for V2), and `count_line(session_id, variant_id, location_id, counted_qty_milli, counted_at, user_id)`.
- Marking a rack done posts, per line, a `count_correction` movement of `counted - book quantity at counted_at` (zero differences post nothing). Book quantity at a time = sum of the variant's movements at that location with `occurred_at <= counted_at`. Sales after `counted_at` still apply, so "counts while sales happen" lose nothing (spec edge case).
- **Example**: R3 holds 40 pipes on the books at 10:00; the helper counts 37 at 10:05; a sale of 2 at 10:10. Posting gives a correction of -3 (from 40 to 37 at 10:05); the 10:10 sale still takes 2, leaving 35.
- **Uncounted**: a variant and location with no `first_counted_at` shows "Uncounted", not 0 (FR-005). Opening quantities entered in 001 and 002 set `first_counted_at` (they were counts).
- **Progress**: racks done over racks with at least one assigned item.
- **Approval**: opening counts are posted by roles with `stock.count`; their corrections do not need the adjustment approval (they are the opening load). After the go-live date setting, a correction above the adjustment threshold needs the same approval as an adjustment (owner decision OD-2).

### D6. Adjustments and negative stock

- An adjustment needs `reason_code` from the list (`damage`, `theft`, `count_error`, `sample`, `personal_use`, `tinting_waste`, `other`; the PRD's five plus the architecture's two) and the `stock.adjust` permission (005). `other` needs a note. Value = quantity x cost per base unit (002 purchase price or batch landed cost); above 005's threshold an approval of kind `stock_adjust_over_threshold` is consumed in the movement's transaction. Damage moves to the Defective location (`damage` type, from the item's location to Defective) instead of leaving stock, so damaged goods stay visible.
- Negative stock never blocks a sale (FR-007). A movement that takes a balance below zero raises one open `exception_event` of kind `negative_stock` for that variant and location; it resolves itself when the balance returns to zero or above. Two offline counters selling the last unit (EC-02) both save; the second device's sale arrives by sync (010), and the exception appears then.

### D7. Room for the V2 items without building them

Reserved now so V2 needs no data move: `stock_movement.roll_id` (nullable), `item_variant.is_sold_from_rolls` (0 default), `count_session.kind = 'cycle'`, `licence_limit` is not created (built only if Phase 0 shows need, spec assumption). Reorder level already exists (002 `reorder_level_milli`).

### D8. Stock lookup

One query returns, per variant: quantity per location (with "Uncounted"), total, last purchase price (002 `purchase_price_paise`, later 009's last receipt), last sale date (002 `item_sales_stat.last_sold_at`) and open rolls (always "none" until rolls exist; the column is hidden when the variant is not sold from rolls).

## Open items

| ID   | Item                                                                                             | Resolve by                                 | Milestone |
| ---- | ------------------------------------------------------------------------------------------------ | ------------------------------------------ | --------- |
| OI-1 | Rack names and count per location in the real shop                                               | Owner walk-through                         | M1        |
| OI-2 | Adjustment value threshold for owner approval                                                    | Owner (005 setting)                        | M4        |
| OI-3 | Whether the licence meter (FR-STK-016) is needed: petroleum stock held versus the shop's licence | Owner's licence document (spec assumption) | Before V2 |

## Owner decisions needed

| ID   | Question                                                              | Recommendation     | Needed by |
| ---- | --------------------------------------------------------------------- | ------------------ | --------- |
| OD-1 | Racks hold stock (sub-locations) or are labels                        | Sub-locations (D1) | M1        |
| OD-2 | After go-live, do count corrections above the threshold need approval | Yes                | M3        |

## References

- Architecture reference sections 7.6 and 11.3 (`docs/reference/architecture.md`).
- Martin Fowler, "Event Sourcing" (current state derived from an append-only log, with snapshots as caches): https://martinfowler.com/eaaDev/EventSourcing.html (primary author's writing).
- Industry practice: Odoo Inventory models warehouses with nested locations (shelves as child locations) and records every change as a stock move between two locations (https://www.odoo.com/documentation/17.0/applications/inventory_and_mrp/inventory/warehouses_storage/inventory_management/use_locations.html, primary vendor documentation). Shopify's inventory model records quantity per location and adjustments with reasons (https://shopify.dev/docs/apps/build/orders-fulfillment/inventory-management-apps, primary vendor documentation). Cycle counting by ABC class is standard warehouse practice (APICS dictionary; secondhand summaries only), which is why the V2 proposal weights by value and speed.
