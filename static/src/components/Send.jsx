import React from 'react';

export default class Send extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  handleClick() {
    prompt('Please provide an email address for your payment receipt. \n\nWe will use your email only for the one-time purpose of sending this reciept.');
  }

  render() {
    return (
      <section id="pay-and-send">
        <div className="total">
          Total
          <div className="price">$1.99</div>
        </div>
        <div className="additions">
          <div className="mail-type">
            <label>
              <input type="radio" name="mail-type" value="no-upgrade" checked />
              No extra service
            </label>
            <label>
              <input type="radio" name="mail-type" value="registered" />
              Registered mail <span className="price">+$5.00</span>
            </label>
            <label>
              <input type="radio" name="mail-type" value="certified" />
              Certified mail <span className="price">+$16.50</span>
            </label>
          </div>
          <label>
            <input type="checkbox" name="return-envelope"/>
            Add a return envelope <span className="price">+$0.50</span>
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
