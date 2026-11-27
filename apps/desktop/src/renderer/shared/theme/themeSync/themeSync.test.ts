import { planThemeSync } from "./themeSync";

// Spec 018 T035: the database holds the choice; localStorage is only a first-paint cache.
describe("planThemeSync", () => {
  it("shows the database choice and refreshes the cache when one is saved", () => {
    const syncPlan = planThemeSync({ savedTheme: "dark", cachedPreference: "light" });

    expect(syncPlan).toEqual({ preferenceToShow: "dark", preferenceToCopy: undefined });
  });

  it("copies the old localStorage choice into the database once, when nothing is saved yet", () => {
    const syncPlan = planThemeSync({ savedTheme: null, cachedPreference: "dark" });

    expect(syncPlan).toEqual({ preferenceToShow: "dark", preferenceToCopy: "dark" });
  });

  it("copies System when there was no old choice either, so the copy happens only once", () => {
    const syncPlan = planThemeSync({ savedTheme: null, cachedPreference: "system" });

    expect(syncPlan).toEqual({ preferenceToShow: "system", preferenceToCopy: "system" });
  });
});
