/**
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// This generated service worker JavaScript will precache your site's resources.
// The code needs to be saved in a .js file at the top-level of your site, and registered
// from your pages in order to be used. See
// https://github.com/googlechrome/sw-precache/blob/master/demo/app/js/service-worker-registration.js
// for an example of how you can register this script and handle various service worker events.

/* eslint-env worker, serviceworker */
/* eslint-disable indent, no-unused-vars, no-multiple-empty-lines, max-nested-callbacks, space-before-function-paren */
'use strict';





/* eslint-disable quotes, comma-spacing */
var PrecacheConfig = [["/css/angular-ui-tree.min.css","41eb2b5531acc563de700836dc6e797a"],["/css/bootstrap-theme.css","8c6ad2433e82a311530e4ebe3aebf39f"],["/css/bootstrap-theme.min.css","95eb835999f0c2f1f3218d46e6c30137"],["/css/bootstrap.css","d2ab08de4855f3f73d2ecec6da794293"],["/css/bootstrap.min.css","3ab3438f85ad9f9e27e1af1facf0a9c4"],["/css/styles.css","57a872fea633e7c29b60cef69cb14a0e"],["/css/tree.css","5dba60dd9e7bb2342130f48fd9f97e25"],["/fonts/glyphicons-halflings-regular.eot","7ad17c6085dee9a33787bac28fb23d46"],["/fonts/glyphicons-halflings-regular.svg","ff423a4251cf2986555523dfe315c42b"],["/fonts/glyphicons-halflings-regular.ttf","e49d52e74b7689a0727def99da31f3eb"],["/fonts/glyphicons-halflings-regular.woff","68ed1dac06bf0409c18ae7bc62889170"],["/img/clipboard.png","ba2d5ba74ca7e89ff002cb60d7e27500"],["/img/compare.png","27841caf802697b4c65d8d2dd8ec9e14"],["/img/folder_old.gif","08c5276ccec1e43cc5f3c6d0be5d2b8b"],["/img/hexrepr.png","8e4d0975259fc5056f210194c71f8324"],["/img/inspector.png","8bf0601c71952b7906c4ce8521af30c9"],["/img/loader.gif","be1cede97289c13920048f238fd37b85"],["/img/tabs.png","17749a837983498e89a77f9e30985ef3"],["/index.html","8a58a670c855eb9aa1521fe1f3bf7cde"],["/index.js","f70dbc1ea0e9587e6dd9b125933c4482"],["/lib/bootstrap-contextmenu.js","b62d884f2c4aa64f1738806791699f6d"],["/lib/bootstrap.min.js","2616d3564578d8f845813483352802a9"],["/lib/jquery-2.1.3.min.js","32015dd42e9582a80a84736f5d9a44d7"],["/lib/jquery.mousewheel.js","426ff44fdde60c9e548a11806e5e9681"],["/lib/sw.js","a67886b7af0f2865ab00038a8a3c401f"],["/lib/webfont.js","413ee338ba7ccd4f6cad6b99369496f4"],["/material/css/material-wfont.css","c823f54b57b9b1eb56f8e7a8cf95969b"],["/material/css/material-wfont.min.css","6ad8195ba3818ad11111b843a6541fe6"],["/material/css/material.css","e6398712df943ef1842ae6bc9f8687bd"],["/material/css/material.min.css","31025babbf238e775018a60a296930e5"],["/material/css/ripples.css","9b931b0205131fee5c1b630f1d24a9f8"],["/material/css/ripples.min.css","a229494e15cf97b7e248214b0b789b5f"],["/material/fonts/Material-Design-Icons.eot","d23b5163599596ee8fed5e6c4fce824d"],["/material/fonts/Material-Design-Icons.svg","98311456903486ecf6f8f705bee85781"],["/material/fonts/Material-Design-Icons.ttf","2635ab518b71cfe3d4241741689d8894"],["/material/fonts/Material-Design-Icons.woff","0fc5952b2ad99db0fa1a49c2e0fd5928"],["/material/js/material.js","19fb3b046f37bccaad4f44fab4a0fbe8"],["/material/js/material.min.js","636fa689e442f7d91eb57352239027cd"],["/material/js/ripples.js","e6d1d9e0220a88ce0cf0f69a4f8d72e4"],["/material/js/ripples.min.js","b0dd98a52ca09d4aecdc032a49bdd1b4"],["/templates/eng.html","fdade688e7fe4a5327c040f4485aad51"],["/templates/rus.html","d777a7e6c8a4a2a4cca83a26096ddf7c"],["/test/binbuf_test.js","7f01ea7f23058476e237c71921bec245"],["/test/hexview_test.js","2de5934c64287860639aa4c6e59776e4"],["/test/runner.html","d59752b56c514bd3baa2bf5afdd74216"],["/test/test_maincontroller.js","904eb2ef73d084e691f4ff941370d000"],["/test/utils_test.js","8ef7936c5ea92f56cdbe2e3f3f69f325"]];
/* eslint-enable quotes, comma-spacing */
var CacheNamePrefix = 'sw-precache-v1--' + (self.registration ? self.registration.scope : '') + '-';


