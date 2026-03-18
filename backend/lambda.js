const serverless = require('serverless-http');
const app = require('./server');

module.exports.handler = serverless(app, {
  request(request, event) {
    request.requestContext = event.requestContext;
    request.apiGateway = {
      event,
    };
  },
});
