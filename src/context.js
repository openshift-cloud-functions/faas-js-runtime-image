class Context {
  constructor(request, response, cloudevent) {
    this.request = request;
    this.response = response;
    this.cloudevent = cloudevent;
  }
}

module.exports = Context;