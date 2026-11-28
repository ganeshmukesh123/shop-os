/** What the owner typed into the search fields; an empty string means "do not filter on this". */
export interface IBillFilter {
  number: string;
  from: string;
  to: string;
  customer: string;
}
