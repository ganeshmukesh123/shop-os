import { Tabs } from "@radix-ui/themes";
import { GridTable } from "../GridTable";
import type { IGridTabsProps } from "./types";

const tabName = (tabAxes: Record<string, string>) => Object.values(tabAxes).join(" ");

/** With 3 or 4 axes, each combination of axes 3 and 4 is a tab over the same grid (D15). */
export function GridTabs({ tabs, items, onPick }: IGridTabsProps) {
  if (tabs.length === 1) return <GridTable tab={tabs[0]!} items={items} onPick={onPick} />;
  return (
    <Tabs.Root defaultValue="0">
      <Tabs.List>
        {tabs.map((tab, tabIndex) => (
          <Tabs.Trigger key={tabName(tab.tabAxes)} value={String(tabIndex)}>
            {tabName(tab.tabAxes)}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {tabs.map((tab, tabIndex) => (
        <Tabs.Content key={tabName(tab.tabAxes)} value={String(tabIndex)}>
          <GridTable tab={tab} items={items} onPick={onPick} />
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
