importScripts('deps.js');
var instrumenter = new Instrumenter();

/* global self, Response */
var myName = 'service-tehran';
console.log(myName, 'startup');

self.addEventListener('install', function () {
  console.log(myName, 'installed');
});

self.addEventListener('activate', function () {
  console.log(myName, 'activated');
});

var allowJavaScriptFromAnywhere = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'text/javascript; charset=utf-8'
};

function javascriptResponse(src) {
  var responseOptions = {
    status: 200,
    headers: allowJavaScriptFromAnywhere
  };
  return new Response(src, responseOptions);
}

function shouldInstrument(url) {
  return /foo\.js$/.test(url);
}

self.addEventListener('fetch', function (event) {
  console.log(myName, 'fetch', event);

  if (shouldInstrument(event.request.url)) {
    event.respondWith(
      self.fetch(event.request.clone())
        .then(function (response) {
          // response has possible text / json / blob as promises
          return response.text().then(function (src) {
            // console.log('original source');
            // console.log(src);
            // src - original source code
            // var transformedSource = 'console.log("hi there, from ServiceWorker!");';
            var url = new URL(event.request.url);
            var transformedSource = instrumenter.instrumentSync(src, url.pathname);
            // construct new response with changed JavaScript source
            return javascriptResponse(transformedSource);
          });
        })
    );
    return;
  }

});

// use window.navigator.serviceWorker.controller.postMessage('hi')
// to communicate with this service worker
/*
self.onmessage = function onMessage(event) {
  console.log('message to service worker', event.data);

  if (event.data === 'clear') {
    mocks = {};
    return;
  }

  if (event.data.url) {
    console.log('registering mock response for url', event.data.url);

    mocks = mocks || {};
    mocks[event.data.url] = event.data;
  }
};
*/
