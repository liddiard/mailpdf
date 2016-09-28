import React from 'react';
import ReactDOM from 'react-dom';
import request from 'superagent';
import Dropzone from 'dropzone';

import Header from './components/Header.jsx';
import Envelope from './components/Envelope.jsx';
import Send from './components/Send.jsx';

import './styles/app.scss';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {

    };
  }

  componentDidMount() {
    new Dropzone(document.body, {
      previewsContainer: ".dropzone-previews",
      // You probably don't want the whole body
      // to be clickable to select files
      clickable: false,
      url: '/upload'
    });
  }

  render() {
    return (
      <main>
        <Header />
        <div className="dropzone-previews"></div>
        <Envelope />
        <Send />
        <footer>
          <p>Powered by <a href="https://lob.com/" target="_blank">Lob</a> and <a href="https://stripe.com/" target="_blank">Stripe</a>.</p>
          <p>Copyright © 2016 <a href="https://harrisonliddiard.com/" target="_blank">Harrison Liddiard</a>.</p>
        </footer>
      </main>
    );
  }
}

ReactDOM.render(
  <App />,
  document.getElementById('app')
);
