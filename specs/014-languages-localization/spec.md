# Feature Specification: Languages and Localization

**Feature Branch**: `014-languages-localization`

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "English at launch, with all screen text kept separate so Hindi and other regional languages can be added later; Hindi and trade names stay searchable; message templates in Hindi or English; Indian number and date formats."

**PRD source**: `docs/reference/PRD.md` decisions of 12 Nov 2026 (English first, regional languages later), NFR-012, FR-ITM-006, FR-ITM-007, FR-KHA-007, section 3 personas (Rajesh, Sunil, Ravi, Imran).

**Depends on**: Applies across every feature. The text-separation rule starts in 001; this spec covers adding the first non-English language and the rules that keep it safe.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Text kept separate from code (Priority: P1)

All screen text, messages, button labels, errors and print headings live in one place per language, not inside screens. Adding a language adds text files only.

**Why this priority**: The PRD decision of English first requires that adding Hindi later costs translation, not a rewrite; this must hold from the first screen.

**Independent Test**: Add a test language with a few strings and see them appear; find no hard-coded user-facing text in a scan of the screens.

**Acceptance Scenarios**:

1. **Given** a new language file, **Then** its text shows wherever translated and falls back to English for missing keys.
2. **Given** a scan of screens and messages, **Then** no user-facing text is hard-coded outside the text files.
3. **Given** a missing translation, **Then** English shows and the gap is listed for the translator.
4. **Given** text that includes numbers or names, **Then** placeholders keep word order correct in other languages.

---

### User Story 2 - Hindi and trade names in search and templates (Priority: P1)

Item search accepts Hindi (Devanagari), Hinglish and local trade names regardless of screen language. Reminder and statement message templates are available in Hindi or English, chosen per message.

**Why this priority**: These are already MVP requirements in the PRD and shape daily counter use.

**Independent Test**: Search an item by a Devanagari name and a Hinglish spelling; send a reminder in Hindi and in English.

**Acceptance Scenarios**:

1. **Given** an item with a Devanagari name, **Then** typing it finds the item.
2. **Given** a Hinglish spelling with a one-letter typo, **Then** the item is still found.
3. **Given** the reminder action, **Then** the owner picks Hindi or English and the message preview shows the chosen text.
4. **Given** Devanagari text, **Then** it displays and prints without broken characters.

---

### User Story 3 - Indian formats (Priority: P1)

Numbers use Indian grouping (1,00,000), currency shows the rupee symbol, dates and financial years follow Indian practice (financial year 1 April to 31 March), and amounts in words on bills follow Indian numbering when used.

**Why this priority**: Wrong grouping or dates make bills and reports look untrustworthy and cause misreading.

**Independent Test**: Display 12345678.5 and a date across screens, reports, exports and printed bills and see the same format everywhere.

**Acceptance Scenarios**:

1. **Given** the amount 1234567.5, **Then** it shows as 12,34,567.50 on screens and bills.
2. **Given** a date, **Then** day-month-year order is used consistently.
3. **Given** an Excel export, **Then** numbers stay numeric, not text, with the grouping applied only in display.

---

### User Story 4 - Switch the screen language (Priority: P2)

A user can choose English or Hindi for their own screens once a Hindi text file exists. Bill language and message templates are chosen separately from the screen language.

**Why this priority**: Staff such as the helper may prefer Hindi; bills may need to stay in English.

**Independent Test**: Switch one user to Hindi and see their screens change while another user and the printed bill stay English.

**Acceptance Scenarios**:

1. **Given** a language setting per user, **Then** only that user's screens change.
2. **Given** the bill language setting per shop, **Then** printed bills follow it regardless of the user's screen language.

---

### Edge Cases

- Long Hindi words overflowing buttons: layouts allow wrapping and are checked in the Hindi review.
- Mixed-script item names (English brand, Hindi type): search works on each part.
- A language with a different numeral system: numerals stay Western digits unless the owner chooses otherwise.
- Receipt printers that cannot print Devanagari: the bill falls back to an image or English and the user is warned (see 015).
- Right-to-left languages: not supported in the first release.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All user-facing text MUST be stored outside screens, one set per language, with English as the default and fallback (NFR-012).
- **FR-002**: System MUST let items carry multiple search names in Devanagari, Hinglish and trade names, matched regardless of screen language (FR-ITM-006, FR-ITM-007).
- **FR-003**: System MUST offer reminder and statement templates in Hindi or English (FR-KHA-007).
- **FR-004**: System MUST format numbers with Indian grouping, dates day-month-year, and financial year 1 April to 31 March (NFR-012).
- **FR-005**: System MUST display and print Devanagari text correctly on screens, A4/A5 bills and receipts where the printer supports it.
- **FR-006**: System SHOULD let each user choose their screen language and the shop choose the bill language separately.
- **FR-007**: System MUST list missing translations for a language so a translator can complete them.
- **FR-008**: Exports MUST keep numbers and dates in machine-readable form.

### Key Entities

- **Language Pack**: Language code, text keys and values, completeness.
- **Search Name**: Item name variant with script (from 002).
- **Message Template**: Purpose, language, text with placeholders.
- **User Language Setting / Shop Bill Language**: Preferences.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Adding a test language requires zero code changes in a trial.
- **SC-002**: 95% of 50 searches by Hindi, Hinglish or trade name select the intended item in the top 3.
- **SC-003**: A Hindi reminder reaches a party correctly formatted in 100% of 20 test sends.
- **SC-004**: Zero amounts display without Indian grouping in a scan of all screens, reports and bills.
- **SC-005**: A Hindi speaker completes a 5-line bill unaided after the same training as English users (NFR-010).

## Assumptions

- Hindi is the first additional language; other regional languages follow when a pilot shop needs them.
- Translation is done by a person fluent in the shop trade, not by machine translation alone.
- Language of legal wording on bills (for example the composition header) stays in English until the CA confirms otherwise.
- Print support for Devanagari depends on printer capability and is settled in 015.
