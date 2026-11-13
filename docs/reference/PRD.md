# Shop OS: Product Requirements Document (reference copy)

> **Source**: the PRD text pasted into the Claude Code session on 2026-11-13. The live PRD is the Claude doc at https://claude.ai/artifact/AKgDATymSF32BAJHJWX4ds. That link could not be exported when this file was written (service timeouts), so if the live doc has changed since the paste, re-export it and replace this file.
>
> **Reading guide**: IDs such as FR-BIL-012 mean functional requirement, Billing area, number 12. Areas: ITM items, TNT tinting, BIL billing, DLV delivery, STK stock, KHA khata and payments, PUR purchases and warranty, CTL control, OWN owner app, RPT reports, CMP compliance. US = user story, EC = edge case. Priority: M must, S should, C could. Release: MVP, V2, V3, Later.
>
> **Scope note (2026-11-13)**: the first build (`specs/001-shop-os-mvp`) is narrower than the PRD's MVP: inventory entry and a basic no-tax bill only. Everything else here is split into later feature specs.

## 1. Product overview

Shop OS is a billing, stock, credit and control system for a single Indian electrical, plumbing, paint, tools and hardware shop, later offered to similar shops. It must keep billing even when the internet fails.

- **Where it is used**: a counter app (computer or Android tablet), an owner app (Android phone) and a godown app (Android phone).
- **Core idea**: every business event (sale, purchase, return, payment, stock move) is recorded as an entry. Stock, balances and profit are worked out from those entries, so every number can be traced to its source.
- **What sets it apart**: variant grids (size x brand x shade), roll and cut-length tracking, contractor sites, distributor warranty claims, built-in shop rules (MRP cap, below-cost block, paint class, ISI capture), and offline billing that never loses a bill.
- **First customer**: your own shop. Second: 10 nearby shops in a pilot. Then paid plans.

### Decisions taken on 12 Nov 2026

| Decision | What it means for the product |
|---|---|
| For your shop first, other shops later | Every record belongs to a business and a shop from day one; settings are per shop and no data is shared across businesses. Self-signup, plans and onboarding tools wait for the pilot. |
| You will build it yourself | MVP is limited to what one person can build, test and support. Budget not set; assume low running cost. |
| May move between composition and regular GST | Both bill formats, HSN and GST rate on every item, dated tax rates and a scheme-switch wizard are in the MVP, so switching is a setting with an effective date. |
| You tint paint | Tinting requirements are in the MVP: base paints and colorants as stock, shade formulas, repeat shades, tinting charge. |
| You deliver goods | Delivery requirements are in the MVP: delivery bills, charges, challan, dispatch list, proof of delivery, cash collected by the driver. |
| English first, regional languages later | English at launch; screen text is kept so Hindi and regional languages can be added later. Item search names may still include Hindi and trade names. |

### Scope for a solo build

- MVP is the counter loop: items (variants, units, tinting), billing (price tiers, returns, quotes, delivery, both bill formats), stock by location, khata with WhatsApp statements, PIN-based roles and an owner summary.
- MVP+ (6-8 weeks after go-live): remote approvals on the phone, day-close polish and bulk reminders.
- Buy, don't build: WhatsApp sharing by link first, UPI QR from your bank, bank statement import as files. No custom AI or forecasting.
- Protect against a single point of failure: daily backups that can be restored without the builder, and a written guide so someone else can restore the shop's data.
- The shop is the test lab: a new version to the counter every 2 weeks; your own staff are the usability panel.

## 2. Background, problem and objectives

### Background

- **The shop**: sells thousands of items across electrical, plumbing, paint, tools and hardware to walk-in customers, contractors, electricians, plumbers and some dealers. Registered under the GST composition scheme. Has a shop and a godown. (Assumption: 3-8 staff, one counter; to confirm.)
- **Today**: billing, khata and stock are partly manual or in a generic app. The owner listed 43 recurring challenges; a shop-day walk surfaced about 80 more likely ones.
- **Market**: hardware retail is fragmented and contractor purchases on credit are common. Brands such as Polycab and Ashirvad run their own electrician and plumber loyalty apps.
- **Competition**: Vyapar, myBillBook, Khatabook, OkCredit, Tally, Busy, Marg, Zoho and GoFrugal cover GST billing, khata and basic stock. None track metres left on each roll, true variant matrices or distributor warranty claims.
- **Payments**: UPI is the dominant payment method, and fake payment screenshots remain a reported fraud.
- **Regulation**: composition scheme rules, Legal Metrology (MRP, verified measures), BIS/ISI marking, Petroleum Act storage classes and the DPDP Act (main duties from 13 May 2027) all shape the requirements.

### Problem

Owners of Indian hardware shops lose money and time every day because the shop's physical reality (thousands of variants, rolls cut by the metre, credit to contractors, warranty swaps, licence-limited paint) is not captured by any system they use. As a result:

- Stock numbers can't be trusted, so items run out or pile up as dead stock.
- Credit is tracked in books and memory, so money is collected late or not at all.
- Margin leaks through short rolls, unclaimed warranty replacements, missing freight in cost, extra discounts and below-cost bills.
- Billing slows in rush hours and stops when the internet fails.
- The owner can't see or control the shop when away.

**Solved when**: the owner trusts one daily view of sales, cash, stock, credit and claims; 95% of sales go through the system; overdue credit and stock-outs fall measurably.

### Business objectives

| # | Objective | Measure | Target and timing |
|---|---|---|---|
| BO-1 | Run the shop on one trusted system | Share of sales billed in Shop OS with stock deducted | 95% within 4 weeks of go-live |
| BO-2 | Release cash stuck in credit | Khata overdue more than 30 days | Down 30% within 90 days of go-live |
| BO-3 | Stop margin leakage | Gross margin after returns, claims and landed cost, visible weekly | Leakage sources identified by V2; claim recovery tracked by V3 |
| BO-4 | Reduce lost sales | Stock-out days on top 100 items | Down 50% within 90 days of V2 |
| BO-5 | Owner control when away | Days the owner checks the Today card | 6 of 7 days |
| BO-6 | Prove a product for other shops | Pilot shops active daily after 8 weeks; willing to pay | 7 of 10 shops |

All targets are goals, not measurements. Baselines are measured in Phase 0 discovery and targets reset then.

## 3. Users, goals and release scope

### Target users

