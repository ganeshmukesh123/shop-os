/** Data issues (spec 002 T052). */
export const dataIssuesText = {
  open: "Data issues",
  title: "Data issues",
  description: "Things in the item list that need a look, such as one barcode on two items.",
  openTab: "Open",
  resolvedTab: "Resolved",
  issue: "Issue",
  about: "About",
  items: "Items",
  action: "Action",
  kinds: {
    duplicate_barcode: "Shared barcode",
    duplicate_suspect: "Possible duplicate",
  } as Record<string, string>,
  resolve: "Resolve",
  note: "What was done",
  confirm: "Mark resolved",
  noteRequired: "Say what was done about it.",
  emptyOpen: "No open issues.",
  emptyResolved: "No resolved issues.",
  errorLabel: "Error",
};
