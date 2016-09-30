import React from 'react';
import update from 'react-addons-update';

import utils from '../utils.js';


export default class Send extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    this.handleMailTypeChange = this.handleMailTypeChange.bind(this);
    this.handleReturnEnvelopeChange = this.handleReturnEnvelopeChange.bind(this);
    this.displayTotal = this.displayTotal.bind(this);
  }

  handleMailTypeChange(event) {
    const newOption = {};
    newOption[event.target.name] = event.target.value;
    this.props.updateOptions(newOption);
  }

  handleReturnEnvelopeChange(event) {
    this.props.updateOptions({ returnEnvelope: !this.props.options.returnEnvelope });
  }

  displayTotal() {
    const options = update(this.props.options, {$merge: { numPages: this.props.numPages }});
    const total = this.props.calculateCost(options);
    return utils.formatMoney(total);
  }

  handleClick() {
    prompt('Please provide an email address for your payment receipt. \n\nWe will use your email only for the one-time purpose of sending this reciept.');
  }

  render() {
    return (
      <section id="pay-and-send">
        <div className="total">
          Total
          <div className="price">{this.displayTotal()}</div>
        </div>
        <div className="additions">
          <div className="mail-type">
            <label>
              <input type="radio" name="mailType" value="noUpgrade"
                     checked={this.props.options.mailType === 'noUpgrade'}
                     onClick={this.handleMailTypeChange} />
              No extra service
            </label>
            <label>
              <input type="radio" name="mailType" value="registered"
                    checked={this.props.options.mailType === 'registered'}
                    onClick={this.handleMailTypeChange} />
              Registered mail <span className="price">+{utils.formatMoney(this.props.costs.registeredMail)}</span>
            </label>
            <label>
              <input type="radio" name="mailType" value="certified"
                     checked={this.props.options.mailType === 'certified'}
                     onClick={this.handleMailTypeChange} />
              Certified mail <span className="price">+{utils.formatMoney(this.props.costs.certifiedMail)}</span>
            </label>
          </div>
          <label>
            <input type="checkbox" name="returnEnvelope"
                   checked={this.props.options.returnEnvelope}
                   onClick={this.handleReturnEnvelopeChange} />
            Add a return envelope <span className="price">+{utils.formatMoney(this.props.costs.returnEnvelope)}</span>
          </label>
        </div>
        <button onClick={this.handleClick}>
          Pay and Send <i className="fa fa-paper-plane" aria-hidden="true"></i>
        </button>

        <p>Mail is typically delivered by USPS within 4–6 days.</p>
        <p>You will receive a tracking number by email after checkout.</p>
      </section>
    );
  }
}

Send.defaultProps = {
  costs: React.PropTypes.object.isRequired,
  numPages: React.PropTypes.number.isRequired,
  options: React.PropTypes.object.isRequired,
  updateOptions: React.PropTypes.func.isRequired,
  calculateCost: React.PropTypes.func.isRequired
}
