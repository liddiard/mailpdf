import type { CalculateCostParams, Costs } from './types.ts'

/**
 * Pricing configuration shared by the client and server.
 * All costs are in cents.
 */
export const costs: Costs = {
  base: 199,
  maxFreePages: 5,
  overMaxFreePages: 149,
  overMaxFreePagesPerPage: 15,
  maxPages: 60,
  certifiedMail: 499,
  registeredMail: 1650,
  returnEnvelope: 49
}

/**
 * Calculate the total cost in cents for a mailing order.
 * @param options order details used for pricing
 * @returns total cost in cents
 */
export const calculateCost = ({
  numPages,
  mailType,
  returnEnvelope
}: CalculateCostParams): number => {
  let total = costs.base
  if (numPages > costs.maxFreePages) {
    total += costs.overMaxFreePages
    total += (numPages - costs.maxFreePages) * costs.overMaxFreePagesPerPage
  }
  if (mailType === 'registered') {
    total += costs.registeredMail
  } else if (mailType === 'certified') {
    total += costs.certifiedMail
  }
  if (returnEnvelope) {
    total += costs.returnEnvelope
  }
  return total
}
