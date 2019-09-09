const cldeventsv02 = require('cloudevents-sdk/v02');
const cldeventsv03 = require('cloudevents-sdk/v03');

class Context {
  constructor(request, response) {
    this.request = request;
    this.response = response;

    // Unmarshall Knative Eventing request to cloudevent
    if (('ce-type' in request.headers) && request.headers['ce-type'].startsWith('dev.knative')) {
      var data = "";
      request.setEncoding('utf8');

      request.on('data', function (chunk) {
        data += chunk;
        if (data.length == parseInt(request.headers['content-length'], 10)) {
          // Event 'end' is not emmited at the end of every request,
          // we have to do that explicitly
          request.emit('end');
        }
      });

      request.on('end', function () {
        var unmarshaller = null;
        if (request.headers['ce-specversion'] == '0.2') {
          unmarshaller = new cldeventsv02.HTTPUnmarshaller();
        } else if (request.headers['ce-specversion'] == '0.3') {
          unmarshaller = new cldeventsv03.HTTPUnmarshaller();
        }
        unmarshaller.unmarshall(data, request.headers)
          .then(cldevent => {
            this.cloudevent = cldevent;
          }).catch(err => {
            console.error(err);
            this.error = err;
          });
      });

    }

  }
}

module.exports = Context;