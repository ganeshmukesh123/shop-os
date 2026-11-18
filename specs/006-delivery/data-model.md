# Data Model: Delivery

Builds on 001's target shape and the data models of 002 (items, `kind`), 003 (bill versions, `bill_tender`, `tender_resolution`, `unmet_demand`, returns), 004 (parties) and 005 (users, permissions, audit, `cash_entry`). Conventions unchanged. Decisions in `research.md` D1 to D10.

## Overview

```
bill (by bill_no) 1--0..1 delivery 1--* delivery_event (status history)
                             |  1--0..1 delivery_proof
                             |  1--* challan_print *--1 challan
                             |  *--0..1 delivery_rate (area or band)
driver 1--* delivery_event   vehicle 1--* delivery_event
driver 1--* driver_handover --> cash_entry (005, kind driver_handover)
bill_tender (mode cod) 1--0..1 tender_resolution (kind collected, driver_id)
```

## New tables

### `delivery`

| Field                | Rule                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| bill_no              | text, not null; with `shop_id` identifies the bill document; `UNIQUE(shop_id, bill_no)` (one delivery per bill in this release) |
| planned_bill_version | integer, the version the delivery was planned from                                                                              |
| party_id             | nullable FK (004)                                                                                                               |
| contact_name         | text 1-60                                                                                                                       |
| contact_phone        | 10 digits                                                                                                                       |
| address_line         | text 1-200                                                                                                                      |
| area                 | text up to 60                                                                                                                   |
| state_code           | 2 digits, not null (inter-state check)                                                                                          |
| site_label           | text up to 80, nullable (contractor site; sites as records are V2)                                                              |
| preferred_date       | `YYYY-MM-DD`                                                                                                                    |
| slot_code            | from the slot setting                                                                                                           |
| rate_id              | nullable FK to `delivery_rate`                                                                                                  |
| charge_paise         | integer 0 or more (0 when waived)                                                                                               |
| is_charge_waived     | 0 or 1; when 1, `waived_by` and an audit entry are required                                                                     |
| notes                | text up to 200                                                                                                                  |

Address fields may be corrected before the delivery is out (audited); not after.

### `delivery_event` (append-only)

`delivery_id`, `status` (`pending`, `out_for_delivery`, `delivered`, `failed`, `rescheduled`, `closed_returned`), `reason` (required for `failed`), `new_date` (required for `rescheduled`), `driver_id` and `vehicle_id` (required for `out_for_delivery`), `return_id` (003 `sales_return`, required for `closed_returned`), `user_id`, `occurred_at`.

### `delivery_proof` (append-only)

`delivery_id` unique, `receiver_name` 1-60, `photo_path` and `signature_path` (at least one), `delivered_at`, `entered_by`, `channel` (`counter`, `phone`).

### `delivery_rate`

`kind` (`area`, `distance_band`), `label` (1-40, unique per kind), `charge_paise` 0 or more, `is_active`.

### `driver` and `vehicle`

`driver`: `name` 1-60, `phone`, `staff_party_id` nullable (004), `is_active`. `vehicle`: `registration_no` (up to 15, upper case), `label`, `is_active`.

### `challan` and `challan_print` (append-only)

`challan`: `challan_no` from `number_series` `doc_kind` `challan`, `UNIQUE(shop_id, challan_no)`, at most 16 characters; `delivery_id`; `bill_version`; `with_prices` (0 or 1). `challan_print`: `challan_id`, `printed_at`, `user_id`, `is_duplicate` (1 for every print after the first).

### `driver_handover` (append-only)

`driver_id`, `business_date`, `amount_paise` above 0, `cash_session_id` (005), `user_id`, `occurred_at`; written with a 005 `cash_entry` of kind `driver_handover` in one transaction.

## Changed tables

- `item_family.kind` (002) adds `service`; stock folding and movement writers skip `service` variants. Seeded family and variant "Delivery charge" (unit `pcs`, decimals off, price 0; the line price comes from the rate).
- `bill_tender.mode` (003) adds `cod`; `status` adds `pending_collection`.
- `tender_resolution.kind` (003) adds `collected` with `driver_id` and `collected_mode` (`cash`, `upi`) and `reference` for UPI.
- `cash_entry.kind` (005) adds `driver_handover` (positive).
- `unmet_demand` (003) adds `reason` (`not_available` default, `referred_inter_state`) and `value_paise` (nullable).
- `role_permission` (005) seeds `delivery.waive` (Owner allow, Manager allow, Counter request, others deny) and `delivery.dispatch` (Owner, Manager allow).
- `number_series.doc_kind` adds `challan`.

## Derived values (in `@shopos/core`)

- `nextDeliveryStatus(current, event)`; `currentDeliveryStatus(events)`.
- `deliveryCharge({ rate, isWaived })`.
- `driverCashPosition({ collections, handovers })` returning collected, handed in and difference per driver.
- `isBillChangedSinceChallan(currentVersion, challanVersion)`.

## Indexes

- `delivery(preferred_date)`, `delivery(shop_id, bill_no)` unique.
- `delivery_event(delivery_id, occurred_at)`.
- `driver_handover(driver_id, business_date)`; `tender_resolution(driver_id)`.
