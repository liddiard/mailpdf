import React from 'react';

export default class Address extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    this.handleInputChange = this.handleInputChange.bind(this);
  }

  handleInputChange(event) {
    const newState = {};
    newState[event.target.name] = event.target.value;
    this.props.updateAddress(this.props.from, newState);
  }

  render() {
    const title = this.props.from ? 'from' : 'to';

    let error;
    let verificationStatus;
    if (this.props.fields.error) {
      // verification completed with error
      error = (
        <p className="error animated fadeIn">
          <i className="fa fa-exclamation-triangle" aria-hidden="true"></i> {this.props.fields.error}
        </p>
      );
      verificationStatus = <i className="verification-status fa fa-times" aria-hidden="true"></i>;
    }
    if (this.props.fields.dirty) {
      // verification queued/in progress; show spinner
      verificationStatus = <i className="verification-status fa fa-circle-o-notch fa-spin" aria-hidden="true"></i>;
    }
    // strict equality comparison because error can also be `undefined`
    else if (this.props.fields.error === false) {
      // verified; show check mark
      verificationStatus = <i className="verification-status fa fa-check" aria-hidden="true"></i>;
    }

    const className = `address ${title} ${!!error ? 'error' : ''}`;
    const arrow = <i className={`fa fa-arrow-right ${title}`} aria-hidden="true" />;

    let nameClassName, line1ClassName, cityClassName, stateClassName, zipClassName;
    if (this.props.fileUploadHasBegun) {
      const missingFields = this.props.fields.missing;
      nameClassName = missingFields.has('name') ? 'error' : '';
      line1ClassName = missingFields.has('line1') ? 'error' : '';
      cityClassName = missingFields.has('city') ? 'error' : '';
      stateClassName = missingFields.has('state') ? 'error' : '';
      zipClassName = missingFields.has('zip') ? 'error' : '';
    }

    const tabIndex = this.props.from ? 2 : 3;

    return (
      <form className={className} ref="form" autoComplete="off">
        {/* we must disable autocomplete because it is impossible to detect
            http://stackoverflow.com/a/11710295 */}
        <h2>{title} {arrow} {verificationStatus}</h2>
        {error}
        <input type="text" name="name" placeholder="Name" required
               className={nameClassName} value={this.props.fields.name || ''}
               onChange={this.handleInputChange} tabIndex={tabIndex} />
        <input type="text" name="line1" placeholder="Address line 1" required
               className={line1ClassName} value={this.props.fields.line1 || ''}
               onChange={this.handleInputChange} tabIndex={tabIndex} />
        <input type="text" name="line2" placeholder="Address line 2 (optional)"
               value={this.props.fields.line2 || ''}
               onChange={this.handleInputChange} tabIndex={tabIndex} />
        <div className="third-line">
          <input type="text" name="city" placeholder="City" required
                 className={cityClassName} value={this.props.fields.city || ''}
                 onChange={this.handleInputChange} tabIndex={tabIndex} />
          <input type="text" name="state" placeholder="State" required
                 className={stateClassName} value={this.props.fields.state || ''}
                 onChange={this.handleInputChange} tabIndex={tabIndex} />
          <input type="text" name="zip" placeholder="Zip" required
                 className={zipClassName} value={this.props.fields.zip || ''}
                 onChange={this.handleInputChange} tabIndex={tabIndex} />
        </div>
      </form>
    );
  }
}

Address.propTypes = {
  fileUploadHasBegun: React.PropTypes.bool.isRequired,
  from: React.PropTypes.bool.isRequired,
  fields: React.PropTypes.object.isRequired,
  updateAddress: React.PropTypes.func.isRequired
};
