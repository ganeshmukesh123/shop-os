/** The most characters each shop detail may hold; the same limits `settings.update` enforces. */
export const TEXT_LIMITS = {
  name: 80,
  address: 200,
  phone: 20,
  series: 8,
  template: 40,
  footer: 200,
} as const;