| Persona | Role in the product | Goals | Frustrations | Design implications |
|---|---|---|---|---|
| Rajesh, owner (45) | Admin; approves risky actions; reads reports | Know cash, stock, credit and profit; stop leaks; grow | Can't leave the shop; distrusts numbers; staff misuse | Phone-first Today card; every number tappable; approvals on phone |
| Sunil, senior counter staff (32) | Bills, quotes, returns, khata entries | Serve fast in rush hours; not be blamed for mistakes | Slow search; wrong prices; customers arguing about balances | Keyboard-first billing; variant grid; prices auto-filled; clear audit trail |
| Ravi, helper / godown (22) | Receives goods, finds and moves stock, counts racks | Find items quickly; finish receiving without paperwork | Doesn't know where goods are; typing on small screens | Scan-first phone app; location tags; one rack count at a time |
| Imran, electrical contractor (customer) | Receives quotes, bills, statements via WhatsApp | Correct rates, site-wise bills, honest balance | Disputes about balances; mixed bills across sites | WhatsApp PDFs; site-wise statements; contractor price tier |
| Mehta, CA (external) | Receives exports | Clean sales and purchase data each quarter | Messy data from shop | One-click quarterly export; Tally-compatible format |

Names are illustrative; personas are assumptions until Phase 0 interviews.

### Pain points addressed

The MVP targets daily problems that leak money and daily friction at the counter. The areas where Shop OS differs most from generic apps (rolls, warranty claims, buying suggestions) follow in V2-V3, once stock and purchase data are trustworthy.

### Goals

1. Billing at least as fast as the shop's current method, online or offline.
2. One stock record by location that the owner trusts for the top 200 items.
3. A credit ledger per party with limits, ageing and WhatsApp collection.
4. Owner control: approvals, audit log, cash day-close, phone view.
5. Shop-specific rules enforced at the counter (MRP cap, below-cost block, sealed packs).
6. Ready for rolls, warranty claims, multiple locations and regular GST without rework.

### Non-goals

| Not doing | Reason | Revisit when |
|---|---|---|
| Full accounting (balance sheet, TDS, payroll) | CA uses Tally; we export instead | Never, unless pilot shops demand it |
| Filing GST returns in the app | Composition filing is quarterly and simple; CA does it | After regular GST switch |
| Brand-style points and gift catalogue | Brands already run these for electricians and plumbers | Not planned |
| Online store and delivery app | Needs trusted stock first; WhatsApp catalogue tests demand | After Gate 3 |
| AI demand forecasting | Too little history; simple rules work better at first | After 12 months of data |
| Manufacturing, job work, tinting machine integration | Not part of the current shop | If you start tinting machine integration |

### Release scope by module

| Module | MVP (go-live) | V2 (+3 months) | V3 (+6 months) | Later |
|---|---|---|---|---|
| Items | Families, variants, units, names, MRP per batch, paint class, barcode, import, duplicates, paint tinting | ISI/BIS number, kits, substitutes | Item notes and know-how | WhatsApp catalogue |
| Billing | Fast offline bill, tiers, split payment, UPI confirmation, returns, quotes, Bill of Supply, print/WhatsApp, unmet demand, delivery | Partial delivery, site returns | Quote from photo or list | Regular GST invoice mode (if switched) |
| Stock | Movements by location, opening stock by rack, adjustments with reason | Cycle count, reorder, dead stock, rolls, licence meter (if needed) | Buying suggestions | Multi-outlet transfers |
| Khata | Party ledger, limits, ageing, payments, WhatsApp statement | Promised dates, cheques, UPI matching, sites, commission | Contractor ranking | Credit scoring |
| Purchases | none | Receipts, landed cost, distributor ledger, price history, purchase returns | Warranty claims, schemes and rebates | Purchase orders to distributors by WhatsApp |
| Control and reports | Roles, approvals, audit log, cash close, owner Today card, backups, turnover tracker | Expenses, real profit, CA export | Targets, price impact, area map, GST simulator | Multi-shop dashboards |

## 4. User journeys

### Counter billing (MVP)

1. Staff open a new bill and search or scan an item; a family of variants opens a grid showing stock.
2. Price fills in from the customer's tier; discounts are checked against the staff member's limit.
3. Above-MRP lines are blocked outright. Below-cost, over-discount and over-credit lines go to the owner for approval; a rejected line returns to the bill for correction.
4. Staff take payment (cash, UPI, card, credit or a mix). UPI bills save at once but stay pending until the bank or soundbox reference is entered.
5. The bill is printed or sent on WhatsApp, and stock is reduced.

### Other MVP workflows

- **Return against a bill**: scan the bill QR or search by phone, pick lines and quantities, choose sellable or defective location, refund by cash, UPI or credit note, print. No bill found needs owner approval.
- **Quotation**: build like a bill, set validity, send on WhatsApp, customer returns, convert fully or partly, keep or refresh prices.
- **Collect payment**: owner opens the overdue list, sends WhatsApp statements with a UPI link, payment is received and applied to the oldest bills, a receipt is sent.
- **Day close**: manager counts cash by denomination, the system shows expected cash and the difference, a reason is recorded, pending UPI is listed, the owner is notified on the phone.
- **Opening stock**: pick a rack, scan items and enter counts, mark the rack done, repeat one rack a day.

### V2-V3 workflows

- **Receiving goods (V2)**: start a receipt, scan items, enter batch, MRP and price, add freight, mark short or damaged, save. Stock goes in, cost updates, the distributor ledger updates, and alerts fire for price rises, missing ISI numbers or paint limits.
- Roll lifecycle (V2) and warranty claims (V3) are described with their requirements below.

## 5. Features: items, catalogue and paint tinting

### Items and catalogue (ITM)

