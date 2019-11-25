### Knative Eventing Function as a service example
This example will use OpenShift Serverless Container Functions (OSCF), one being
a function implemented in JavaScript and the second implemented with a WASM module.
The example will use Knative Eventing to show how a eventing can be used with
OSCF functions.

Our setup will look something like this:

```
+--------------------------------------------------------------+
|                      Kubernetes                              |
|                                                              |
|  +-----------+     +------------+      +------------------+  |
|  |           |←----|js-trigger  |------|faas-js-service   |  |
|  |           |     |------------|      |+-----------------+  |
|  |           |     |   type     |                            |
|  |           |     |------------|                            |
|  |           |     |   source   |                            |
|  |           |     +------------+                            |
|  |  Broker   |                                               |
|  |           |     +------------+      +------------------+  |
|  |           |←----|wasm-trigger|------|faas-wasm-service |  |
|  |           |     |------------|      |+-----------------+  |
|  |           |     |   type     |                            |
|  |           |     |------------|                            |
|  |           |     |   source   |                            |
|  |           |     +------------+                            |
|  +-----------+                                               |
+--------------------------------------------------------------+
```
The Broker is an kubernetes custom resource definitions (CRD) which handles
events and delivers these events to subscribers. A subscriber is created using
a trigger which contains a `type` and `source` which the event will be matched
against. If these fields match the event will be delivered to the service
configured in the trigger.

The message flow in this example looks something like this:
```
             +--------------------------------------------------------------+
             |                      Kubernetes                              |
             |                                                              |
             |  +-----------+     +------------+      +------------------+  |
             |  |           |←----|js-trigger  |      |faas-js-service   |  |
             |  |           |     |------------|      +------------------+  |
             |  |           |     |   type     |         ↑      ↓           |
             |  |           |     |------------|         |      |           |
             |  |           |     |   source   |         |      |           |
+---------+  |  |           |     +------------+         |      |           |
| curl    |--|-→|  Broker   |----------------------------+      |           |
|---------|  |  |           |                                   |           |
|ce-type  |  |  |           |←----------------------------------+           |
|---------|  |  |           |                                               |
|ce-source|  |  |           |→----------------------------------+           |
+---------+  |  |           |                                   |           |
             |  |           |                                   ↓           |
             |  |           |     +------------+       +-----------------+  |
             |  |           |←----|wasm-trigger|       |faas-wasm-service|  |
             |  |           |     |------------+       +-----------------+  |
             |  |           |     |   type     |                            |
             |  +-----------+     |------------|                            |
             |                    |   source   |                            |
             |                    +------------+                            |
             |                                                              |
             +--------------------------------------------------------------+
```
We start off by sending a HTTP POST request using `curl` to the broker. This
request will contain a cloud event with various headers. Among these headers
there will be a `ce-type` and a `ce-source`. The broker will see if there are
any triggers for those headers and if so will forward the event to the `faas-js-example`.
The `faas-js-example` will respond with a cloud event and it will set the
`ce-type` and `ce-source` of the response matching the values specified in the
`wasm-trigger`.

The `faas-js-service` is a function as a service (faas) that is implemented by
the end user and is a single JavaScript function. The `faas-wasm-service` is
where the function is a function of a webassembly module that could be written
by the end user or an already existing module that the end user wants to expose.
In both cases instead of writing the actual function the end user will implement
two functions, one that extracts any arguments that the function in the wasm
takes, and the second takes the result from the function and puts it into a response
object.


First, we need to install Knative.

### Installing Knative with minikube:
```console
$ curl -Lo minikube https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64 \
  && chmod +x minikube
$ ./minikube start -p example --memory=8192 --cpus=6 --kubernetes-version=v1.15.0 --vm-driver=kvm2 --disk-size=30g --extra-config=apiserver.enable-admission-plugins="LimitRanger,NamespaceExists,NamespaceLifecycle,ResourceQuota,ServiceAccount,DefaultStorageClass,MutatingAdmissionWebhook"
```
Notice that we are using a profile which is specified with the `-p` option. We
can later stop and start this profile by using `./minikube start -p example`.

We need to use the same version of `kubectl` that matches `kubernetes` which in
our case is `1.15.0`:
```console
$ curl -LO https://storage.googleapis.com/kubernetes-release/release/v1.15.0/bin/linux/amd64/kubectl
$ chmod +x ./kubectl
$ sudo mv ./kubectl /usr/local/bin/kubectl
```

