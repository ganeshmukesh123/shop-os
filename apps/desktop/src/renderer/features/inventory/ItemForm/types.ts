import type { Item } from "@shopos/core";

export interface IItemFormProps {
  /** The item to edit; leave out to add a new one. */
  item?: Item;
  onClose: () => void;
  onDone: () => void;
}
