import React from 'react';

import Address from './Address.jsx';


export default class Envelope extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    return (
      <div id="envelope" className="animated slideInUp">
        <img className="stamp" src="/img/stamp.png" />
        <Address from={true} updateAddress={this.props.updateAddress} />
        <Address from={false} updateAddress={this.props.updateAddress} />
      </div>
    )
  }
}

Envelope.propTypes = {
  updateAddress: React.PropTypes.func.isRequired
}
