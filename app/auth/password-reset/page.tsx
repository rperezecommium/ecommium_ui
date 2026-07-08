import { StorefrontPasswordResetClient } from "../../../src/modules/storefront/password-reset-client";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PasswordResetPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const token = first(query?.token);

  return <StorefrontPasswordResetClient token={token} />;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
