/**
 * Permissions the app may grant. Empty on purpose: the counter app needs none. A later feature
 * (015 barcode scanning needs the camera) adds one named entry here, with its own test.
 */
export const ALLOWED_PERMISSIONS: ReadonlySet<string> = new Set<string>();
