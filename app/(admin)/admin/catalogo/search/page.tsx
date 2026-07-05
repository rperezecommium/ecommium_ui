import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import { getSearchAdminData, type SearchAdminFilters } from "../../../../../src/modules/search/search-admin";
import { SearchAdminPage } from "../../../../../src/modules/search/search-admin-page";

type SearchPageProps = {
  searchParams?: Promise<SearchAdminFilters>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const context = await getAdminContext();
  const filters = await searchParams ?? {};
  const data = await getSearchAdminData(context, filters);

  return <SearchAdminPage context={context} data={data} filters={filters} />;
}
