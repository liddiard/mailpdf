import React from 'react';
import request from 'superagent';

import utils from '../utils.js';


export default class Header extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    this.showFileUploadDialog = this.showFileUploadDialog.bind(this);
    this.uploadFile = this.uploadFile.bind(this);
  }

  showFileUploadDialog(event) {
    this.refs.upload.click();
  }

  uploadFile(event) {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    /*
    for (var key in event.target.files) {
      console.log('key:', key);
      console.log('value:', event.target.files[key]);
    }
    */
    request
    .post('/api/upload')
    .attach('pdf', file)
    .end((err, res) => {
      if (err) console.error(err);
      if (res.body.error) {
        alert(`Upload error: ${res.body.error}`);
      }
      else {
        this.props.updateFile(res.body);
      }
    });
  }

  render() {
    return (
      <header>
        <p className="tagline">
          Skip the post office.
        </p>
        <h1>Mail a PDF document for {utils.formatMoney(this.props.costs.base)} in under 60 seconds.</h1>
        <p className="pricing-details">
          Tracking included. Up to {this.props.costs.maxFreePages} black-and-white pages for {utils.formatMoney(this.props.costs.base)}. Additional pages {utils.formatMoney(this.props.costs.overMaxFreePages)} + {utils.formatMoney(this.props.costs.overMaxFreePagesPerPage)}/each. Service for U.S. addresses only.
        </p>
        <p className="upload">
          <strong>Drag and drop</strong> a PDF onto this window or click <button onClick={this.showFileUploadDialog}>Upload PDF <i className="fa fa-upload" aria-hidden="true"></i></button>
          {/* Upload complete. Any pages not 8.5"x11" have been resized to fit. */}

          {/* hidden element for file upload http://stackoverflow.com/a/8595592 */}
          <input type="file" accept="application/pdf" ref="upload"
                 onChange={this.uploadFile} />
        </p>
      </header>
    );
  }
}

Header.propTypes = {
  costs: React.PropTypes.object.isRequired,
  updateFile: React.PropTypes.func.isRequired
};
