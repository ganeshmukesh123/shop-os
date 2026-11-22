import type { ReactElement } from "react";
import { Theme } from "@radix-ui/themes";
import { render, type RenderResult } from "@testing-library/react";
import { RADIX_THEME_SETTINGS } from "../../src/renderer/shared/theme/constants";

/** Renders a component inside the Radix `Theme` it needs, with the app's theme settings. */
export function renderWithTheme(
  element: ReactElement,
  appearance: "light" | "dark" = "light",
): RenderResult {
  return render(
    <Theme appearance={appearance} {...RADIX_THEME_SETTINGS}>
      {element}
    </Theme>,
  );
}
