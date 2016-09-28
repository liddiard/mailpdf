import React from 'react';

export default class Address extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    const title = this.props.from ? 'from' : 'to';
    const className = 'address ' + title;
    const arrow = <i className={`fa fa-arrow-right ${title}`} aria-hidden="true" />;

    return (
      <form className={className}>
        <h2> {title} {arrow}</h2>
        <input type="text" name="name" placeholder="Name (optional)" />
        <input type="text" name="address1" placeholder="Address line 1" required />
        <input type="text" name="address2" placeholder="Address line 2 (optional)" />
        <div className="third-line">
          <input type="text" name="city" placeholder="City" required />
          <input type="text" name="state" placeholder="State" required />
          <input type="text" name="zip" placeholder="Zip" required />
        </div>
      </form>
    );
  }
}

Address.propTypes = {
  title: React.PropTypes.string,
  from: React.PropTypes.bool.isRequired
};
