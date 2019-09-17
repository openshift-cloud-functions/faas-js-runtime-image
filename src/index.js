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

  // Unmarshall Knative Eventing request to CloudEvent
  } else if (('ce-type' in req.headers) && req.headers['ce-type'].startsWith('dev.knative')) {
    var data = "";
    req.setEncoding('utf8');

    req.on('data', function (chunk) {
      data += chunk;
      if (data.length == parseInt(req.headers['content-length'], 10)) {
        // Event 'end' is not emmited at the end of every request,
        // we have to do that explicitly
        req.emit('end');
      }
    });

    req.on('end', function () {
      var unmarshaller = null;
      if (req.headers['ce-specversion'] == '0.2') {
        unmarshaller = new cldeventsv02.HTTPUnmarshaller();
      } else if (req.headers['ce-specversion'] == '0.3') {
        unmarshaller = new cldeventsv03.HTTPUnmarshaller();
      }
      unmarshaller.unmarshall(data, req.headers)
        .then(cldevent => {
          res.end(func(new Context(req, res, cldevent)));
        }).catch(err => {
          console.error(err);
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