// This is a test function that ensures a module specified
// in package.json can be loaded and run during function runtime.
// See: test/run.sh

const isNumber = require('is-number')

module.exports = context => {
  const ret = { message: 'This is the test function for Node.js FaaS. Success.'};
  if (isNumber(ret)) throw new Error('Something is wrong with modules');
  if (context.cloudevent) return { message: context.cloudevent.data.message };
  return ret;
};