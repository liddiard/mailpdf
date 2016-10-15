const cost = {

  // all costs in cents
  costs: {
    base: 199,
    maxFreePages: 5,
    overMaxFreePages: 149,
    overMaxFreePagesPerPage: 15,
    maxPages: 60,
    certifiedMail: 499,
    registeredMail: 1650,
    returnEnvelope: 49
  },

  calculateCost: function(options) {
    let total = cost.costs.base;
    if (options.numPages > cost.costs.maxFreePages) {
      total += cost.costs.overMaxFreePages;
      total += (options.numPages - cost.costs.maxFreePages) * cost.costs.overMaxFreePagesPerPage;
    }
    if (options.mailType === 'registered') {
      total += cost.costs.registeredMail;
    }
    else if (options.mailType === 'certified') {
      total += cost.costs.certifiedMail;
    }
    if (options.returnEnvelope) {
      total += cost.costs.returnEnvelope;
    }
    return total;
  }

};

module.exports = cost;