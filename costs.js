const cost = {

  costs: {
    base: 1.99,
    maxFreePages: 5,
    overMaxFreePages: 1.49,
    overMaxFreePagesPerPage: 0.15,
    maxPages: 60,
    registeredMail: 4.99,
    certifiedMail: 16.50,
    returnEnvelope: 0.49
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