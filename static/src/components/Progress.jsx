/*
The MIT License (MIT)

Copyright (c) 2014 Param Aggarwal

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// pulled out of https://github.com/paramaggarwal/react-progressbar until
// https://github.com/paramaggarwal/react-progressbar/issues/15 is resolved

import React from 'react';

export default class Progress extends React.Component {

  render() {

    let completed = +this.props.completed;
    if (completed === NaN || completed < 0) { completed = 0 };
    if (completed > 100) {completed = 100};

    const style = {
      backgroundColor: this.props.color || '#0BD318',
      width: completed + '%',
      transition: "width 200ms",
      height: this.props.height || 10
    };

    return (
      <div className="progressbar-container">
        <div className="progressbar-progress" style={style}>{this.props.children}</div>
      </div>
    );
  }
};
