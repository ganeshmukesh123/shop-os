/** Screen text for the bill's family search rows and variant grid (spec 002 T038, T039). */
export const billGridText = {
  familyRow: "Family: choose a variant",
  title: "Choose from {family}",
  cell: "{variant}: {price}, {quantity} in stock",
  negative: "Negative stock",
  inactive: "Inactive",
  notStocked: "Not stocked",
  tab: "{values}",
  unitFor: "Unit for {item}",
  baseQuantity: "({quantity} {unit})",
} as const;
