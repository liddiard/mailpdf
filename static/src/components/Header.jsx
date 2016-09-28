import React from 'react';

export default class Header extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    return (
      <header>
        <p className="tagline">
          Skip the post office.
        </p>
        <h1>Mail a PDF document for $1.99 in under 60 seconds.</h1>
        <p className="pricing-details">
          Up to 6 black-and-white pages for $1.99. Additional pages $1.00 + $0.25/each. Service for U.S. addresses only.
        </p>
        <p className="upload">
          <strong>Drag and drop</strong> a PDF onto this window or click <button>Upload PDF <i className="fa fa-upload" aria-hidden="true"></i></button>
        </p>
      </header>
    );
  }
}
