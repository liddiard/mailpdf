/**
 * Pricing configuration shared by the client and server.
 * All costs are in cents.
 */
export const costs = {
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
 * @param {{numPages: number, mailType: string, returnEnvelope: boolean}} options
 * @returns {number} total cost in cents
 */
export const calculateCost = ({ numPages, mailType, returnEnvelope }) => {
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
