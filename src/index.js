'use strict';

const path = require('path');
const framework = require('@redhat/faas-js-runtime');
const userFunction = require(path.join(`${__dirname},`, '..', 'usr'));

framework(userFunction, 8080, server => {
  console.log('FaaS framework initialized');
});

process.stdin.resume();

let confirm = false;
process.on('SIGINT', signal => {
  if (confirm) {
    process.exit(130);
  } else {
    console.log('Press Control+C again to confirm.');
    confirm = true;
  }
});

process.on('SIGTERM', signal => {
  console.log(`Received ${signal}`);
  process.exit(143);
});