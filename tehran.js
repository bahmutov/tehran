(function registerTehran(root) {

  if (!navigator) {
    console.error('Missing navigator object');
    return;
  }

  if (!navigator.serviceWorker) {
    console.error('Sorry, not ServiceWorker feature, maybe enable it?');
    console.error('http://jakearchibald.com/2014/using-serviceworker-today/');
  }

  function getCurrentScriptFolder() {
    var scriptEls = document.getElementsByTagName( 'script' );
    var thisScriptEl = scriptEls[scriptEls.length - 1];
    var scriptPath = thisScriptEl.src;
    return scriptPath.substr(0, scriptPath.lastIndexOf( '/' ) + 1 );
  }

  var scriptFolder = getCurrentScriptFolder();

  function installedTehran() {
    console.log('installed code coverage interceptor Tehran');
  }

  function errorInstallingTehran() {
    console.error('no luck loading service worker', err);
  }

  navigator.serviceWorker.register(scriptFolder + 'service-tehran.js')
    .then(installedTehran, errorInstallingTehran);

}(window));
