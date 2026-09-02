import type { TenantAdminRouteParams } from "./types";

export const buildTenantAdminHref = (
  params: Partial<TenantAdminRouteParams> = {},
): string => {
  const searchParams = new URLSearchParams();

  if (params.membershipId) {
    searchParams.set("membershipId", params.membershipId);
  }

  const queryString = searchParams.toString();
  return queryString.length > 0 ? `/tenant-admin?${queryString}` : "/tenant-admin";
};

export const readTenantAdminRouteParams = (
  searchParams: URLSearchParams,
): TenantAdminRouteParams => ({
  membershipId: searchParams.get("membershipId"),
});