| ID | Requirement | Priority | Release |
|---|---|---|---|
| FR-ITM-001 | Items are stored as an item family (e.g. "PVC Pipe Supreme") with one or more variants. Each variant has up to 4 attributes chosen from: size, gauge, shade, pack size, colour, length, rating, brand. | M | MVP |
| FR-ITM-002 | Creating a family with attributes (e.g. size 0.5", 0.75", 1" x class 4, 6 kg) generates all variant combinations in one step; the user can delete combinations not stocked. | M | MVP |
| FR-ITM-003 | Each variant has: item code (automatic), barcode(s), HSN, GST rate, base unit, purchase price, selling price per tier, MRP (per batch), reorder level, location tag, active flag. | M | MVP |
| FR-ITM-004 | Unit conversions: a base unit and alternate units (e.g. base = metre, 1 roll = 90 m; base = pcs, 1 box = 10 pcs). Billing and purchase may use any defined unit. | M | MVP |
| FR-ITM-005 | A per-item decimal quantity setting controls whether fractional quantities are allowed (on for metre/kg, off for pcs and sealed packs). | M | MVP |
| FR-ITM-006 | An item may have multiple search names, including Hindi (Devanagari), Hinglish, and local trade names (e.g. "paipa", "bend", "elbow"). | M | MVP |
| FR-ITM-007 | Search tolerates 1-2 typos, matches any name, barcode or item code, and ranks by recent sales frequency. | M | MVP |
| FR-ITM-008 | On create, the system warns of likely duplicates (same brand, similar name, same attributes) and shows them before saving. | M | MVP |
| FR-ITM-009 | A merge tool combines two items, moving all history to the surviving one; merges are logged and reversible for 30 days. | S | MVP |
| FR-ITM-010 | Paint, thinner and solvent items carry a petroleum class (A, B, C, or not applicable), litres per unit, and a sealed-pack-only flag. | M | MVP |
| FR-ITM-011 | Items may carry a warranty period (months) and serial tracking (on/off). | M | MVP |
| FR-ITM-012 | Import of items and opening prices from Excel/CSV and Tally export, with a preview listing errors, duplicates and missing units before anything is saved. | M | MVP |
| FR-ITM-013 | Barcode label printing for items without manufacturer barcodes, and shelf location tags. | S | MVP |
| FR-ITM-014 | Electrical items under BIS orders carry an ISI licence number or BIS registration (R-) number, captured at purchase. | M | V2 |
| FR-ITM-015 | Kits (e.g. bathroom fitting set) bill as one line and deduct component stock. | S | V2 |
| FR-ITM-016 | Substitutes list per item, shown when stock is zero. | S | V2 |
| FR-ITM-017 | Item notes (compatibility, load rating, "suggest also") visible at the counter. | C | V3 |

### Paint tinting (TNT)

| ID | Requirement | Priority | Release |
|---|---|---|---|
| FR-TNT-001 | Base paints are items with brand, product, base type (e.g. white, pastel, deep, clear) and pack size; colorants are items stocked and used in ml. | M | MVP |
| FR-TNT-002 | Shade library: shade code, shade name, brand shade card, and a formula per product, base and pack size (colorant x quantity in ml). Formulas can be imported from Excel. | M | MVP |
| FR-TNT-003 | Bill a tinted paint: pick product, shade and pack size; the system picks the base and formula, shows colorant amounts for the tinter, and deducts 1 base can and the colorant ml from stock. | M | MVP |
| FR-TNT-004 | Price = base can price + tinting charge (fixed per pack size, configurable) or the brand's shade price list if loaded; colorant cost counts in landed cost for margin. | M | MVP |
| FR-TNT-005 | Custom shade: staff enter colorant amounts manually for a matched shade; saved as a custom formula with a name and the customer or site. | M | MVP |
| FR-TNT-006 | Repeat shade: a customer's or contractor site's previous shades are listed on their page and the bill, so "same as last time" is one tap. | M | MVP |
| FR-TNT-007 | Tinted paint is non-returnable by default; any return needs owner approval and goes to a "tinted returns" location at a reduced value. | M | MVP |
| FR-TNT-008 | Colorant stock in ml with low-level alerts; canister refills recorded as stock movements; monthly colorant usage vs formula usage to spot waste. | S | V2 |
| FR-TNT-009 | Import formula files or job logs from the tinting machine. | C | Later |

To confirm with your brand rep or local Legal Metrology office: tinting inside the sealed base can and selling it whole is common practice, but how the rules treat in-shop tinting is not yet confirmed.

## 6. Features: counter billing and delivery

### Counter and billing (BIL)

| ID | Requirement | Priority | Release |
|---|---|---|---|
| FR-BIL-001 | The counter opens on a new bill with the search box ready to type. | M | MVP |
| FR-BIL-002 | Adding a line: type 2+ characters or scan; Enter adds the top match with quantity 1; a variant family opens the variant grid (rows = one attribute, columns = another, cells show stock). | M | MVP |
| FR-BIL-003 | Keyboard shortcuts for new bill, hold, recall held bill, quotation, return, customer, pay and print; arrow keys and Enter navigate the grid. | M | MVP |
| FR-BIL-004 | Price fills from the customer's tier (Retail, Contractor, Dealer) or a customer-specific price if set; changing the tier reprices all lines. | M | MVP |
| FR-BIL-005 | Line-level discount (% or rupees) and bill-level discount, limited by the staff member's discount limit (FR-CTL-004). | M | MVP |
| FR-BIL-006 | A line priced above the batch MRP is blocked. | M | MVP |
| FR-BIL-007 | A line priced below landed cost is blocked unless the owner approves (PIN at the counter or remotely); the approval is logged. | M | MVP |
| FR-BIL-008 | Quantity must respect the item's unit and decimal setting; sealed-pack items accept whole numbers only. | M | MVP |
| FR-BIL-009 | Customer is optional for cash sales; required for credit, contractor tier or warranty items. Search by name or phone; quick-add with name, phone and consent tick. | M | MVP |
| FR-BIL-010 | Payment accepts cash, UPI, card, credit (khata) and combinations; shows change due for cash. | M | MVP |
| FR-BIL-011 | UPI: show a QR with the exact amount; mark payment Pending confirmation until (a) staff enter the reference from the shop's bank or soundbox alert, or (b) a connected payment provider confirms. Pending UPI appears in day-close and the Today card. | M | MVP |
| FR-BIL-012 | A credit sale beyond the customer's credit limit needs owner approval. | M | MVP |
| FR-BIL-013 | Bill numbers are unique per counter and financial year (e.g. C1/26-27/000123), so counters working offline never clash. | M | MVP |
| FR-BIL-014 | Bill format follows the shop's registration: composition Bill of Supply with the required header and no tax line; regular tax invoice when switched (FR-CMP-002). | M | MVP |
| FR-BIL-015 | Output: thermal receipt print, A4/A5 print, and WhatsApp share of the bill. A printer failure never blocks saving. | M | MVP |
| FR-BIL-016 | Hold up to 10 bills per counter and recall them. | M | MVP |
| FR-BIL-017 | Edit after save only on the same day and only by roles with permission; creates a new version; the previous version is kept in the audit log. | M | MVP |
| FR-BIL-018 | Cancel needs a reason and owner approval; cancelled bills keep their number and appear in the exceptions report. | M | MVP |
| FR-BIL-019 | Returns: select the original bill (by number, phone or scan of the printed QR); select lines and quantities; refund by cash, UPI or credit note; returned stock goes to the sellable or defective location. Returns without a bill need owner approval. | M | MVP |
| FR-BIL-020 | Quotation: same screen as a bill; validity date (default 7 days); share by WhatsApp; convert to a bill fully or partly with prices locked or refreshed (user's choice). Revisions keep version numbers. | M | MVP |
| FR-BIL-021 | Unmet demand: a one-tap "asked for, not available" entry with free text or item, offered from the search box when nothing matches. | S | MVP |
| FR-BIL-022 | Inter-state check: if a delivery address is outside the home state while registered under composition, the sale is blocked with an explanation. | M | MVP |
| FR-BIL-023 | Delivery challan and delivery charges; deliver part of a quote or bill; track pending quantities. | M | V2 |
| FR-BIL-024 | Site return: accept unused material from a contractor site against original bills, at original or revised price, with approval above a set value. | M | V2 |
| FR-BIL-025 | Quote from list: paste text or upload a photo of a material list; the system proposes matching items; staff confirm each line. | C | V3 |

### Delivery (DLV)

| ID | Requirement | Priority | Release |
|---|---|---|---|
| FR-DLV-001 | A bill can be marked To deliver with address, contact, site (for contractors) and preferred date and slot. | M | MVP |
| FR-DLV-002 | Delivery charge is added as a bill line; rates are configurable by area or distance band; can be waived with permission. | M | MVP |
| FR-DLV-003 | Delivery challan printed for the driver, with or without prices. | M | MVP |
| FR-DLV-004 | Dispatch list: deliveries by date with status Pending, Out for delivery, Delivered or Failed; assign vehicle and driver. | M | MVP |
| FR-DLV-005 | Proof of delivery on a phone: receiver name, photo of goods or signature, time; failed deliveries record a reason and return goods to stock if needed. | S | MVP |
| FR-DLV-006 | Cash collected on delivery is recorded against the driver and reconciled at day close. | M | MVP |
| FR-DLV-007 | Partial delivery against a bill or quote with pending quantities tracked (replaces FR-BIL-023). | M | V2 |
| FR-DLV-008 | Driver view on a phone with today's deliveries and map links. | S | V2 |

To confirm with your CA: whether an e-way bill is ever required for your intra-state deliveries depends on value and your state's rules; not yet researched.

## 7. Features: stock and cut-length rolls

| ID | Requirement | Priority | Release |
|---|---|---|---|
| FR-STK-001 | Stock is worked out from a permanent record of stock movements that cannot be altered. Movement types: opening, purchase, sale, sale return, purchase return, adjustment, damage, warranty-out, warranty-in, transfer-out, transfer-in, site return, count correction. | M | MVP |
| FR-STK-002 | Every movement records: item, batch (optional), quantity, from-location, to-location, linked document, user, device, time, and a reason for adjustments. | M | MVP |
| FR-STK-003 | Locations per shop: at least Shop floor, Godown and Defective bin; user-defined locations allowed (racks, a second godown). | M | MVP |
| FR-STK-004 | Stock lookup shows quantity by location, last purchase price, last sale date and open rolls. | M | MVP |
| FR-STK-005 | Opening stock by rack: user picks a rack, scans or searches items, enters counts; progress shows racks done vs total. Items not yet counted show "uncounted" instead of zero. | M | MVP |
| FR-STK-006 | Manual adjustment needs a reason from a list (damage, theft, count error, sample, personal use) and permission; adjustments above a value threshold need owner approval. | M | MVP |
| FR-STK-007 | Negative stock is allowed at the counter (so a sale is never blocked by bad data) but flagged in the exceptions list for correction. | M | MVP |
| FR-STK-008 | Cycle count: the system proposes 1 rack or 20 items a day, weighted to high-value and fast-moving items; mismatches go to owner review before posting. | M | V2 |
| FR-STK-009 | Reorder: reorder level per item (manual, or suggested from average daily sales x lead time + safety days); daily low-stock list grouped by distributor. | M | V2 |
| FR-STK-010 | Dead stock: items with no sale in 90/180/365 days, with stock value; filter by distributor and category. | M | V2 |
| FR-STK-011 | Roll tracking: items flagged "sold by length from rolls" get a roll record on receipt with labelled length and roll ID (printable label). | M | V2 |
| FR-STK-012 | When billing a roll item, the system suggests the open roll (oldest first); staff may choose another. Cut length reduces that roll's remaining length. Optional start and end metre marks. | M | V2 |
| FR-STK-013 | Close roll: staff enter the actual remaining length (often 0 or an offcut). The system records the length variance (expected remaining minus actual) against roll, item, batch and distributor. Offcuts can be kept as a new short roll. | M | V2 |
| FR-STK-014 | Cost per metre is recalculated on close using actual sold length; the variance appears in the margin report and the distributor scorecard. | M | V2 |
| FR-STK-015 | Rolls not touched in 60 days or with variance above a threshold (default 2%) are flagged. | S | V2 |
| FR-STK-016 | Paint licence meter: litres held per petroleum class per premises (stock x litres per unit) compared with the configured licence limits; warn at 85% on receipt or transfer; block above 100% unless the owner overrides with a reason. | S | V2 (if Phase 0 shows need) |
| FR-STK-017 | Buying suggestions: weekly list of what to buy, how much and from whom, using sales speed, lead time, same month last year, pack sizes and distributor price. | S | V3 |
| FR-STK-018 | Transfers between outlets with in-transit status and receive confirmation. | M | Later |

**Roll lifecycle.** The roll keeps an expected length that falls with every bill; closing it records the true shortfall, which corrects cost per metre and shows which distributors supply short rolls. Leftover offcuts can become a new short roll.

## 8. Features: credit (khata) and payments

| ID | Requirement | Priority | Release |
|---|---|---|---|
| FR-KHA-001 | Party types: Customer, Contractor, Dealer, Distributor, Staff (for advances). Fields: name, phone(s), address, area/pin code, GSTIN (optional), price tier, credit limit, credit days, referrer, consent status, notes. | M | MVP |
| FR-KHA-002 | Each party has a running ledger: bills, returns, payments, credit notes, opening balance, adjustments. Balance = sum of entries. | M | MVP |
| FR-KHA-003 | Ageing buckets: 0-30, 31-60, 61-90, 90+ days, worked out bill by bill (payments applied oldest first unless a bill is selected). | M | MVP |
| FR-KHA-004 | Credit limit and days: warn at 80% of limit; block above the limit or when any bill is past credit days, unless the owner approves. | M | MVP |
| FR-KHA-005 | Receive payment: cash, UPI (with reference), cheque, bank transfer; apply to bills automatically or manually; print or WhatsApp a receipt. | M | MVP |
| FR-KHA-006 | WhatsApp statement: one tap sends a statement (period, opening balance, bills, payments, closing balance) and a UPI payment link to the party's number. | M | MVP |
| FR-KHA-007 | Reminders: the owner can send reminders to all overdue parties in one action, with a message template in Hindi or English; each send is logged per party. | M | MVP |
| FR-KHA-008 | Opening balances import from Excel or old books, party by party, with a confirmation total. | M | MVP |
| FR-KHA-009 | Promised date: record "will pay X on date"; the party appears on that day's follow-up list; broken promises are counted. | S | V2 |
| FR-KHA-010 | Cheque register: cheque number, bank, date, amount, party; statuses Received, Deposited, Cleared or Bounced; post-dated cheques appear on their date; a bounce re-opens the bills and records charges. | M | V2 |
| FR-KHA-011 | UPI and bank matching: import the bank statement; auto-match by reference, amount and date; unmatched items listed for manual match. | M | V2 |
| FR-KHA-012 | Contractor sites: a contractor can have multiple sites (name, address); each bill is tagged to a site; statements and balances per site and in total. | M | V2 |
| FR-KHA-013 | Referral commission: rules per referrer (% of bill value, by category, excluding returns); commission accrues when the referred bill is fully paid; payout entries settle it. | S | V2 |
| FR-KHA-014 | Bad debt write-off with owner approval and reason. | S | V2 |

## 9. Features: purchases, distributors and warranty

| ID | Requirement | Priority | Release |
|---|---|---|---|
| FR-PUR-001 | Goods receipt: select distributor, scan or pick items, enter quantities, batch, MRP, purchase price; mark short, excess or damaged lines. | M | V2 |
| FR-PUR-002 | Landed cost: freight, unloading, cartage and other charges entered on the receipt are spread across lines by value (default) or quantity; item cost = purchase price + share of charges. | M | V2 |
| FR-PUR-003 | Purchase bill linked to one or more receipts; due date from distributor credit days; supports cash purchases without a GST bill (flagged). | M | V2 |
| FR-PUR-004 | Distributor ledger: purchases, returns, debit notes, payments, scheme credits; ageing and due-this-week list. | M | V2 |
| FR-PUR-005 | Price history: every purchase price per item per distributor is kept; alert when a new price is more than 2% (configurable) above the last; suggest a new selling price to keep the target margin. | M | V2 |
| FR-PUR-006 | Distributor comparison: for an item, show last price, average delivery days, short-supply rate and roll variance by distributor. | S | V2 |
| FR-PUR-007 | Purchase return and debit note for damaged, short or wrong goods, linked to the original receipt; status Raised, Sent, Accepted, Settled. | M | V2 |
| FR-PUR-008 | Capture the ISI/BIS number on receipt for BIS-mandatory items; warn if missing. | M | V2 |
| FR-PUR-009 | Schemes and rebates: per distributor, define slab or target schemes (e.g. 2% back above 5 lakh a quarter, free goods); the system tracks progress and expected credit. | S | V3 |
| FR-PUR-010 | Warranty register: every sale of a warranty item stores sale date, customer, serial or batch (if tracked) and warranty end date. | M | V3 (data captured from MVP) |
| FR-PUR-011 | Warranty case: the counter finds the sale; the system shows in or out of warranty; staff record the fault, give a replacement (stock out from sellable) and move the faulty item to the Defective bin with status Pending claim. | M | V3 |
| FR-PUR-012 | Distributor claim profiles: settlement type (instant swap, credit note, monthly batch), claim window in days, proof required (bill copy, box, photo), contact. | M | V3 |
| FR-PUR-013 | Claim pipeline: cases grouped by distributor into claims; statuses Pending, Sent, Approved or Rejected, Settled (swap received, credit note, cash); alert 7 days before the claim window ends. | M | V3 |
| FR-PUR-014 | Claims receivable per distributor appear in the distributor ledger and in real profit; rejected claims post as a loss with a reason. | M | V3 |
| FR-PUR-015 | Purchase orders sent to distributors over WhatsApp from the buying suggestion list. | C | Later |

**Warranty flow.** The replacement leaves sellable stock at once; the faulty unit waits in the Defective bin until the distributor settles or rejects the claim, so its value is never silently lost.

## 10. Features: control, owner app and reports

### Control (CTL)

| ID | Requirement | Priority | Release |
|---|---|---|---|
| FR-CTL-001 | Users log in with a 4-6 digit PIN; roles: Owner, Manager, Counter, Godown, Accountant (read and export). Permissions per role are editable (see the permissions table in section 15). | M | MVP |
| FR-CTL-002 | Auto-lock after 5 minutes idle (configurable); quick switch of user by PIN. | M | MVP |
| FR-CTL-003 | Approvals for: below-cost price, discount over limit, credit over limit, bill cancel, return without bill, stock adjustment over threshold, edit after save. Approval by owner PIN on the device or remotely from the owner app within 2 minutes; requests that time out leave the action unsaved. | M | MVP |
| FR-CTL-004 | Discount limit per role and per user (% and rupees per bill). | M | MVP |
| FR-CTL-005 | Audit log: every create, edit, cancel, approval, login, export and setting change with user, device, time, and before and after values; cannot be edited or deleted by any role; kept at least 7 years for bills and 1 year for access logs. | M | MVP |
| FR-CTL-006 | Cash drawer: opening float at day start; closing count by denomination; the system shows expected cash (cash sales + cash receipts - cash refunds - cash expenses - deposits); difference recorded with a reason; owner notified when the difference exceeds a set amount. | M | MVP |
| FR-CTL-007 | Day close summary: sales by payment mode, pending UPI, credit given, collections, returns, cancels, approvals, cash difference. | M | MVP |
| FR-CTL-008 | Problem report button on every screen: text, photo or voice note, tagged with screen and user; goes to a list for the owner and product team. | S | MVP |

### Owner app (OWN)

| ID | Requirement | Priority | Release |
|---|---|---|---|
| FR-OWN-001 | Today card: sales, cash in drawer (expected), UPI pending, credit given, collected, overdue khata; compared with the same day last week. | M | MVP |
| FR-OWN-002 | Every figure drills down to the list of documents behind it. | M | MVP |
| FR-OWN-003 | Alerts ranked by money at stake: pending approvals, cash difference, below-cost or cancelled bills, overdue parties, low stock (V2), claims expiring (V3), licence meter (V2). | M | MVP |
| FR-OWN-004 | Approve or reject requests with a reason; a phone notification arrives within 10 seconds when online. | M | MVP |
| FR-OWN-005 | Works on a phone with weak signal and shows how fresh the data is ("updated 2 minutes ago"). | M | MVP |

### Reports (RPT)

| ID | Requirement | Priority | Release |
|---|---|---|---|
| FR-RPT-001 | Sales by day, item, category, brand, staff, customer and payment mode; exportable to Excel. | M | MVP |
| FR-RPT-002 | Exceptions report: cancels, edits, discounts over limit, below-cost, negative stock, returns without bill. | M | MVP |
| FR-RPT-003 | Stock value at cost by location and category. | M | MVP |
| FR-RPT-004 | Expenses and owner drawings entry; expense categories. | M | V2 |
| FR-RPT-005 | Real profit: sales - returns - landed cost of goods sold - roll variance - rejected claims - write-offs - expenses; shows a "cost completeness" percentage when items lack purchase cost. | M | V2 |
| FR-RPT-006 | Distributor scorecard: price trend, delivery delay, short supply, roll variance, claim settlement time. | S | V2 |
| FR-RPT-007 | Contractor ranking: monthly purchase value, paid value, margin, overdue, by contractor and electrician referrer (for Diwali gifts). | S | V3 |
| FR-RPT-008 | Price change impact: units and margin 4 weeks before vs after a price change, per item. | S | V3 |
| FR-RPT-009 | Targets: monthly targets by shop, category and staff, with progress. | S | V3 |
| FR-RPT-010 | Customer area map by pin code (only parties with consent). | C | V3 |

## 11. Features: GST and compliance (CMP)

Rules below were confirmed by Nov 2026 research; confirm with your CA before go-live.

| ID | Requirement | Priority | Release |
|---|---|---|---|
| FR-CMP-001 | Composition Bill of Supply with the header "composition taxable person, not eligible to collect tax on supplies"; no tax amount shown. | M | MVP |
| FR-CMP-002 | Registration type setting (Composition / Regular) with an effective date; switching changes the bill format from that date and leaves past bills unchanged. | M | MVP |
| FR-CMP-003 | Turnover tracker for the financial year against the composition limit (default 1.5 crore, configurable for 75 lakh states); warnings at 80% and 95%. | M | MVP |
| FR-CMP-004 | CA export: quarterly turnover for CMP-08 (due 18th after quarter end) and annual data for GSTR-4 (due 30 June); purchases register; Tally-compatible format. Reminders 7 days before each due date. | M | V2 |
| FR-CMP-005 | MRP cap enforced per batch (FR-BIL-006). | M | MVP |
| FR-CMP-006 | Reminder to re-verify measuring tapes (every 24 months) and scales (every 12 months), with certificate date fields. | S | V2 |
| FR-CMP-007 | Customer data (DPDP Act): plain-language notice and consent tick at customer creation, separate consent for marketing messages; withdraw consent from the party page; data export and erasure requests handled (keeping bills required by GST law). Live before 13 May 2027. | M | MVP |
| FR-CMP-008 | Bills and ledgers cannot be deleted; kept at least 72 months from the annual return due date. | M | MVP |
| FR-CMP-009 | GST simulator: using the last 12 months, estimate tax, input credit and price effects under regular GST vs composition. | S | V3 |

### GST scheme switching

| ID | Requirement | Priority | Release |
|---|---|---|---|
| FR-CMP-010 | Both bill formats exist: Bill of Supply (composition) and Tax Invoice (regular, with CGST and SGST by HSN rate). The format follows the registration in force on the bill date. | M | MVP |
| FR-CMP-011 | Every item stores HSN and GST rate from day one, even under composition. Rates are dated, so a rate change applies from its effective date. | M | MVP |
| FR-CMP-012 | Purchase bills store the GST charged per line, so input credit can be calculated if you move to regular. | M | V2 |
| FR-CMP-013 | Scheme-switch wizard: set the effective date; start a new invoice series; produce a closing-stock statement with purchase tax for the credit claim when moving to regular, or the reversal when moving to composition; suggest new selling prices including GST. Confirm forms and amounts with your CA. | M | MVP |
| FR-CMP-014 | Regular-scheme exports for GSTR-1 and GSTR-3B (sales by rate, B2B by GSTIN). | M | V2, or earlier if you switch |
| FR-CMP-015 | Inter-state sales (IGST) allowed only when registered under the regular scheme. | M | MVP |
| FR-CMP-016 | Parties store GSTIN; under the regular scheme, invoices to registered contractors show their GSTIN so they can claim credit. | M | MVP |
| FR-CMP-017 | Registration, invoice series and tax settings are per shop. | M | MVP |

## 12. Quality expectations

Stated in terms of what the shop experiences.

| ID | Area | Expectation |
|---|---|---|
| NFR-001 | Speed | Item search feels instant (results in about a fifth of a second) with 50,000 items on an ordinary shop PC. |
| NFR-002 | Speed | Saving and printing a bill takes about 1 second, even offline. |
| NFR-003 | Speed | The owner's Today card opens within 3 seconds on a phone connection. |
| NFR-004 | Works offline | All MVP counter functions work for at least 7 days without internet; changes sync automatically within a minute of reconnecting. |
| NFR-005 | No lost bills | Zero lost or duplicated bills across counters working offline; if two counters change the same stock, both changes are kept. |
| NFR-006 | Backup | Encrypted cloud backup every 15 minutes when online; a daily copy to a second drive or USB; a lost computer can be replaced and restored in 30 minutes or less. |
| NFR-007 | Reliability | The counter never depends on the internet to bill; online services are available at least 99.5% of each month. |
| NFR-008 | Security | Shop data is protected in storage and in transit; PINs are never stored readably; the owner can remotely log out a lost device. |
| NFR-009 | Privacy | Customer consent records kept; access logs kept at least 1 year; a breach response plan exists (inform affected people and the Board, detailed report within 72 hours). |
| NFR-010 | Ease of learning | A new counter staff member bills 5 lines unaided after 2 hours of training. |
| NFR-011 | Accessibility | Large tap targets, readable text contrast, and no information shown by colour alone. |
| NFR-012 | Language | English at launch with room for Hindi and regional languages later; item search names may include Hindi and trade names; Indian number format (1,00,000). |
| NFR-013 | Devices | Works on Mac, Windows and Linux computers (first use on Mac) and Android phones and tablets; supports thermal receipt printers, USB barcode scanners and phone-camera scanning. |
| NFR-014 | Size | Per shop: 50,000 items, 5 counters, 5 locations, 500 bills a day and 10 years of data without slowing down. |
| NFR-015 | Traceability | Every number on a report can be traced to its source documents in 3 taps or fewer. |
| NFR-016 | Flexibility | Rules (limits, rates, classes) can be changed by the shop without a new release; tax rates carry effective dates. |

## 13. User stories and acceptance criteria

MVP stories are in full; V2-V3 stories are short.

**US-01 Fast cash bill** (Counter, MVP; FR-BIL-001-010). As counter staff, I want to bill a walk-in customer by typing a few letters, so that I serve the queue fast.
- Given a new bill, when I type "pip 1", then matching variants appear almost instantly, ranked by sales.
- Given I press Enter on a family, then the variant grid opens with stock in each cell.
- Given 5 lines are added and I pay cash 2,000 on a 1,850 bill, then change due shows 150, the bill saves and prints, and stock reduces by each line's quantity.
- Given the internet is off, the same steps succeed and the sync icon shows 1 pending.

**US-02 Contractor price** (Counter, MVP; FR-BIL-004). As counter staff, I want prices to change automatically for a contractor, so that I don't remember rates.
- Given a bill with retail prices, when I select a party with tier Contractor, then every line reprices and the total updates.
- Given the party has a customer-specific price for an item, then that price wins over the tier.

**US-03 MRP and cost guard** (Counter, Owner, MVP; FR-BIL-006/007)
- Given an item batch with MRP 450, when staff enter 460, then the line is blocked with "Above MRP 450".
- Given landed cost 300, when staff enter 290, then an approval request is needed; on owner approval the line saves and the approval appears in the audit log; on rejection or 2-minute timeout the line reverts.

**US-04 UPI confirmation** (Counter, Owner, MVP; FR-BIL-011). As the owner, I want UPI payments confirmed by my bank, not the customer's screen, so that fake screenshots don't cost me money.
- Given UPI is selected, the QR shows the exact amount.
- Given staff save without a reference, then the bill saves with UPI status Pending and appears on the Today card.
- Given staff enter the reference from the soundbox or bank alert, then status becomes Confirmed.
- Given a pending UPI is still unconfirmed at day close, then day close lists it and the owner is alerted.

**US-05 Credit sale with limit** (Counter, MVP; FR-KHA-004)
- Given a party with limit 50,000 and balance 45,000, when a 8,000 credit bill is attempted, then the sale needs owner approval.
- Given a party with a bill 15 days past credit days, then any new credit sale needs approval and the reason shows "Overdue bill #...".

**US-06 Return against bill** (Counter, MVP; FR-BIL-019)
- Given a printed bill with a QR, when staff scan it in Return mode, then the bill lines appear and staff choose quantities.
- Given refund by credit note, then the party ledger reduces by that amount and stock returns to the chosen location.
- Given no original bill can be found, then the return needs owner approval.

**US-07 Quotation to bill** (Counter, MVP; FR-BIL-020)
- Given a quote valid for 7 days, when converted on day 5, then prices stay as quoted; on day 9 staff choose keep or refresh prices.
- Given a quote is converted partly, then remaining quantities stay open on the quote.

**US-08 WhatsApp statement** (Owner, MVP; FR-KHA-006/007)
- Given 12 parties overdue, when the owner taps "Send reminders", then each receives a statement and UPI link, and each send is logged.
- Given a party has withdrawn marketing consent, then statements (transactional) still send but promotional messages don't.

**US-09 Cash day-close** (Manager, Owner, MVP; FR-CTL-006/007)
- Given expected cash 18,450, when the manager enters a count of 18,200, then the difference -250 is recorded with a required reason, and the owner is notified if above the set threshold.

**US-10 Owner Today card** (Owner, MVP; FR-OWN-001-003)
- Given the owner opens the app, then sales, cash, UPI pending, credit given, collected and overdue show with "updated x minutes ago".
- When the owner taps Sales, then the bills behind it list, and each opens the bill.

**US-11 Opening stock by rack** (Godown, MVP; FR-STK-005)
- Given rack R3 is selected, when the helper scans 25 items and enters counts, then those items become "counted" and rack R3 shows done; others remain "uncounted".

**US-12 Item import with duplicates** (Owner, MVP; FR-ITM-012/008)
- Given an Excel of 3,000 rows, then the preview shows rows OK, errors (missing unit, bad HSN) and likely duplicate groups before anything is saved.

**US-13 Cut from roll** (Counter, V2): billing 12 m of cable reduces the suggested open roll; closing a roll records variance against its distributor.

**US-14 Landed cost** (Godown, V2): entering 600 freight on a receipt spreads it over lines by value and updates item cost.

**US-15 Cheque bounce** (Owner, V2): marking a cheque bounced re-opens allocated bills, adds charges, and alerts the owner.

**US-16 Site-wise statement** (Owner, V2): a contractor receives one statement per site and a total.

**US-17 Warranty swap and claim** (Counter, Owner, V3): replacing a bulb moves the faulty unit to the Defective bin and into the distributor's next claim batch; the owner sees value pending per distributor.

## 14. Edge cases and error scenarios

| ID | Scenario | Expected behaviour |
|---|---|---|
| EC-01 | Internet drops mid-bill | Bill continues and saves on the counter; sync icon turns amber with a count; no prompt to the customer |
| EC-02 | Two offline counters sell the last unit of an item | Both sales save; stock goes to -1; the exceptions list flags it for count correction |
| EC-03 | Device lost or stolen | Owner remotely revokes the device; unsynced bills on it are reported as "at risk" with last sync time |
| EC-04 | Printer out of paper or offline | Bill saves; prompt to retry, WhatsApp, or reprint later from bill history |
| EC-05 | Customer shows UPI success screen but bank shows nothing | Bill stays UPI pending; staff may ask for another mode; day close flags it |
| EC-06 | UPI payment received twice | Bank matching (V2) flags the duplicate; refund or advance credit entry |
| EC-07 | Same barcode on two different items | Scan opens a chooser and logs a data issue for the owner to fix |
| EC-08 | Item with no purchase cost yet | Below-cost check skipped with a "cost unknown" badge; real profit shows cost completeness under 100% |
| EC-09 | Batch with two MRPs (old and new stock) | Billing picks the oldest batch; staff can switch batch; the MRP cap uses the selected batch |
| EC-10 | Owner unreachable for approval | Request times out after 2 minutes; staff can ask a Manager if the role has delegated approval |
| EC-11 | Return of an item sold at contractor price, by a retail customer | Refund at the original bill price, not today's price |
| EC-12 | Partial return of a kit | Refund prorated by component value; components return to stock |
| EC-13 | Roll cut longer than expected remaining | Allowed; remaining goes negative; roll flagged for close and variance |
| EC-14 | Cheque bounces after the party received more credit | Ledger reopens bills; party moves to "blocked for credit" until cleared |
| EC-15 | Composition turnover limit crossed mid-year | Banner from the crossing date; owner guided to the CA; registration setting changed with an effective date; bills after that date use the regular format |
| EC-16 | Inter-state delivery request under composition | Sale blocked with an explanation; owner can record it as a referral to another seller |
| EC-17 | Customer withdraws consent | Marketing stopped; transactional messages and bills retained as legally required |
| EC-18 | Staff tries to edit a bill from a previous day | Not allowed; return or credit note instead |
| EC-19 | Bill number gap after a crash | System detects gaps per counter series and lists them with reason "device crash" for audit |
| EC-20 | Time on a device is wrong | Server time is recorded alongside device time; owner alerted if the difference exceeds 10 minutes |
| EC-21 | Paint class limit would be crossed by a receipt (V2) | Receipt blocked above 100% unless owner overrides with a reason |
| EC-22 | Warranty claim window about to expire (V3) | Alert 7 days before; after expiry the case is marked lost and costed |

## 15. Dependencies, success, risks, rollout and appendix

### Dependencies and constraints

| Type | Item | Impact | Owner of action |
|---|---|---|---|
| Data | Item list, prices, party balances from current books or app | MVP go-live needs at least the top 500 items and all credit parties | Shop owner |
| Hardware | Counter computer or tablet, receipt printer, barcode scanner, backup power, owner Android phone | Required for MVP | Shop owner |
| Partner | WhatsApp sharing (links first; business messaging later) | Statements and bills | Product |
| Partner | UPI QR (static first, dynamic QR via payment provider) | FR-BIL-011 | Product, bank |
| Partner | Bank statement formats of the shop's bank | FR-KHA-011 | Product |
| Partner | Tally export format used by the CA | FR-CMP-004 | CA, product |
| Regulatory | Composition rules, Bill of Supply wording, due dates | Confirm with CA before MVP | Shop owner, CA |
| Regulatory | Paint licence classes and limits on your licence document | Needed before FR-STK-016 | Shop owner |
| Regulatory | BIS list of mandatory items | FR-PUR-008 item flags | Product |
| Regulatory | DPDP consent wording and processor contract | Before 13 May 2027 | Counsel |
| People | Staff time for 2 training sessions and a 4-week parallel run | Go-live | Shop owner |
| Team | You as solo builder and product owner; shop staff as testers; CA for tax checks | Timeline below | Sponsor |

Constraints: budget and team not yet confirmed; must run on low-cost hardware; must not slow billing; a composition dealer cannot sell inter-state; basic billing software in India costs about 0-4,000 rupees a year for mobile apps, which caps what other shops will pay for basics.

### Success metrics

North star: share of shop sales billed in Shop OS with stock deducted (target 95% by week 4 after go-live).

| Type | Metric | Definition | Target |
|---|---|---|---|
| Leading | Median bill time (5 lines) | Time from starting to saving a bill | No slower than today's method; aim for 45 s or less |
| Leading | Search success | Searches where a result is chosen in the top 3 | 90% or more |
| Leading | Owner engagement | Days per week the owner opens the Today card | 6 or more |
| Leading | UPI confirmed same day | Confirmed UPI payments / all UPI payments | 98% or more |
| Lagging | Stock accuracy | Top-200 items where count matches system within tolerance | 95% or more by day 60 |
| Lagging | Overdue khata | Value over 30 days | Down 30% in 90 days |
| Lagging | Stock-outs | Days top-100 items sit at zero | Down 50% in 90 days after V2 |
| Lagging | Margin leakage found | Value of roll variance, rejected claims, below-cost sales per month | Visible monthly (V2-V3) |
| Lagging | Claim recovery | Claim value settled / raised | 90% or more (V3) |
| Guardrail | Staff data-entry time | Minutes per day outside billing | Not higher than today |
| Guardrail | Cash difference | Absolute daily difference | Within an agreed small amount |
| Guardrail | Sync health | Days with unsynced data older than 24 hours | 0 |
| Business (pilot) | Retention | Pilot shops active 5+ days a week at week 8 | 7 of 10 |
| Business (pilot) | Willingness to pay | Shops agreeing to a paid plan | 7 of 10 |

Baselines are measured in Phase 0 discovery. Sales outside the system are estimated by comparing counted daily cash with system cash, and printed bill-book use if any.

### Risks and mitigation

| Risk | Likelihood | Impact | Mitigation | Early warning |
|---|---|---|---|---|
| Staff bypass the system in rush hours | High | High | Billing faster than today; champion staff; owner reviews the bypass estimate daily | Bill count vs footfall; cash difference |
| Dirty item data at import | High | High | Top 500 first; merge tool; rack-a-day counts | Duplicate warnings per day |
| Offline bills lost or duplicated | Medium | Very high | Permanent movement records; per-counter numbering; thorough offline testing before go-live | Sync conflict count |
| Rebuilding what existing apps do well | Medium | High | Build-vs-buy pilot in Phase 0 | Pilot results |
| Owner becomes an approval bottleneck | Medium | Medium | Delegate to the Manager role; tune thresholds after week 2 | Approval wait time |
| Compliance rule misread or changed | Medium | High | Configurable rules; CA and licensing office sign-off | Rule-change log |
| Scope creep from the long challenge list | High | Medium | Release tags locked at each gate; backlog reviewed weekly | Unplanned items per cycle |
| Hardware failure at counter | Medium | Medium | A second device can bill; backup power; spare printer | Device health check |
| Contractors resist WhatsApp statements | Low | Medium | Opt-out per party; print option | Opt-out rate |
| Other shops won't pay (pilot) | Medium | High (for product business) | Free tier for basics; charge for hardware-specific value; sell via distributors and CAs | Pilot willingness to pay |

### Rollout and release plan

Five phases, each ending in a gate. Planned for a solo builder working full-time; part-time work stretches each phase.

1. MVP build: 7 Dec 2026 to 31 May 2027.
2. MVP go-live: 1 June 2027 with a parallel run to 28 June; MVP+ by mid-August.
3. V2: to October 2027.
4. V3: to February 2028.
5. Pilot with other shops: from March 2028, only after Gate 3.

DPDP consent features are in the MVP because its duties start 13 May 2027, before go-live.

**Release practices.** A new version reaches the shop every 2 weeks; new features are switched on only after a 15-minute staff walkthrough. Each version must pass offline testing with no open defect that can lose or duplicate bills, and the previous version stays installable for rollback.

### Go-live in your shop

| When | Step | Done when |
|---|---|---|
| Go-live -14 days | Import items, parties, opening balances; clean duplicates | Top 500 items and all credit parties loaded |
| Go-live -7 days | Set tiers, roles, limits, MRP, paint classes; print shelf tags | Owner signs off settings |
| Go-live -7 to -1 days | Train each staff member (2 x 1 hour), name a champion | Each staff member bills 5 test bills unaided |
| Week 1 | Bill in Shop OS; old book for credit only; evening total check | Totals match daily |
| Weeks 1-4 | Count one rack a day | Top-200 accuracy measured |
| Week 2 | Stop old billing; owner reviews day close and approvals daily | No bills outside the system |
| Week 4 | Gate 1 review; fix top 3 complaints before new features | Gate 1 passed |

Fallback: a second device or the owner's phone can bill offline; a paper bill book stays in the drawer for the first month, back-filled the same day.

Pilot with other shops: 10 nearby shops recruited through your distributors; free during the pilot; one onboarding visit and a WhatsApp support group; weekly usage review; at week 8 offer paid plans and record who accepts.

### Permissions (default, editable)

| Action | Owner | Manager | Counter | Godown | Accountant |
|---|---|---|---|---|---|
| Create bill, quote | Yes | Yes | Yes | No | No |
| Discount up to own limit | Yes | Yes (10%) | Yes (3%) | No | No |
| Below-cost sale, cancel bill, return without bill | Yes | Approve if delegated | Request | No | No |
| Credit above limit | Yes | Request | Request | No | No |
| Receive payment | Yes | Yes | Yes | No | No |
| Receive goods, move stock, count rack | Yes | Yes | No | Yes | No |
| Stock adjustment | Yes | Up to threshold | No | Request | No |
| Edit prices, items, tiers | Yes | Yes | No | No | No |
| View profit and cost | Yes | Optional | No | No | Yes |
| Export data | Yes | No | No | No | Yes |
| Settings, users, rules | Yes | No | No | No | No |

Discount percentages are example defaults to be set by the owner.
