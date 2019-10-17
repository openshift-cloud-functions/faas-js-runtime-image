'use strict';

const path = require('path');
const framework = require('@redhat/faas-js-runtime');

console.log(`Executing in ${__dirname}`);

framework(path.join(`${__dirname}`, '..', 'usr'), 8080, server => {
  console.log('FaaS framework initialized.');
});