var IgnoreUrlParametersMatching = [/^utm_/];



var addDirectoryIndex = function (originalUrl, index) {
    var url = new URL(originalUrl);
    if (url.pathname.slice(-1) === '/') {
      url.pathname += index;
    }
    return url.toString();
  };

var getCacheBustedUrl = function (url, param) {
    param = param || Date.now();

    var urlWithCacheBusting = new URL(url);
    urlWithCacheBusting.search += (urlWithCacheBusting.search ? '&' : '') +
      'sw-precache=' + param;

    return urlWithCacheBusting.toString();
  };

var isPathWhitelisted = function (whitelist, absoluteUrlString) {
    // If the whitelist is empty, then consider all URLs to be whitelisted.
    if (whitelist.length === 0) {
      return true;
    }

    // Otherwise compare each path regex to the path of the URL passed in.
    var path = (new URL(absoluteUrlString)).pathname;
    return whitelist.some(function(whitelistedPathRegex) {
      return path.match(whitelistedPathRegex);
    });
  };

var populateCurrentCacheNames = function (precacheConfig,
    cacheNamePrefix, baseUrl) {
    var absoluteUrlToCacheName = {};
    var currentCacheNamesToAbsoluteUrl = {};

    precacheConfig.forEach(function(cacheOption) {
      var absoluteUrl = new URL(cacheOption[0], baseUrl).toString();
      var cacheName = cacheNamePrefix + absoluteUrl + '-' + cacheOption[1];
      currentCacheNamesToAbsoluteUrl[cacheName] = absoluteUrl;
      absoluteUrlToCacheName[absoluteUrl] = cacheName;
    });

    return {
      absoluteUrlToCacheName: absoluteUrlToCacheName,
      currentCacheNamesToAbsoluteUrl: currentCacheNamesToAbsoluteUrl
    };
  };

var stripIgnoredUrlParameters = function (originalUrl,
    ignoreUrlParametersMatching) {
    var url = new URL(originalUrl);

    url.search = url.search.slice(1) // Exclude initial '?'
      .split('&') // Split into an array of 'key=value' strings
      .map(function(kv) {
        return kv.split('='); // Split each 'key=value' string into a [key, value] array
      })
      .filter(function(kv) {
        return ignoreUrlParametersMatching.every(function(ignoredRegex) {
          return !ignoredRegex.test(kv[0]); // Return true iff the key doesn't match any of the regexes.
        });
      })
      .map(function(kv) {
        return kv.join('='); // Join each [key, value] array into a 'key=value' string
      })
      .join('&'); // Join the array of 'key=value' strings into a string with '&' in between each

    return url.toString();
  };


var mappings = populateCurrentCacheNames(PrecacheConfig, CacheNamePrefix, self.location);
var AbsoluteUrlToCacheName = mappings.absoluteUrlToCacheName;
var CurrentCacheNamesToAbsoluteUrl = mappings.currentCacheNamesToAbsoluteUrl;

function deleteAllCaches() {
  return caches.keys().then(function(cacheNames) {
    return Promise.all(
      cacheNames.map(function(cacheName) {
        return caches.delete(cacheName);
      })
    );
  });
}

