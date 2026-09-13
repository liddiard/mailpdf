/**
 * Format a number of cents as a USD currency string.
 * @param number amount in cents
 * @returns e.g. "$1.99"
 */
export const formatMoney = (number: number): string => '$' + (number / 100).toFixed(2)
