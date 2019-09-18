const http = require('http');
const Context = require('./context.js');
const protection = require('overload-protection');
const cldeventsv02 = require('cloudevents-sdk/v02');
const cldeventsv03 = require('cloudevents-sdk/v03');

// Default LIVENESS/READINESS urls
const READINESS_URL = '/health';
const LIVENESS_URL = '/health';

// load the user function
const func = require('../usr');

// Configure protect for liveness/readiness probes
const protectCfg = {
  production: process.env.NODE_ENV === 'production',
  maxHeapUsedBytes: 0, // Maximum heap used threshold (0 to disable) [default 0]
  maxRssBytes: 0, // Maximum rss size threshold (0 to disable) [default 0]
  errorPropagationMode: false // Don't propagate error to callback, if something is wrong just reply with correct status code
};
const readinessURL = process.env.READINESS_URL || READINESS_URL;
const livenessURL = process.env.LIVENESS_URL || LIVENESS_URL;
const protect = protection('http', protectCfg);

// listen for incoming requests
const server = http.createServer((req, res) => {
  // Check if health path
  if (req.url === readinessURL || req.url === livenessURL) {
    protect(req, res, () => res.end("OK"))
  } else if (('ce-type' in req.headers) && req.headers['ce-type'].startsWith('dev.knative')) {
    let data = '';
    req.setEncoding('utf8');

    req.on('data', chunk => {
      data += chunk;
      if (data.length === parseInt(req.headers['content-length'], 10)) {
        // Event 'end' is not emmited at the end of every request,
        // we have to do that explicitly
        req.emit('end');
      }
    });

    req.on('end', _ => {
      let unmarshaller;
      const context = new Context(req, res);
      const version = req.headers['ce-specversion'];
      if (version === '0.2') {
        unmarshaller = new cldeventsv02.HTTPUnmarshaller();
      } else if (version === '0.3') {
        unmarshaller = new cldeventsv03.HTTPUnmarshaller();
      } else {
        console.warn(`Unknown cloud event version detected: ${version}`);
        return res.end(context);
      }

      unmarshaller.unmarshall(data, req.headers)
        .then(cldevent => {
          context.cloudevent = cldevent;
        }).catch(err => {
          console.error(err);
          context.error = err;
        }).finally(_ => {
          res.end(func(context));
        });
    });
  } else {
    res.end(func(new Context(req, res)));
  }
});

server.on('clientError', (err, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  console.log(err);
});

server.listen(8080);