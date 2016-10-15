import React from 'react';
import request from 'superagent';
import Dropzone from 'dropzone';

import Progress from './Progress.jsx';
import utils from '../utils.js';


export default class Header extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      // valid statuses: not_started, uploading, processing, complete_success,
      // complete_error
      status: 'not_started',
      error: '', // error message
      uploadProgress: 0 // percent, 0-100
    };
    this.showFileUploadDialog = this.showFileUploadDialog.bind(this);
    this.uploadFile = this.uploadFile.bind(this);
  }

  componentDidMount() {
    const _this = this;

    new Dropzone(document.body, {
      previewsContainer: '.dropzone-previews',
      // You probably don't want the whole body
      // to be clickable to select files
      clickable: false,
      url: '/',
      autoProcessQueue: false, // don't upload to `url` on file drop
      // https://github.com/enyo/dropzone/issues/438#issuecomment-128824773
      dragenter: () => {},
      dragleave: () => {},
      init: function(){
        utils.setupDragon(this);
        this.on('addedfile', file => {
          _this.uploadFile(null, file);
        });
      }
    });
  }

  showFileUploadDialog(event) {
    this.refs.upload.click();
  }

  uploadFile(event, _file) {
    const file = _file || event.target.files[0];
    if (!file) {
      return;
    }

    this.props.fileUploadHasBegun();

    this.props.updateFile({
      filename: '',
      uid: '',
      url: '',
      numPages: 0
    });

    request
    .post('/upload')
    .attach('pdf', file)
    .on('progress', event => {
      const status = event.percent === 100 ? 'processing' : 'uploading';
      this.setState({ uploadProgress: event.percent, status: status });
    })
    .end((err, res) => {
      if (err || res.body.error) {
        let errorMsg;
        if (err && err.status === 413) {
          errorMsg = 'PDF over 25 MB file size limit. Please try again with a smaller file.';
        }
        else if (err) {
          errorMsg = err;
        }
        else {
          errorMsg = res.body.error;
        }
        this.setState({ status: 'complete_error', error: errorMsg }, () => {
          // show an alert if the status element is not in the browser viewport
          if (this.refs.status.getBoundingClientRect().top < 0) {
            alert(`Upload error: ${this.state.error}`);
          }
        });
      }
      else {
        this.setState({ status: 'complete_success' });
        this.props.updateFile(res.body);
      }
    });
  }

  render() {
    let status;
    let progress;
    if (this.state.status === 'uploading' || this.state.status === 'processing') {
      progress = <Progress completed={this.state.uploadProgress} color="rgba(255,255,255, 0.5)" />;
    }
    switch(this.state.status) {
      case 'not_started':
        break;
      case 'uploading':
        status = (
          <p className="status uploading" ref="status">
            <i className="fa fa-circle-o-notch fa-spin" aria-hidden="true"></i> Uploading…
          </p>
        );
        break;
      case 'processing':
        status = (
          <p className="status processing" ref="status">
            <i className="fa fa-circle-o-notch fa-spin" aria-hidden="true"></i> Processing document…
          </p>
        );
        break;
      case 'complete_success':
        status = (
          <p className="status complete_success animated fadeInUp" ref="status">
            <i className="fa fa-check" aria-hidden="true"></i> Uploaded “{this.props.file.filename}.” All pages have been sized to 8.5"x11". <a href={this.props.file.url} target="_blank">View processed PDF</a>.<sup><i className="fa fa-external-link" aria-hidden="true"></i></sup>
          </p>
        );
        break;
      case 'complete_error':
        status = (
          <p className="status complete_error animated shake" ref="status">
            <i className="fa fa-exclamation-triangle" aria-hidden="true"></i> Error: {this.state.error}
          </p>
        );
        break;
      default:
        console.error('Unexpected status:', this.state.status);
    }

    const invisibleClass = this.props.actionable ? '' : 'invisible';

    return (
      <header>
        <p className="tagline">
          Skip the post office.
        </p>
        <h1>Mail a PDF for {utils.formatMoney(this.props.costs.base)} in under 60 seconds.</h1>
        <p className="pricing-details">
          Tracking included. Up to {this.props.costs.maxFreePages} black-and-white pages for {utils.formatMoney(this.props.costs.base)}. Additional pages {utils.formatMoney(this.props.costs.overMaxFreePagesPerPage)}/each + {utils.formatMoney(this.props.costs.overMaxFreePages)}. Service for U.S. addresses only.
        </p>
        <div id="upload" className={`upload ${invisibleClass}`}>
          <p className="instructions">
            <strong>Drag and drop</strong> or click 
          </p>
          <button onClick={this.showFileUploadDialog} tabIndex="1">
            Upload PDF <i className="fa fa-upload" aria-hidden="true"></i>
          </button>

          {progress}
          {status}

          {/* hidden element for file upload http://stackoverflow.com/a/8595592 */}
          <input type="file" accept="application/pdf" ref="upload"
                 onChange={this.uploadFile} />
        </div>

        {/* dropzone needs a place to put file thumbnail previews. we hide this in css. */}
        <div className="dropzone-previews"></div>
      </header>
    );
  }
}

Header.propTypes = {
  costs: React.PropTypes.object.isRequired,
  fileUploadHasBegun: React.PropTypes.func.isRequired,
  file: React.PropTypes.object.isRequired,
  updateFile: React.PropTypes.func.isRequired,
  actionable: React.PropTypes.bool.isRequired
};
