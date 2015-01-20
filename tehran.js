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
  console.assert(scriptFolder, 'missing current script folder');

  function namedNodeMapToObject(map) {
    var result = {};
    Array.prototype.forEach.call(map, function (attr) {
      result[attr.name] = attr.value;
    });
    return result;
  }

  function getScriptAttributes(name) {
    name = name || 'tehran';
    var scriptEls = document.getElementsByTagName('script');
    var found;
    Array.prototype.some.call(scriptEls, function (script) {
      if (script.attributes.name && script.attributes.name.value === name) {
        found = namedNodeMapToObject(script.attributes);
        return true;
      }
    });
    return found;
  }

  function installedTehran() {
    console.log('installed code coverage interceptor Tehran');
    var options = getScriptAttributes('tehran');
    console.log('script attributes', options);
  }

  function errorInstallingTehran() {
    console.error('no luck loading service worker', err);
  }

  navigator.serviceWorker.register(scriptFolder + 'service-tehran.js')
    .then(installedTehran, errorInstallingTehran);

}(window));
