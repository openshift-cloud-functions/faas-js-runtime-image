// This is the default function for a FaaS
// instance. In practice, this file is
// overwritten by user code during image
// spin up.

const isNumber = require('is-number')

module.exports = context => {
  const ret = 'This is the test function for Node.js FaaS';
  if (isNumber(ret)) throw new Error('Something is wrong with modules');
  return ret;
};