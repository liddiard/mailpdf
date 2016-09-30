import React from 'react';
import ReactDOM from 'react-dom';
import update from 'react-addons-update';
import request from 'superagent';
import Dropzone from 'dropzone';

import utils from './utils.js';
import costs from './costs.js';
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
      fileUploaded: false,
      fromAddress: {},
      toAddress: {},
      options: {
        mailType: 'noUpgrade',
        returnEnvelope: false
      }
    };
    this.updateFile = this.updateFile.bind(this);
    this.updateAddress = this.updateAddress.bind(this);
    this.updateOptions = this.updateOptions.bind(this);
  }

  componentDidMount() {
    new Dropzone(document.body, {
      previewsContainer: ".dropzone-previews",
      // You probably don't want the whole body
      // to be clickable to select files
      clickable: false,
      url: '/upload',
      // https://github.com/enyo/dropzone/issues/438#issuecomment-128824773
      dragenter: () => {},
      dragleave: () => {},
      init: function(){ utils.setupDragon(this) }
    });
  }

  updateFile(file) {
    this.setState({ file: file, fileUploaded: true });
  }

  updateAddress(isFrom, address) {
    if (isFrom) {
      this.setState({ fromAddress: address });
    }
    else {
      this.setState({ toAddress: address });
    }
  }

  updateOptions(option) {
    const options = this.state.options;
    this.setState({ options: update(options, {$merge: option}) });
  }

  render() {
    return (
      <main>
        <div id="drop-mask">Release to drop!</div>
        <Header costs={this.props.costs} updateFile={this.updateFile} />
        <div className="dropzone-previews"></div>
        <Envelope updateAddress={this.updateAddress} />
        <Send costs={this.props.costs} numPages={this.state.file.numPages}
              options={this.state.options} updateOptions={this.updateOptions}
              calculateCost={this.props.calculateCost} />
        <footer>
          <p>Powered by <a href="https://lob.com/" target="_blank">Lob</a> and <a href="https://stripe.com/" target="_blank">Stripe</a>.</p>
          <p>Copyright © 2016 <a href="https://harrisonliddiard.com/" target="_blank">Harrison Liddiard</a>.</p>
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
  costs: costs.costs,
  calculateCost: costs.calculateCost
};

ReactDOM.render(
  <App />,
  document.getElementById('app')
);
