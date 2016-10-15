module.exports = {

  // https://github.com/enyo/dropzone/issues/438#issuecomment-128824773
  setupDragon: function(uploader) {
    /* A little closure for handling proper
       drag and drop hover behavior */
    var dragon = (function (elm) {
      var dragCounter = 0;

      return {
        enter: function (event) {
          event.preventDefault();
          dragCounter++;
          elm.classList.add('dz-drag-hover')
        },
        leave: function (event) {
          dragCounter--;
          if (dragCounter === 0) {
            elm.classList.remove('dz-drag-hover')
          }
        }
      }
    })(uploader.element);

    uploader.on('dragenter', dragon.enter);
    uploader.on('dragleave', dragon.leave);
  },

  formatMoney(number) {
    return '$' + (number/100).toFixed(2);
  }

};
