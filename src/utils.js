/**
 * Format a number of cents as a USD currency string.
 * @param {number} number amount in cents
 * @returns {string} e.g. "$1.99"
 */
export const formatMoney = number => '$' + (number / 100).toFixed(2)
