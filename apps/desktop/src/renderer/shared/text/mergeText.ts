/** Merge and merge log text (spec 002 T051). {item}, {survivor}, {quantity} and {total} are filled in. */
export const mergeText = {
  open: "Merge",
  title: "Merge {item} into another item",
  description:
    "Use this when the same item was entered twice. Its stock, codes and names move to the item you keep.",
  findSurvivor: "Find the item to keep",
  survivorLabel: "Item to keep",
  noMatches: "No other item in the same unit matches.",
  moves: "{quantity} {unit} move to {survivor}, which will then have {total} {unit}.",
  billsStay: "Bills already saved keep showing {item}. It can be undone for 30 days.",
  reason: "Reason",
  reasonRequired: "Say why these items are merged.",
  survivorRequired: "Choose the item to keep.",
  merge: "Merge",
  errorLabel: "Error",
  merged: "Merged into {survivor}",
};
