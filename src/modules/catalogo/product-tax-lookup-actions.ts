"use server";

import { getAdminContext } from "../../shared/config/admin-context";
import { getPricingTaxes, toTaxLookupOption } from "./pricing-admin";

export async function reloadProductTaxesAction() {
  const result = await getPricingTaxes(await getAdminContext());
  return {
    ok: result.source === "bff",
    taxes: result.data.map(toTaxLookupOption).filter((tax): tax is NonNullable<typeof tax> => Boolean(tax)),
    message: result.message,
  };
}