self.addEventListener('install', function(event) {
  event.waitUntil(
    // Take a look at each of the cache names we expect for this version.
    Promise.all(Object.keys(CurrentCacheNamesToAbsoluteUrl).map(function(cacheName) {
      return caches.open(cacheName).then(function(cache) {
        // Get a list of all the entries in the specific named cache.
        // For caches that are already populated for a given version of a
        // resource, there should be 1 entry.
        return cache.keys().then(function(keys) {
          // If there are 0 entries, either because this is a brand new version
          // of a resource or because the install step was interrupted the
          // last time it ran, then we need to populate the cache.
          if (keys.length === 0) {
            // Use the last bit of the cache name, which contains the hash,
            // as the cache-busting parameter.
            // See https://github.com/GoogleChrome/sw-precache/issues/100
            var cacheBustParam = cacheName.split('-').pop();
            var urlWithCacheBusting = getCacheBustedUrl(
              CurrentCacheNamesToAbsoluteUrl[cacheName], cacheBustParam);

            var request = new Request(urlWithCacheBusting,
              {credentials: 'same-origin'});
            return fetch(request).then(function(response) {
              if (response.ok) {
                return cache.put(CurrentCacheNamesToAbsoluteUrl[cacheName],
                  response);
              }

              console.error('Request for %s returned a response status %d, ' +
                'so not attempting to cache it.',
                urlWithCacheBusting, response.status);
              // Get rid of the empty cache if we can't add a successful response to it.
              return caches.delete(cacheName);
            });
          }
        });
      });
    })).then(function() {
      return caches.keys().then(function(allCacheNames) {
        return Promise.all(allCacheNames.filter(function(cacheName) {
          return cacheName.indexOf(CacheNamePrefix) === 0 &&
            !(cacheName in CurrentCacheNamesToAbsoluteUrl);
          }).map(function(cacheName) {
            return caches.delete(cacheName);
          })
        );
      });
    }).then(function() {
      if (typeof self.skipWaiting === 'function') {
        // Force the SW to transition from installing -> active state
        self.skipWaiting();
      }
    })
  );
});

if (self.clients && (typeof self.clients.claim === 'function')) {
  self.addEventListener('activate', function(event) {
    event.waitUntil(self.clients.claim());
  });
}

self.addEventListener('message', function(event) {
  if (event.data.command === 'delete_all') {
    console.log('About to delete all caches...');
    deleteAllCaches().then(function() {
      console.log('Caches deleted.');
      event.ports[0].postMessage({
        error: null
      });
    }).catch(function(error) {
      console.log('Caches not deleted:', error);
      event.ports[0].postMessage({
        error: error
      });
    });
  }
});


self.addEventListener('fetch', function(event) {
  if (event.request.method === 'GET') {
    var urlWithoutIgnoredParameters = stripIgnoredUrlParameters(event.request.url,
      IgnoreUrlParametersMatching);

    var cacheName = AbsoluteUrlToCacheName[urlWithoutIgnoredParameters];
    var directoryIndex = 'index.html';
    if (!cacheName && directoryIndex) {
      urlWithoutIgnoredParameters = addDirectoryIndex(urlWithoutIgnoredParameters, directoryIndex);
      cacheName = AbsoluteUrlToCacheName[urlWithoutIgnoredParameters];
    }

    var navigateFallback = '';
    // Ideally, this would check for event.request.mode === 'navigate', but that is not widely
    // supported yet:
    // https://code.google.com/p/chromium/issues/detail?id=540967
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1209081
    if (!cacheName && navigateFallback && event.request.headers.has('accept') &&
        event.request.headers.get('accept').includes('text/html') &&
        /* eslint-disable quotes, comma-spacing */
        isPathWhitelisted([], event.request.url)) {
        /* eslint-enable quotes, comma-spacing */
      var navigateFallbackUrl = new URL(navigateFallback, self.location);
      cacheName = AbsoluteUrlToCacheName[navigateFallbackUrl.toString()];
    }

    if (cacheName) {
      event.respondWith(
        // Rely on the fact that each cache we manage should only have one entry, and return that.
        caches.open(cacheName).then(function(cache) {
          return cache.keys().then(function(keys) {
            return cache.match(keys[0]).then(function(response) {
              if (response) {
                return response;
              }
              // If for some reason the response was deleted from the cache,
              // raise and exception and fall back to the fetch() triggered in the catch().
              throw Error('The cache ' + cacheName + ' is empty.');
            });
          });
        }).catch(function(e) {
          console.warn('Couldn\'t serve response for "%s" from cache: %O', event.request.url, e);
          return fetch(event.request);
        })
      );
    }
  }
});




