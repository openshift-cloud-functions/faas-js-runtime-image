# FaaS Node.js Runtime Image [![CircleCI](https://circleci.com/gh/openshift-cloud-functions/faas-js-runtime-image.svg?style=svg)](https://circleci.com/gh/openshift-cloud-functions/faas-js-runtime-image)

This image is meant to run in an OpenShift cluster with Knative installed.
It is currently under development and incomplete. When a container for this
image starts, a process loads the JavaScript in `/home/node/usr` on the container
file system. If there is a  `package.json` file in the directory, the bootstrap
process will run `npm install` before loading the function.

## Source to Image

This image may also be used as a [source to image builder](https://github.com/openshift/source-to-image).


## Limitations

* The image currently responds to `HTTP` requests on port `8080` and to Knative Events, which users can
consume as `CloudEvent` object.
* The function is passed a `Context` object when it is called. This object
currently contains little to no valuable information beyond the Node.js
[`http.IncomingMessage`](https://nodejs.org/api/http.html#http_class_http_incomingmessage) (the request), 
[`http.ServerResponse`](https://nodejs.org/api/http.html#http_class_http_serverresponse) objects and
[`cloudevent`](https://github.com/cloudevents/spec/blob/v0.3/spec.md) object, which is instantiated if
the function responds to incoming Knative Event.

Surely there are other limitations, but this is enough for plenty of discussion
at the moment.

## Building

To build the image, run the following command.

```sh
make build
```

You should end up with an image at `redhat-faas/js-runtime`.

## Running locally

You can run this image locally to play around with it, test edges and 
generally get a feel for how it works. First, create a directory containing
one or more JavaScript files. One of these must be named `index.js`. The
bootstrap process will load this file and any other files it references
via module dependencies (e.g. `const myCalc = require('./my-calc.js');`).
If you have external, third party dependencies from npmjs.com, add a
`package.json` to the directory specifying the `dependencies`. 

With the source in place, you can start the container and mount the source
onto a container directory. The bootstrap process expects `/home/node/usr`
to contain the runtime source code. To mount this into a running container
execute the following command.

```sh
docker run --rm -a stdout -a stderr -v /path/to/local/source/dir:/home/node/usr -p 8080:8080 oscf/js-runtime:candidate
```

To stop the running container:
```sh
$ docker ps
$ docker stop <CONTAINER ID>
```

## Testing

To test the image, run the following command.

```sh
make test
```

This will build a candidate image, and mount the `./test` directory on the host
to the `/home/node/usr` directory on the running container. When the container
starts, a bootstrap process loads the test JavaScript in `/home/node/usr`. 