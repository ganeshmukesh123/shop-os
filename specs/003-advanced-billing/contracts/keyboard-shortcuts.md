# Contract: counter keyboard shortcuts (FR-002, research D15)

Function keys are used so typing in the search box never triggers a shortcut. The table lives in one file (`apps/desktop/src/renderer/features/billing/shortcuts.ts`) and the help panel is drawn from it, so the two never disagree. Labels are screen text and go in the strings file (feature 014 translates them).

| Key                   | Action                                                    | Works when                   |
| --------------------- | --------------------------------------------------------- | ---------------------------- |
| F1                    | Show shortcuts                                            | Always                       |
| F2                    | New bill (asks to hold or discard a non-empty bill)       | Bill screen                  |
| F3                    | Hold bill                                                 | Bill has at least one line   |
| F4                    | Recall held bill                                          | Held bills exist             |
| F5                    | Quotation mode (same screen, saves a quote)               | Bill screen                  |
| F6                    | Return mode                                               | Bill screen                  |
| F7                    | Customer (search by name or phone, quick-add)             | Bill screen                  |
| F8                    | Pay (tender panel)                                        | Bill has at least one line   |
| F9                    | Save and print                                            | Tenders match the total      |
| F10                   | Save without printing                                     | Tenders match the total      |
| Esc                   | Close the open panel or grid                              | A panel or grid is open      |
| Up, Down, Left, Right | Move in the variant grid or result list                   | Grid or list open            |
| Enter                 | Add the top match or the selected grid cell at quantity 1 | Search box or grid           |
| Ctrl+D                | Line discount on the selected line                        | A line is selected           |
| Ctrl+Shift+D          | Bill discount                                             | Bill screen                  |
| Ctrl+B                | Switch batch on the selected line                         | Line has more than one batch |
| Ctrl+U                | Record unmet demand                                       | Search shows "No match"      |

The focus returns to the search box after every line is added (FR-001).
