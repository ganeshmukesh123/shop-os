import { useEffect, useState } from "react";
import { Box, Button, Flex, Text } from "@radix-ui/themes";
import { LAYOUT } from "../../shared/constants/layout";
import { StatusBadge } from "../../shared/components/StatusBadge/StatusBadge";
import { ItemsScreen } from "../../features/inventory/ItemsScreen";
import { NewBillScreen } from "../../features/billing/NewBillScreen";
import { BillsScreen } from "../../features/bills/BillsScreen";
import { SettingsScreen } from "../../features/settings/SettingsScreen";
import { TintingScreen } from "../../features/tinting/TintingScreen";
import { uiText } from "../../shared/text/strings";
import { call } from "../../shared/api/api";
import { ClockWarnings } from "../ClockWarnings/ClockWarnings";
import { useClockWarnings } from "../ClockWarnings/useClockWarnings";
import type { Route } from "./types";

export function App() {
  const [route, setRoute] = useState<Route>("bill");
  const [negatives, setNegatives] = useState(0);
  const clockWarnings = useClockWarnings(route);

  // Keyboard: Ctrl/Cmd+1..5 to switch screens.
  useEffect(() => {
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (!(keyboardEvent.ctrlKey || keyboardEvent.metaKey)) return;
      const map: Record<string, Route> = {
        "1": "items",
        "2": "bill",
        "3": "settings",
        "4": "bills",
        "5": "tinting",
      };
      const shortcutRoute = map[keyboardEvent.key];
      if (shortcutRoute) {
        keyboardEvent.preventDefault();
        setRoute(shortcutRoute);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    call("items.list", { needsCorrection: true, limit: 1, offset: 0 })
      .then((listResult) => setNegatives(listResult.total))
      .catch(() => {});
  }, [route]);

  const nav: [Route, string][] = [
    ["items", uiText.nav.items],
    ["bill", uiText.nav.newBill],
    ["bills", uiText.nav.bills],
    ["tinting", uiText.nav.tinting],
    ["settings", uiText.nav.settings],
  ];
  return (
    <Flex height="100vh">
      <Flex direction="column" gap="2" p="3" width={LAYOUT.navWidth} className="shopos-nav" asChild>
        <nav aria-label="Main">
          <Text size="5" weight="bold" mb="3">
            {uiText.appName}
          </Text>
          {nav.map(([navigationRoute, label]) => (
            <Button
              key={navigationRoute}
              size="3"
              variant={route === navigationRoute ? "solid" : "soft"}
              onClick={() => setRoute(navigationRoute)}
              aria-current={route === navigationRoute ? "page" : undefined}
              className="shopos-nav-button"
            >
              {label}
              {navigationRoute === "items" && negatives > 0 && (
                <Box as="span" ml="2">
                  <StatusBadge
                    role="warning"
                    label={`${negatives} ${uiText.items.needsCorrection}`}
                  />
                </Box>
              )}
            </Button>
          ))}
        </nav>
      </Flex>
      <Box flexGrow="1" p="4" overflow="auto" asChild>
        <main>
          <ClockWarnings warnings={clockWarnings} />
          {route === "items" && <ItemsScreen />}
          {route === "bill" && <NewBillScreen />}
          {route === "bills" && <BillsScreen />}
          {route === "tinting" && <TintingScreen />}
          {route === "settings" && <SettingsScreen />}
        </main>
      </Box>
    </Flex>
  );
}
