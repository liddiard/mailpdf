import React from 'react';

import Address from './Address.jsx';


export default class Envelope extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  reloadPage() {
    ga('send', 'event', 'envelope', 'send_another', 'click');
    location.reload();
  }

  render() {
    const animationClass = this.props.sentSuccessfully ? 'bounceOutRight' : 'slideInUp';
    const sendSuccessClass = this.props.sentSuccessfully ? 'animated fadeIn' : 'hidden';
    return (
      <div id="envelope-container">
        <div id="envelope" className={`animated ${animationClass}`}>
          <img className="stamp" src="/img/stamp.png" />
          <Address from={true} fields={this.props.fromFields}
                  fileUploadHasBegun={this.props.fileUploadHasBegun}
                  updateAddress={this.props.updateAddress} />
          <Address from={false} fields={this.props.toFields}
                  fileUploadHasBegun={this.props.fileUploadHasBegun}
                  updateAddress={this.props.updateAddress} />
        </div>
        <div id="send-success" className={sendSuccessClass}>
          <div>
            <h2>You’re all set!</h2>
            <p>Your document has begun its journey to {this.props.toFields.line1}.</p>
            <p>You will receive an email with tracking information shortly.</p>
            <button className="send-another" onClick={this.reloadPage}>
              Send Another <i className="fa fa-refresh" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </div>
    )
  }
}

Envelope.propTypes = {
  fileUploadHasBegun: React.PropTypes.bool.isRequired,
  fromFields: React.PropTypes.object.isRequired,
  toFields: React.PropTypes.object.isRequired,
  updateAddress: React.PropTypes.func.isRequired,
  sentSuccessfully: React.PropTypes.bool.isRequired
}
