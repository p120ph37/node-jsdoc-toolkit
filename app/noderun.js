#!/usr/bin/node

exports.jsdoctoolkit = {
  init: function (args) {
    global.internal_args = args || [];
    require('./run');
  }
};