Next, we need to install istio:
```console
$ export ISTIO_VERSION=1.3.6
$ curl -L https://git.io/getLatestIstio | sh -
$ cd istio-${ISTIO_VERSION}
$ for i in install/kubernetes/helm/istio-init/files/crd*yaml; do kubectl apply -f $i; done
$ cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Namespace
metadata:
  name: istio-system
  labels:
    istio-injection: disabled
EOF
namespace/istio-system created
```

Install [helm](https://helm.sh/docs/intro/install/) which is like a package manager for kubernetes:
```console
$ curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/master/scripts/get-helm-3
$ chmod 700 get_helm.sh
$ ./get_helm.sh
```
Use help to create a the istio resources configurations:
```console
$ helm template --namespace=istio-system \
  --set prometheus.enabled=false \
  --set mixer.enabled=false \
  --set mixer.policy.enabled=false \
  --set mixer.telemetry.enabled=false \
  `# Pilot doesn't need a sidecar.` \
  --set pilot.sidecar=false \
  --set pilot.resources.requests.memory=128Mi \
  `# Disable galley (and things requiring galley).` \
  --set galley.enabled=false \
  --set global.useMCP=false \
  `# Disable security / policy.` \
  --set security.enabled=false \
  --set global.disablePolicyChecks=true \
  `# Disable sidecar injection.` \
  --set sidecarInjectorWebhook.enabled=false \
  --set global.proxy.autoInject=disabled \
  --set global.omitSidecarInjectorConfigMap=true \
  --set gateways.istio-ingressgateway.autoscaleMin=1 \
  --set gateways.istio-ingressgateway.autoscaleMax=2 \
  `# Set pilot trace sampling to 100%` \
  --set pilot.traceSampling=100 \
  --set global.mtls.auto=false \
  install/kubernetes/helm/istio \
  > ./istio-lean.yaml
```
And now apply these resources to kubernetes:
```console
$ kubectl apply -f istio-lean.yaml
```
Verify that istio is installed:
```console
$ kubectl get pods --namespace istio-system -w
NAME                                   READY   STATUS    RESTARTS   AGE
istio-ingressgateway-5d9bc67ff-cgfcp   0/1     Running   0          29s
istio-pilot-54c8644bc5-8jh47           0/1     Running   0          29s
istio-pilot-54c8644bc5-8jh47           1/1     Running   0          61s
```

Next, we install Knative itself:
```console
$ kubectl apply --selector knative.dev/crd-install=true --filename https://github.com/knative/serving/releases/download/v0.12.0/serving.yaml --filename https://github.com/knative/eventing/releases/download/v0.12.0/eventing.yaml --filename https://github.com/knative/serving/releases/download/v0.12.0/monitoring.yaml

$ kubectl apply --filename https://github.com/knative/serving/releases/download/v0.12.0/serving.yaml --filename https://github.com/knative/eventing/releases/download/v0.12.0/eventing.yaml --filename https://github.com/knative/serving/releases/download/v0.12.0/monitoring.yaml 
```

Verify that Knative has been installed correctly:
```console
$ kubectl get pods --namespace knative-serving -w
NAME                               READY   STATUS    RESTARTS   AGE
activator-6b49796b46-lww55         1/1     Running   0          12m
autoscaler-7b46fcb475-lclgc        1/1     Running   0          12m
autoscaler-hpa-797c8c8647-zmrkc    1/1     Running   0          12m
controller-65f4f4bcb4-8gq7r        1/1     Running   0          12m
networking-istio-87d7c6686-tzvsk   1/1     Running   0          12m
webhook-59585cb6-vrmx8             1/1     Running   0          12m
```

### Build and deploy the example

We need to build and push the container image that we our JavaScript service is
going to use:
```console
$ docker build -t {username}/faas-js-example . 
```
After this we have to push the image to our user account on docker hub:
```console
$ docker login -u {username} -p {password} docker.io
$ docker push f0b92ab1e443 docker://docker.io/{username}/faas-js-example
```

Now, we deploy a namespace for our demo and with knative-eventing-injection
enabled:
```console
$ kubectl apply -f namespace.yaml
$ kubectl get ns js-example-service --show-labels
NAME                 STATUS   AGE     LABELS
js-example-service   Active   4d19h   knative-eventing-injection=enabled
```
Set the current context to our example namespace:
```console
$ kubectl config set-context --current --namespace=js-example-service
```

Create a secret that we can use to pull images our user on docker.io:
```console
$ kubectl --namespace js-example-service create secret docker-registry registry-secret --docker-server=https://index.docker.io/v1/ --docker-username={username} --docker-password={password} --docker-email={email}
```

Next, we create a deployment for our application:
```console
$ kubectl apply -f js-deployment.yaml
$ kubectl get deployments js-example-service
NAME                 READY   UP-TO-DATE   AVAILABLE   AGE
js-example-service   1/1     1            1           3d22h
```

Next we will create a service for our application, the deployment above:
```console
$ kubectl apply -f js-service.yaml
$ kubectl get svc js-example-service
NAME                 TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)   AGE
js-example-service   ClusterIP   10.103.182.147   <none>        80/TCP    3d22h
```

Next we create the trigger which is used by the Broker to filter events and
send them to our service:
```console
$ kubectl apply -f js-trigger.yaml
$ kubectl get trigger js-example-service
NAME                 READY   REASON   BROKER    SUBSCRIBER_URI                                                    AGE
js-example-service   True             default   http://js-example-service.js-example-service.svc.cluster.local/   3d22h
```
We can find the url of the `Broker` which we can use to POST events to:
```console
$ kubectl get broker
NAME      READY   REASON   URL                                                          AGE
default   True             http://default-broker.js-example-service.svc.cluster.local   5d
```
Next, we are going to POST a event using curl:
```console
$ kubectl run curl --image=radial/busyboxplus:curl -it
$ curl -v "default-broker.js-example-service.svc.cluster.local" -X POST -H "Ce-Id: 536808d3-88be-4077-9d7a-a3f162705f79" -H "Ce-specversion: 0.3" -H "Ce-Type: dev.nodeshift.samples.js-example" -H "Ce-Source: dev.nodeshift.samples/js-example-source" -H "Content-Type: application/json" -d '{"msg":"Message to js-example-service"}'
```

Now we can check the logs of our pod to see that it has received the event:
```console
$ kubectl get pod -l='app=js-example-service'
NAME                                  READY   STATUS    RESTARTS   AGE
js-example-service-5dc5bf944b-rcfg6   1/1     Running   0          4d3h
$ kubectl logs js-example-service-5dc5bf944b-rcfg6
{"level":30,"time":1580218523955,"pid":8,"hostname":"js-example-service-7bf4bd5fd8-qbc8z","reqId":1,"req":{"method":"POST","url":"/","hostname":"js-example-service.js-example-service.svc.cluster.local","remoteAddress":"172.17.0.27","remotePort":49310},"msg":"incoming request","v":1}
simple example. context: Context {
  __ow_user: '',
  __ow_method: 'POST',
  __ow_headers: {
    host: 'js-example-service.js-example-service.svc.cluster.local',
    'user-agent': 'Go-http-client/1.1',
    'content-length': '39',
    'ce-id': '536808d3-88be-4077-9d7a-a3f162705f79',
    'ce-knativearrivaltime': '2020-01-28T13:35:23.933837933Z',
    'ce-knativehistory': 'default-kne-trigger-kn-channel.js-example-service.svc.cluster.local',
    'ce-source': 'dev.nodeshift.samples/js-example-source',
    'ce-specversion': '0.3',
    'ce-time': '2020-01-28T13:35:23.934578875Z',
    'ce-traceparent': '00-b9b7f4223534cbe17594277426dfa96a-b8ef917a5516e8f2-00',
    'ce-type': 'dev.nodeshift.samples.js-example',
    'content-type': 'application/json',
    'x-b3-sampled': '0',
    'x-b3-spanid': 'beb7a6920ddb171a',
    'x-b3-traceid': 'b9b7f4223534cbe17594277426dfa96a',
    'accept-encoding': 'gzip'
  },
  __ow_path: '',
  __ow_query: [Object: null prototype] {},
  __ow_body: 'null',
  cloudevent: {
    specversion: '0.3',
    id: '536808d3-88be-4077-9d7a-a3f162705f79',
    type: 'dev.nodeshift.samples.js-example',
    source: 'dev.nodeshift.samples/js-example-source',
    time: '2020-01-28T13:35:23.934Z',
    datacontenttype: 'application/json',
    knativearrivaltime: '2020-01-28T13:35:23.933837933Z',
    knativehistory: 'default-kne-trigger-kn-channel.js-example-service.svc.cluster.local',
    traceparent: '00-b9b7f4223534cbe17594277426dfa96a-b8ef917a5516e8f2-00',
    data: { msg: 'Message to js-example-service' }
  }
}
{"level":30,"time":1580218524465,"pid":8,"hostname":"js-example-service-7bf4bd5fd8-qbc8z","reqId":1,"res":{"statusCode":200},"responseTime":508.7998279929161,"msg":"request completed","v":1}
```

Next we want to deploy our WASM image that we will be using. 
Build the wasm image:
```
$ git clone -b knative-demo git@github.com:danbev/faas-wasi-runtime-example.git
$ cd faas-wasi-runtime-example
$ docker build -t <username>/faas-wasi-example . --pull-always
$ docker push <image-id> docker.io/<username>/faas-wasm-example:latest
$ cd ..
```

Next, we apply the deployment for the application:
```console
$ kubectl apply -f wasm-deployment.yaml
```
And then we have the service for it:
```console
$ kubectl apply -f wasm-service.yaml
```
And finally the trigger:
```console
$ kubectl apply -f wasm-trigger.yaml
```

Next, we are going to POST a event to the Broker like we did above to verify
that the JavaScript function worked. It will also send a response back to the
Broker which contains a CloudEvent. The wasm-trigger above sets up the WASM service
to subscribe to these events.

```console
$ kubectl run curl --image=radial/busyboxplus:curl -it
$ curl -v "default-broker.js-example-service.svc.cluster.local" -X POST -H "Ce-Id: 536808d3-88be-4077-9d7a-a3f162705f79" -H "Ce-specversion: 0.3" -H "Ce-Type: dev.nodeshift.samples.js-example" -H "Ce-Source: dev.nodeshift.samples/js-example-source" -H "Content-Type: application/json" -d '{"msg":"Message to js-example-service4"}'
```
This should show up in the log for the js-example-service, and we should see that it returns
an event for the broker to consume. This will then be delivered to the wasm-example-service
which only logs the request at the moment. 

```console
$ kubectl logs wasm-example-service-7789548dd4-qftcx
WASI Runtime started. Port: 8080, Module path: /home/wasi/module/add.wasm
CloudEvent: Context { user: "", method: Post, headers: {"Host": "wasm-example-service.js-example-service.svc.cluster.local", "User-Agent": "Go-http-client/1.1", "Content-Length": "45", "Ce-Datacontenttype": "application/json", "Ce-Id": "536808d3-88be-4077-9d7a-a3f162705f79", "Ce-Knativearrivaltime": "2020-01-30T05:32:21.746605745Z", "Ce-Knativehistory": "default-kne-trigger-kn-channel.js-example-service.svc.cluster.local", "Ce-Source": "nodeshift/samples/js-example-service", "Ce-Specversion": "0.3", "Ce-Time": "2020-01-30T05:32:21.697090118Z", "Ce-Traceparent": "00-91bbc5621ebee589a707220eee25e8ab-997f6eb23951a2ef-00", "Ce-Type": "dev.nodeshift.samples.fromjs", "Content-Type": "application/json; charset=utf8", "X-B3-Sampled": "0", "X-B3-Spanid": "b562ae3afb52eeb5", "X-B3-Traceid": "91bbc5621ebee589a707220eee25e8ab", "Accept-Encoding": "gzip"}, path: "/", query: None, body: Some(Body(Chan { close_tx: Sender { inner: Inner { complete: false, data: Lock { locked: false, data: UnsafeCell }, rx_task: Lock { locked: false, data: UnsafeCell }, tx_task: Lock { locked: false, data: UnsafeCell } } }, rx: Receiver { inner: Inner { buffer: Some(0), state: 9223372036854775808, message_queue: Queue { head: 0x1095780, tail: UnsafeCell }, parked_queue: Queue { head: 0x10957c0, tail: UnsafeCell }, num_senders: 1, recv_task: Mutex { data: ReceiverTask { unparked: false, task: None } } } } })), cloudevent: None }

WASM Response: Ok(
    "module: /home/wasi/module/add.wasm, function: add, returned 18: i32",
)
```

It might be insteresting to note the sizes of these images:
```console
$ minikube ssh -p example
                         _             _            
            _         _ ( )           ( )           
  ___ ___  (_)  ___  (_)| |/')  _   _ | |_      __  
/' _ ` _ `\| |/' _ `\| || , <  ( ) ( )| '_`\  /'__`\
| ( ) ( ) || || ( ) || || |\`\ | (_) || |_) )(  ___/
(_) (_) (_)(_)(_) (_)(_)(_) (_)`\___/'(_,__/'`\____)

$ docker images
REPOSITORY                                                                      TAG                 IMAGE ID            CREATED             SIZE
dbevenius/faas-wasm-example                                                     latest              d7fd96d92709        7 hours ago         12.7MB
dbevenius/faas-js-example                                                       latest              696c383460f4        26 hours ago        100MB
```
Having a smaller image could mean that you can run more services/functions on the
same hardware.


