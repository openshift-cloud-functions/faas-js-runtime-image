const http = require('http');
const Context = require('./context.js');
const protection = require('overload-protection');

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
  } else {
    res.end(func(new Context(req, res)));
  }
});

server.on('clientError', (err, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  console.log(err);
});

server.listen(8181);