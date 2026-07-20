import Link from "next/link";
import { StorefrontActivationForm } from "../../../src/modules/storefront/storefront-activation-form";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountActivatePage({ searchParams }: PageProps) {
  const query = await searchParams;
  const token = first(query?.token) ?? "";

  return (
    <main className="storefrontAuthPage">
      <section className="storefrontAuthPanel">
        <Link className="storefrontAuthBackLink" href="/">
          Ecommium
        </Link>
        {token ? (
          <StorefrontActivationForm token={token} />
        ) : (
          <>
            <h1>No pudimos activar la cuenta</h1>
            <p>El enlace de activación no contiene un token válido.</p>
            <Link className="storefrontAuthSubmit storefrontAuthPanelLink" href="/">
              Volver a la tienda
            </Link>
          </>
        )}
      </section>
    </main>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
