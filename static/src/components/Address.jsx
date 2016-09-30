import React from 'react';

export default class Address extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      blurred: false,
      name: '',
      line1: '',
      line2: '',
      city: '',
      state: '',
      zip: ''
    };
    this.handleInputChange = this.handleInputChange.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.missingRequiredFields = this.missingRequiredFields.bind(this);
  }

  handleInputChange(event) {
    const newState = {};
    newState[event.target.name] = event.target.value;
    this.setState(newState);
  }

  missingRequiredFields() {
    return new Set(Array.from(this.props.requiredFields).filter(field => {
      return !this.state[field].length;
    }));
  }

  handleBlur() {
    // fires for every focus change even when attached to the form element,
    // including focus changes within the form

    // wait for DOM to update (for focus to attach to next element if applicable)
    window.setTimeout(() => {
      // if we have changed focus away from this form, not just changed the
      // focused field within this form
      if (document.activeElement.closest('form') !== this.refs.form) {
        this.setState({ blurred: true });
      }
    });
  }

  render() {
    const title = this.props.from ? 'from' : 'to';
    const className = 'address ' + title;
    const arrow = <i className={`fa fa-arrow-right ${title}`} aria-hidden="true" />;

    let line1ClassName, cityClassName, stateClassName, zipClassName;
    if (this.state.blurred) {
      const missingFields = this.missingRequiredFields();
      line1ClassName = missingFields.has('line1') ? 'error' : '';
      cityClassName = missingFields.has('city') ? 'error' : '';
      stateClassName = missingFields.has('state') ? 'error' : '';
      zipClassName = missingFields.has('zip') ? 'error' : '';
    }

    return (
      <form className={className} onBlur={this.handleBlur} ref="form">
        <h2>{title} {arrow}</h2>
        <input type="text" name="name" placeholder="Name (optional)"
               value={this.state.name} onChange={this.handleInputChange} />
        <input type="text" name="line1" placeholder="Address line 1" required
               className={line1ClassName} value={this.state.line1}
               onChange={this.handleInputChange} />
        <input type="text" name="line2" placeholder="Address line 2 (optional)"
               value={this.state.line2} onChange={this.handleInputChange} />
        <div className="third-line">
          <input type="text" name="city" placeholder="City" required
                 className={cityClassName} value={this.state.city}
                 onChange={this.handleInputChange} />
          <input type="text" name="state" placeholder="State" required
                 className={stateClassName} value={this.state.state}
                 onChange={this.handleInputChange} />
          <input type="text" name="zip" placeholder="Zip" required
                 className={zipClassName} value={this.state.zip}
                 onChange={this.handleInputChange} />
        </div>
      </form>
    );
  }
}

Address.propTypes = {
  title: React.PropTypes.string,
  from: React.PropTypes.bool.isRequired,
  requiredFields: React.PropTypes.object.isRequired,
  updateAddress: React.PropTypes.func.isRequired
};

Address.defaultProps = {
  requiredFields: new Set(['line1', 'city', 'state', 'zip'])
};
