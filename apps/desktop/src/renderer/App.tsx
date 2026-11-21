import { useEffect, useState } from "react";
import { Box, Button, Flex, Text } from "@radix-ui/themes";
import { ClockWarnings } from "./components/ClockWarnings/ClockWarnings";
import { useClockWarnings } from "./components/ClockWarnings/useClockWarnings";
import { LAYOUT } from "./layout";
import { StatusBadge } from "./shared/components/StatusBadge/StatusBadge";
import { ItemsScreen } from "./screens/ItemsScreen";
import { NewBillScreen } from "./screens/NewBillScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { uiText } from "./strings";
import { call } from "./state/api";

type Route = "items" | "bill" | "settings";

export function App() {
  const [route, setRoute] = useState<Route>("bill");
  const [negatives, setNegatives] = useState(0);
  const clockWarnings = useClockWarnings(route);

  // Keyboard: Ctrl/Cmd+1..3 to switch screens.
  useEffect(() => {
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (!(keyboardEvent.ctrlKey || keyboardEvent.metaKey)) return;
      const map: Record<string, Route> = { "1": "items", "2": "bill", "3": "settings" };
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
          {route === "settings" && <SettingsScreen />}
        </main>
      </Box>
    </Flex>
  );
}
