export const buildInvestigationHref = (skuId: string, locationId: string): string => {
  const params = new URLSearchParams({
    skuId,
    locationId,
  });

  return `/investigation?${params.toString()}`;
};
