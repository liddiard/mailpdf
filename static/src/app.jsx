import React from 'react';
import ReactDOM from 'react-dom';
import update from 'react-addons-update';
import request from 'superagent';

import utils from './utils.js';
import costs from '../costs.js';
import Header from './components/Header.jsx';
import Envelope from './components/Envelope.jsx';
import Send from './components/Send.jsx';

import './styles/app.scss';


class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      file: { // populated by upload api response
        filename: '',
        uid: '',
        url: '',
        numPages: 0
      },
      fileUploadHasBegun: false,
      fileUploaded: false,
      fromAddress: {
        // error can be undefined (has not been validated), a string with an
        // error message (truthy), or false (validated without error)
        error: undefined,
        // set of missing fields
        missing: this.props.requiredFields,
        // true when address has not been verified but it queued for verification
        dirty: false
      },
      toAddress: {
        error: undefined,
        missing: this.props.requiredFields,
        dirty: false
      },
      options: {
        mailType: 'noUpgrade',
        returnEnvelope: false
      },
      sentSuccessfully: false
    };
    this.fileUploadHasBegun = this.fileUploadHasBegun.bind(this);
    this.updateFile = this.updateFile.bind(this);
    this.missingFields = this.missingFields.bind(this);
    this.updateAddress = this.updateAddress.bind(this);
    this.verifyAddress = this.verifyAddress.bind(this);
    this.updateOptions = this.updateOptions.bind(this);
    this.sentSuccessfully = this.sentSuccessfully.bind(this);
  }

  fileUploadHasBegun() {
    this.setState({ fileUploadHasBegun: true });
    // focus the first address input so the user can start filling it out
    document.querySelector('.address input').focus();
  }

  updateFile(file) {
    this.setState({ file: file, fileUploaded: !!file.numPages }, () => {
      if (this.state.fileUploaded) {
        ga('send', 'event', 'file', 'uploaded', file.uid, file.numPages, { nonInteraction: true });
      }
    });
  }

  missingFields(address) {
    return new Set(Array.from(this.props.requiredFields).filter(field => {
      return !(address[field] && address[field].length);
    }));
  }

  updateAddress(isFrom, field) {
    const address = isFrom ? this.state.fromAddress : this.state.toAddress;
    const prop = isFrom ? 'fromAddress' : 'toAddress';
    const updatedAddress = update(address, {$merge: field});
    const missingFields = this.missingFields(updatedAddress);
    updatedAddress.missing = missingFields;
    const isNotMissingFields = !Array.from(missingFields).length;
    updatedAddress.dirty = isNotMissingFields;
    const newState = {};
    newState[prop] = updatedAddress;
    this.setState(newState);
    if (isNotMissingFields) {
      // queue for address verification
      const timeoutIdKey = `${prop}TimeoutId`;
      if (this[timeoutIdKey]) {
        window.clearTimeout(this[timeoutIdKey]);
      }
      const timeoutId = window.setTimeout(() => {
        this.verifyAddress(isFrom);
      }, 500);
      // store timeout id
      // https://nathanleclaire.com/blog/2013/11/16/the-javascript-question-i-bombed-in-an-interview-with-a-y-combinator-startup/
      this[timeoutIdKey] = timeoutId;
    }
  }

  componentDidMount() {
    if (this.props.demo) {
      // wait 1s for DOM/animations before showing popup
      setTimeout(() => { 
        alert('This application is running in demo mode because "demo" is in the URL.\n\nEverything will work normally, except your credit card won\'t be charged and your document won\'t actually be sent.\n\nIf you meant to use this application for real, remove the word "demo" from the URL.');
      }, 1000);
    }
  }

  verifyAddress(isFrom) {
    let address = isFrom ? this.state.fromAddress : this.state.toAddress;
    request
    .post('/verify_address')
    .send(address)
    .end((err, res) => {
      if (err) console.error(err);
      // N.B. we redefine `address` inside the callback to get the current value
      // of `address` because it may have changed since earlier
      address = isFrom ? this.state.fromAddress : this.state.toAddress;
      const prop = isFrom ? 'fromAddress' : 'toAddress';
      const newError = res.body.message || false;
      const updatedAddress = update(address, {$merge: {error: newError, dirty: false}});
      const newState = {};
      newState[prop] = updatedAddress;
      this.setState(newState);
      ga('send', 'event', 'address', 'verify', isFrom ? 'from' : 'to', Number(!!newError));
    });
  }

  updateOptions(option) {
    const options = this.state.options;
    this.setState({ options: update(options, {$merge: option}) });
  }

  sentSuccessfully() {
    this.setState({ sentSuccessfully: true });
    ga('send', 'event', 'send', 'success', this.state.file.uid);
  }

  render() {
    return (
      <main>
        <div id="drop-mask">Release to drop!</div>
        <Header costs={this.props.costs} file={this.state.file}
                fileUploadHasBegun={this.fileUploadHasBegun}
                updateFile={this.updateFile}
                actionable={!this.state.sentSuccessfully} />
        <Envelope fileUploadHasBegun={this.state.fileUploadHasBegun}
                  updateAddress={this.updateAddress}
                  fromFields={this.state.fromAddress}
                  toFields={this.state.toAddress}
                  sentSuccessfully={this.state.sentSuccessfully} />
        <Send costs={this.props.costs} file={this.state.file}
              options={this.state.options} updateOptions={this.updateOptions}
              calculateCost={this.props.calculateCost}
              fromAddress={this.state.fromAddress}
              toAddress={this.state.toAddress}
              sentSuccessfully={this.sentSuccessfully}
              actionable={!this.state.sentSuccessfully}
              demo={this.props.demo} />
        <footer>
          <ul>
            <li><a href="/pages/refund-policy" target="_blank">Refund Policy</a></li>
            <li><a href="/pages/terms" target="_blank">Terms of Service</a></li>
            <li><a href="/pages/privacy" target="_blank">Privacy Policy</a></li>
          </ul>
          <p>Powered by <a href="https://lob.com/" target="_blank">Lob</a> and <a href="https://stripe.com/" target="_blank">Stripe</a></p>
        </footer>
      </main>
    );
  }
}

App.propTypes = {
  costs: React.PropTypes.object.isRequired,
  calculateCost: React.PropTypes.func.isRequired
};

App.defaultProps = {
  requiredFields: new Set(['name', 'line1', 'city', 'state', 'zip']),
  costs: costs.costs,
  calculateCost: costs.calculateCost,
  demo: document.location.search.search('demo') > -1
};

ReactDOM.render(
  <App />,
  document.getElementById('app')
);
