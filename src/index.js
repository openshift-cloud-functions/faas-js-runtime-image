const http = require('http');
const Context = require('./context.js');

// load the user function
const func = require('../usr');

// listen for incoming requests
const server = http.createServer((req, res) => {
  res.end(func(new Context(req, res)));
});

server.on('clientError', (err, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  console.log(err);
});

server.listen(8080);