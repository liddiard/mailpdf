import React from 'react';
import update from 'react-addons-update';
import { ModalPortal, ModalBackground, ModalDialog } from 'react-modal-dialog';
import request from 'superagent';
import scrollIntoView from 'scroll-into-view';

import utils from '../utils.js';


export default class Send extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      email: '', // user's email address
      isShowingEmailModal: false,
      isShowingProgressModal: false
    };
    this.handleMailTypeChange = this.handleMailTypeChange.bind(this);
    this.handleReturnEnvelopeChange = this.handleReturnEnvelopeChange.bind(this);
    this.handleEmailChange = this.handleEmailChange.bind(this);
    this.getTotal = this.getTotal.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleEmailModalClose = this.handleEmailModalClose.bind(this);
    this.displayCheckout = this.displayCheckout.bind(this);
  }

  componentDidMount() {
    this.handler = StripeCheckout.configure({
      key: 'pk_test_o41iwtQNmvQuGl4Vses2r1fa',
      image: '/img/logo_bg.png',
      locale: 'en',
      token: token => {
        // update state.email in case it has changed
        // if no email or a malformed email is provided to stripe checkout,
        // it will prompt the user for an email address
        this.setState({ email: token.email, isShowingProgressModal: true });
        scrollIntoView(document.getElementById('envelope'), { time: 1000 });

        const payload = {
          token: token,
          uid: this.props.file.uid,
          numPages: this.props.file.numPages,
          mailType: this.props.options.mailType,
          returnEnvelope:  this.props.options.returnEnvelope,
          cost: this.getTotal(),
          fromAddress: this.props.fromAddress,
          toAddress: this.props.toAddress
        };
        request
        .post('/checkout')
        .send(payload)
        .end((err, res) => {
          this.setState({ isShowingProgressModal: false });
          if (res.body && res.body.error) {
            alert(`We apologize, there was an unexpected problem with your order: ${res.body.error}`);
          }
          else if (err) {
            console.error(err);
            alert(err);
          }
          else {
            this.props.sentSuccessfully(); // we're done!
          }
        });
      }
    });
  }

  handleMailTypeChange(event) {
    const newOption = {};
    newOption[event.target.name] = event.target.value;
    this.props.updateOptions(newOption);
  }

  handleReturnEnvelopeChange(event) {
    this.props.updateOptions({ returnEnvelope: !this.props.options.returnEnvelope });
  }

  handleEmailChange(event) {
    this.setState({ email: event.target.value });
  }

  getTotal() {
    const options = update(this.props.options, {$merge: { numPages: this.props.file.numPages }});
    return this.props.calculateCost(options);
  }

  displayCheckout(event) {
    event.preventDefault();
    this.setState({ isShowingEmailModal: false });
    console.log(this.getTotal());
    this.handler.open({
      name: 'Mail a PDF Online',
      description: `to ${this.props.toAddress.line1}`,
      zipCode: true,
      amount: this.getTotal(), // amount in cents
      email: this.state.email,
      panelLabel: 'Pay {{amount}} and Send',
    });
  }

  handleClick(event) {
    this.setState({ isShowingEmailModal: true });
  }

  handleEmailModalClose() {
    this.setState({ isShowingEmailModal: false });
  }

  render() {
    let pageCount;
    if (this.props.file.numPages > this.props.costs.maxFreePages) {
      pageCount = <span className="page-count">{this.props.file.numPages}-page document</span>;
    }

    let error;
    if (!this.props.file.uid.length) {
      error = (
        <p className="error">
          <i className="fa fa-exclamation-triangle" aria-hidden="true"></i> Please <a href="#upload">upload a PDF above</a> to continue.
        </p>
      );
    }
    else if (Array.from(this.props.fromAddress.missing).length ||
             Array.from(this.props.toAddress.missing).length ||
             typeof this.props.fromAddress.error === 'undefined' ||
             typeof this.props.toAddress.error === 'undefined') {
      error = (
        <p className="error">
          <i className="fa fa-exclamation-triangle" aria-hidden="true"></i> Please fill out the missing address fields above in red.
        </p>
      );
    }
    else if (this.props.toAddress.error || this.props.fromAddress.error) {
      error = (
        <p className="error">
          <i className="fa fa-exclamation-triangle" aria-hidden="true"></i> Please correct the address problem identified in red above.
        </p>
      );
    }

    let emailModal;
    if (this.state.isShowingEmailModal) {
      emailModal = (
        <ModalPortal onClose={this.handleEmailModalClose}>
          <ModalBackground backgroundColor={this.props.modalBackgroundColor}>
            <ModalDialog onClose={this.handleEmailModalClose} className="email modal">
              <form onSubmit={this.displayCheckout}>
                <p>Please provide an email address for your tracking number and receipt.</p>
                <p>We use your email only to send this information.</p>
                <input type="email" placeholder="Email" autoFocus
                       value={this.state.email} onChange={this.handleEmailChange} tabIndex="7" />
                <button type="submit" tabIndex="8">
                  Continue <i className="fa fa-arrow-right" aria-hidden="true"></i>
                </button>
              </form>
            </ModalDialog>
          </ModalBackground>
        </ModalPortal>
      );
    }

    let progressModal;
    if (this.state.isShowingProgressModal) {
      progressModal = (
        <ModalPortal>
          <ModalBackground backgroundColor={this.props.modalBackgroundColor}>
            <ModalDialog className="progress modal">
              <p><i className="fa fa-circle-o-notch fa-spin" aria-hidden="true"></i> Preparing your document for shipment…</p>
            </ModalDialog>
          </ModalBackground>
        </ModalPortal>
      );
    }

    const className = this.props.actionable ? '' : 'invisible';

    return (
      <section id="pay-and-send" className={className}>
        <div className="total">
          Total
          <div className="price">{utils.formatMoney(this.getTotal())}</div>
          {pageCount}
        </div>
        <div className="additions">
          <fieldset className="mail-type">
            <label>
              <input type="radio" name="mailType" value="noUpgrade"
                     checked={this.props.options.mailType === 'noUpgrade'}
                     onChange={this.handleMailTypeChange} tabIndex="4" />
              Standard service
            </label>
            <label>
              <input type="radio" name="mailType" value="certified"
                     checked={this.props.options.mailType === 'certified'}
                     onChange={this.handleMailTypeChange} tabIndex="4" />
              Certified Mail <span className="price">+{utils.formatMoney(this.props.costs.certifiedMail)}</span>
              <a href="https://www.usps.com/ship/insurance-extra-services.htm" target="_blank" title="What's this?">
                <i className="fa fa-question fa-fw" aria-hidden="true"></i>
              </a>
            </label>
            <label>
              <input type="radio" name="mailType" value="registered"
                    checked={this.props.options.mailType === 'registered'}
                    onChange={this.handleMailTypeChange} tabIndex="4" />
              Registered Mail <span className="price">+{utils.formatMoney(this.props.costs.registeredMail)}</span>
              <a href="https://www.usps.com/ship/insurance-extra-services.htm" target="_blank" title="What's this?">
                <i className="fa fa-question fa-fw" aria-hidden="true"></i>
              </a>
            </label>
          </fieldset>
          <label>
            <input type="checkbox" name="returnEnvelope"
                   checked={this.props.options.returnEnvelope}
                   onChange={this.handleReturnEnvelopeChange} tabIndex="5" />
            Include a return envelope <span className="price">+{utils.formatMoney(this.props.costs.returnEnvelope)}</span>
          </label>
        </div>
        {error}
        <button onClick={this.handleClick} disabled={!!error} tabIndex="6">
          Pay and Send <i className="fa fa-paper-plane" aria-hidden="true"></i>
        </button>

        {emailModal}
        {progressModal}

        <p>Mail is typically delivered by USPS within 4–6 days.</p>
        <p>You will receive a tracking number by email after checkout.</p>

      </section>
    );
  }
}

Send.defaultProps = {
  modalBackgroundColor: 'rgba(0,0,0, 0.7)'
};

Send.propTypes = {
  costs: React.PropTypes.object.isRequired,
  file: React.PropTypes.object.isRequired,
  options: React.PropTypes.object.isRequired,
  updateOptions: React.PropTypes.func.isRequired,
  calculateCost: React.PropTypes.func.isRequired,
  fromAddress: React.PropTypes.object.isRequired,
  toAddress: React.PropTypes.object.isRequired,
  sentSuccessfully: React.PropTypes.func.isRequired,
  actionable: React.PropTypes.bool.isRequired
}
