import Link from "next/link";
import { activateStorefrontCustomer } from "../../../src/modules/storefront/storefront-auth-actions";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountActivatePage({ searchParams }: PageProps) {
  const query = await searchParams;
  const result = await activateStorefrontCustomer(first(query?.token) ?? "");

  return (
    <main className="storefrontAuthPage">
      <section className="storefrontAuthPanel">
        <Link className="storefrontAuthBackLink" href="/">
          Ecommium
        </Link>
        <h1>{result.status === "success" ? "Cuenta activada" : "No pudimos activar la cuenta"}</h1>
        <p>{result.message}</p>
        <Link className="storefrontAuthSubmit storefrontAuthPanelLink" href="/">
          Volver a la tienda
        </Link>
      </section>
    </main>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
