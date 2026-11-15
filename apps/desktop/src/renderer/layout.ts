/**
 * Sizes that no Radix token expresses (design guidelines section 8, rule 2). They are passed to
 * Radix layout props, never to an inline `style`, and live in one place so every screen agrees.
 */
export const LAYOUT = {
  navWidth: "200px",
  pageNarrow: "640px",
  pageMedium: "900px",
  pageWide: "1000px",
  formColumnMinWidth: "320px",
  searchFieldWidth: "360px",
  seriesFieldWidth: "140px",
  paymentSelectMinWidth: "160px",
  discountFieldWidth: "100px",
  lineDiscountFieldWidth: "90px",
  quantityColumnWidth: "110px",
  rateColumnWidth: "130px",
  discountColumnWidth: "230px",
  amountColumnWidth: "130px",
  actionColumnWidth: "90px",
} as const;
