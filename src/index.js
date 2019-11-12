'use strict';

const path = require('path');
const framework = require('@redhat/faas-js-runtime');
const userFunction = require(path.join(`${__dirname},`, '..', 'usr'));

framework(userFunction, 8080, server => {
  console.log('FaaS framework initialized');
});
