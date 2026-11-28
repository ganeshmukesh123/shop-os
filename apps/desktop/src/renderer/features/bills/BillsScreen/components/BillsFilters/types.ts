import type { IBillFilter } from "../../types";

export interface IBillsFiltersProps {
  filter: IBillFilter;
  onChange: (nextFilter: IBillFilter) => void;
}
