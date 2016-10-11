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
    let total = this.costs.base;
    if (options.numPages > this.costs.maxFreePages) {
      total += this.costs.overMaxFreePages;
      total += (options.numPages - this.costs.maxFreePages) * this.costs.overMaxFreePagesPerPage;
    }
    if (options.mailType === 'registered') {
      total += this.costs.registeredMail;
    }
    else if (options.mailType === 'certified') {
      total += this.costs.certifiedMail;
    }
    if (options.returnEnvelope) {
      total += this.costs.returnEnvelope;
    }
    return total;
  }

};
