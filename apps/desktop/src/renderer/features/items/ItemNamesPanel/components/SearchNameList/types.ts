import type { ISearchName } from "@shopos/core";

export type IEditedName = Pick<ISearchName, "name" | "language" | "kind">;

export interface ISearchNameListProps {
  names: readonly IEditedName[];
  onChange: (names: IEditedName[]) => void;
}
