import { Flex, Heading, Tabs } from "@radix-ui/themes";
import { uiText } from "../../../shared/text/strings";
import { ShadeLibrary } from "../ShadeLibrary";
import { TintCharges } from "../TintCharges";

/** Tint charges and the shade library (spec 002 T066). */
export function TintingScreen() {
  const text = uiText.tinting;
  return (
    <Flex direction="column" gap="4">
      <Heading size="6">{text.title}</Heading>
      <Tabs.Root defaultValue="charges">
        <Tabs.List>
          <Tabs.Trigger value="charges">{text.chargesTab}</Tabs.Trigger>
          <Tabs.Trigger value="shades">{text.shadesTab}</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="charges">
          <TintCharges />
        </Tabs.Content>
        <Tabs.Content value="shades">
          <ShadeLibrary />
        </Tabs.Content>
      </Tabs.Root>
    </Flex>
  );
}
