import { useEffect, useState } from "react";
import type { IBrand, ICategory, IUnit } from "@shopos/core";
import { call, messageOf } from "../../../shared/api/api";

export interface ICatalogueLists {
  units: IUnit[];
  categories: ICategory[];
  brands: IBrand[];
  isLoaded: boolean;
  error: string | null;
}

const EMPTY: ICatalogueLists = {
  units: [],
  categories: [],
  brands: [],
  isLoaded: false,
  error: null,
};

/** The shop's units, categories and brands (catalogue.*), read once when `isWanted` turns true. */
export function useCatalogueLists(isWanted: boolean): ICatalogueLists {
  const [lists, setLists] = useState<ICatalogueLists>(EMPTY);
  useEffect(() => {
    if (!isWanted) return;
    let isCurrent = true;
    Promise.all([
      call("catalogue.units.list", {}),
      call("catalogue.categories.list", {}),
      call("catalogue.brands.list", {}),
    ])
      .then(([{ units }, { categories }, { brands }]) => {
        if (isCurrent) setLists({ units, categories, brands, isLoaded: true, error: null });
      })
      .catch((caughtError) => {
        if (isCurrent) setLists({ ...EMPTY, error: messageOf(caughtError) });
      });
    return () => {
      isCurrent = false;
    };
  }, [isWanted]);
  return lists;
}
