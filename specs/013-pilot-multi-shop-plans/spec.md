# Feature Specification: Pilot with Other Shops, Multi-Shop Separation and Paid Plans

**Feature Branch**: `013-pilot-multi-shop-plans`

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "After the owner's shop is stable, offer Shop OS to about 10 nearby similar shops: recruit, onboard with a visit, support by WhatsApp group, review usage weekly, measure retention and willingness to pay, then offer paid plans. Every record already belongs to a business and shop; this feature makes that separation real and adds onboarding and plans."

**PRD source**: `docs/reference/PRD.md` sections 1 (decisions of 12 Nov 2026, first customer, second 10 shops, then paid plans), 2 (BO-6), 3 (non-goals), 15 (pilot, risks, success metrics, constraints on pricing), NFR-016.

**Depends on**: Gate 3 passed (PRD: pilot only after Gate 3); 010 (server, accounts, sync) and 012 (onboarding procedures). Not started before March 2028 in the PRD plan.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Separate businesses and shops (Priority: P1)

Every record belongs to a business and a shop. Settings are per shop. No data is shared across businesses; users of one shop cannot see another shop's data.

**Why this priority**: Privacy and trust are required before any second shop is allowed on the system, and the PRD decided this from day one.

**Independent Test**: Create two businesses with overlapping item names and users; confirm one cannot read, search or export the other's records, including through sync and exports.

**Acceptance Scenarios**:

1. **Given** two businesses on the same server, **Then** queries, reports, exports, sync and backups from one never include the other's data.
2. **Given** a user in business A, **Then** they cannot access shop-level settings or records of business B even by guessing identifiers.
3. **Given** a shop's registration, invoice series and tax settings, **Then** they are per shop (FR-CMP-017).
4. **Given** a business with several shops, **Then** each shop has its own locations, settings and bill series.

---

### User Story 2 - Onboard a pilot shop (Priority: P1)

A pilot shop is created, data imported with the same tools as the owner's go-live, roles and limits set, staff trained, and the shop starts billing, with one onboarding visit and a support group.

**Why this priority**: The pilot proves the product works for shops other than the builder's.

**Independent Test**: Onboard a test shop from empty to first real bill using the checklist in under a day of work, without the builder editing the database by hand.

**Acceptance Scenarios**:

1. **Given** a new shop, **Then** an onboarding checklist guides import, settings, training and first bill.
2. **Given** the shop's category mix (electrical, plumbing, paint, tools, hardware), **Then** a starter catalogue or template can be imported.
3. **Given** a shop not yet using features such as tinting or delivery, **Then** they can stay switched off without clutter.
4. **Given** a problem report from a pilot shop, **Then** it reaches the builder with shop and screen tags.

---

### User Story 3 - Usage review and retention measures (Priority: P1)

The builder reviews each pilot shop's usage weekly: days active, bills, share of sales in the system, overdue khata and support issues. At week 8 the system shows how many shops are active 5+ days a week.

**Why this priority**: The pilot's goal is a measured yes or no on retention and willingness to pay (BO-6: 7 of 10 each).

**Independent Test**: With generated activity for 10 shops, see the weekly review and the week-8 retention count.

**Acceptance Scenarios**:

1. **Given** each pilot shop, **Then** weekly figures show active days, bill count and share of sales billed in the system.
2. **Given** week 8, **Then** the count of shops active 5+ days a week is shown against 7 of 10.
3. **Given** usage figures, **Then** they use only aggregate, non-personal data and respect each shop's privacy settings.

---

### User Story 4 - Paid plans and willingness to pay (Priority: P2)

At week 8 the builder offers paid plans and records which shops accept. A free tier covers basic billing; charges apply to hardware-specific value. Plan limits (for example devices, shops or features) are enforced without ever stopping a shop from billing or reading its own data.

**Why this priority**: Business objective BO-6 requires a willingness-to-pay signal; pricing must respect that basic billing apps cost about 0 to 4,000 rupees a year for mobile apps (PRD constraint).

**Independent Test**: Offer a plan to a test shop, record acceptance, and confirm a lapsed plan limits premium features but never blocks billing or data export.

**Acceptance Scenarios**:

1. **Given** a plan offer, **Then** the shop's decision (accepted, declined, later) is recorded with date.
2. **Given** a free tier, **Then** basic billing, stock and khata work without payment.
3. **Given** a lapsed paid plan, **Then** premium features pause but billing, backups and data export still work.

---

### Edge Cases

- A pilot shop leaves: their data is exported for them and then erased on request, keeping what law requires.
- A shop with two locations: modelled as two shops in one business.
- A contractor appears in two pilot shops: no linkage, each shop's party record is separate.
- A shop wants a feature not in the PRD: logged to a backlog, not built during the pilot.
- A support request touches data: the builder needs access that is logged and time-limited.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every record MUST carry a business id and a shop id, and no query, report, export, sync or backup MAY return another business's data (PRD decision, NFR-008).
- **FR-002**: Settings, registration, invoice series, tax settings, limits and locations MUST be per shop (FR-CMP-017, NFR-016).
- **FR-003**: System MUST provide an onboarding checklist for a new shop covering import, settings, training and first bill.
- **FR-004**: System SHOULD offer a starter catalogue or import template by category.
- **FR-005**: System MUST let the builder see per-shop usage figures (active days, bill count, share of sales in the system) without reading customer-level data.
- **FR-006**: System MUST show retention (shops active 5+ days a week at week 8) and willingness to pay (acceptances) for the pilot.
- **FR-007**: System MUST support plans with a free tier for basic billing; lapsed plans MUST NOT block billing, backup or data export.
- **FR-008**: System MUST allow a shop to export all its data and request erasure, keeping records the law requires.
- **FR-009**: Access by the builder to a shop's data for support MUST be logged and limited in time.
- **FR-010**: Problem reports from pilot shops MUST reach the builder tagged with shop, user and screen.

### Key Entities

- **Business / Shop**: Tenant and location with settings and registration.
- **Pilot Cohort / Shop Status**: Recruitment, onboarding and review state.
- **Onboarding Checklist**: Steps and completion.
- **Usage Summary**: Aggregate weekly figures per shop.
- **Plan / Subscription / Offer**: Plan limits, state and decision record.
- **Support Access Grant**: Who accessed which shop, why and for how long.
- **Data Export / Erasure Request**: Request, status and what was kept.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a security test with two businesses, zero records cross the boundary through any screen, report, export, sync or backup.
- **SC-002**: A pilot shop goes from empty to its first real bill within one working day of onboarding.
- **SC-003**: At week 8, 7 of 10 pilot shops are active 5+ days a week.
- **SC-004**: 7 of 10 pilot shops agree to a paid plan.
- **SC-005**: Pilot shops' share of sales billed in the system reaches 95% within 4 weeks of their start.

## Assumptions

- The pilot starts no earlier than March 2028 and only after Gate 3 (PRD).
- Shops are recruited through the owner's distributors and are free during the pilot; one onboarding visit and a WhatsApp support group are provided.
- Prices and plan limits are decided from pilot results; no pricing is fixed in this spec.
- Self-signup stays out of scope for the pilot; the builder creates shops.
- The server and accounts needed come from 010; this feature adds tenant checks, onboarding and plan records on top.
