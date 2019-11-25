module.exports = async function testFunc(context) {
  console.log('Context:', context);
  const ret = {
    headers: {
      'ce-specversion': '0.3',
      'ce-type': 'dev.nodeshift.samples.fromjs',
      'ce-source': 'nodeshift/samples/js-example-service',
      'ce-id': '536808d3-88be-4077-9d7a-a3f162705f79',
      'content-type': 'application/json',
    },
    message: {msg: 'From js-example-service'}
  };
  console.log('Return message', ret);
  return new Promise((resolve, reject) => {
    setTimeout(_ => {
      resolve(ret);
    }, 500);
  });
};
