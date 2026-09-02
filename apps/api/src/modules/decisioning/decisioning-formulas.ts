export interface RoundRecommendedOrderQuantityInput {
  rawQuantity: number;
  minOrderQty: number;
  casePackQty: number | null;
}

export const roundRecommendedOrderQuantity = (input: RoundRecommendedOrderQuantityInput): number => {
  if (input.rawQuantity <= 0) {
    return 0;
  }

  const moqAdjustedQuantity = Math.max(input.rawQuantity, input.minOrderQty);
  if (!input.casePackQty || input.casePackQty <= 1) {
    return moqAdjustedQuantity;
  }

  return Math.ceil(moqAdjustedQuantity / input.casePackQty) * input.casePackQty;
};

export const calculateProjectedShortfallQty = (requiredQty: number, availableQty: number): number =>
  Math.max(0, Math.ceil(requiredQty - availableQty));

export const calculateDailyAverageForecastQty = (forecastQty: number, horizonDays: number): number =>
  horizonDays > 0 ? forecastQty / horizonDays : 0;

export const calculateDaysOfCover = (availableQty: number, forecastQty: number, horizonDays: number): number | null => {
  const dailyAverageForecastQty = calculateDailyAverageForecastQty(forecastQty, horizonDays);
  if (dailyAverageForecastQty <= 0) {
    return null;
  }

  return Number((availableQty / dailyAverageForecastQty).toFixed(2));
};

export const sumForecastQuantities = (
  forecastQuantities: number[],
  input: { horizonDays: number },
): number => forecastQuantities.slice(0, input.horizonDays).reduce((sum, value) => sum + value, 0);
