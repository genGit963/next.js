/**
 * @license React
 * react-server-dom-webpack-client.browser.development.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

if (process.env.NODE_ENV !== "production") {
  (function() {
'use strict';

var ReactDOM = require('react-dom');
var React = require('react');

// -----------------------------------------------------------------------------
var enableBinaryFlight = false;

function createStringDecoder() {
  return new TextDecoder();
}
var decoderOptions = {
  stream: true
};
function readPartialStringChunk(decoder, buffer) {
  return decoder.decode(buffer, decoderOptions);
}
function readFinalStringChunk(decoder, buffer) {
  return decoder.decode(buffer);
}

var badgeFormat = '%c%s%c '; // Same badge styling as DevTools.

var badgeStyle = // We use a fixed background if light-dark is not supported, otherwise
// we use a transparent background.
'background: #e6e6e6;' + 'background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));' + 'color: #000000;' + 'color: light-dark(#000000, #ffffff);' + 'border-radius: 2px';
var resetStyle = '';
var pad = ' ';
function printToConsole(methodName, args, badgeName) {
  var offset = 0;

  switch (methodName) {
    case 'dir':
    case 'dirxml':
    case 'groupEnd':
    case 'table':
      {
        // These methods cannot be colorized because they don't take a formatting string.
        // eslint-disable-next-line react-internal/no-production-logging
        console[methodName].apply(console, args);
        return;
      }

    case 'assert':
      {
        // assert takes formatting options as the second argument.
        offset = 1;
      }
  }

  var newArgs = args.slice(0);

  if (typeof newArgs[offset] === 'string') {
    newArgs.splice(offset, 1, badgeFormat + newArgs[offset], badgeStyle, pad + badgeName + pad, resetStyle);
  } else {
    newArgs.splice(offset, 0, badgeFormat, badgeStyle, pad + badgeName + pad, resetStyle);
  } // eslint-disable-next-line react-internal/no-production-logging


  console[methodName].apply(console, newArgs);
  return;
}

// This is the parsed shape of the wire format which is why it is
// condensed to only the essentialy information
var ID = 0;
var CHUNKS = 1;
var NAME = 2; // export const ASYNC = 3;
// This logic is correct because currently only include the 4th tuple member
// when the module is async. If that changes we will need to actually assert
// the value is true. We don't index into the 4th slot because flow does not
// like the potential out of bounds access

function isAsyncImport(metadata) {
  return metadata.length === 4;
}

function resolveClientReference(bundlerConfig, metadata) {
  if (bundlerConfig) {
    var moduleExports = bundlerConfig[metadata[ID]];
    var resolvedModuleData = moduleExports[metadata[NAME]];
    var name;

    if (resolvedModuleData) {
      // The potentially aliased name.
      name = resolvedModuleData.name;
    } else {
      // If we don't have this specific name, we might have the full module.
      resolvedModuleData = moduleExports['*'];

      if (!resolvedModuleData) {
        throw new Error('Could not find the module "' + metadata[ID] + '" in the React SSR Manifest. ' + 'This is probably a bug in the React Server Components bundler.');
      }

      name = metadata[NAME];
    }

    if (isAsyncImport(metadata)) {
      return [resolvedModuleData.id, resolvedModuleData.chunks, name, 1
      /* async */
      ];
    } else {
      return [resolvedModuleData.id, resolvedModuleData.chunks, name];
    }
  }

  return metadata;
}
// If they're still pending they're a thenable. This map also exists
// in Webpack but unfortunately it's not exposed so we have to
// replicate it in user space. null means that it has already loaded.

var chunkCache = new Map();

function requireAsyncModule(id) {
  // We've already loaded all the chunks. We can require the module.
  var promise = __webpack_require__(id);

  if (typeof promise.then !== 'function') {
    // This wasn't a promise after all.
    return null;
  } else if (promise.status === 'fulfilled') {
    // This module was already resolved earlier.
    return null;
  } else {
    // Instrument the Promise to stash the result.
    promise.then(function (value) {
      var fulfilledThenable = promise;
      fulfilledThenable.status = 'fulfilled';
      fulfilledThenable.value = value;
    }, function (reason) {
      var rejectedThenable = promise;
      rejectedThenable.status = 'rejected';
      rejectedThenable.reason = reason;
    });
    return promise;
  }
}

function ignoreReject() {// We rely on rejected promises to be handled by another listener.
} // Start preloading the modules since we might need them soon.
// This function doesn't suspend.


function preloadModule(metadata) {
  var chunks = metadata[CHUNKS];
  var promises = [];
  var i = 0;

  while (i < chunks.length) {
    var chunkId = chunks[i++];
    var chunkFilename = chunks[i++];
    var entry = chunkCache.get(chunkId);

    if (entry === undefined) {
      var thenable = loadChunk(chunkId, chunkFilename);
      promises.push(thenable); // $FlowFixMe[method-unbinding]

      var resolve = chunkCache.set.bind(chunkCache, chunkId, null);
      thenable.then(resolve, ignoreReject);
      chunkCache.set(chunkId, thenable);
    } else if (entry !== null) {
      promises.push(entry);
    }
  }

  if (isAsyncImport(metadata)) {
    if (promises.length === 0) {
      return requireAsyncModule(metadata[ID]);
    } else {
      return Promise.all(promises).then(function () {
        return requireAsyncModule(metadata[ID]);
      });
    }
  } else if (promises.length > 0) {
    return Promise.all(promises);
  } else {
    return null;
  }
} // Actually require the module or suspend if it's not yet ready.
// Increase priority if necessary.

function requireModule(metadata) {
  var moduleExports = __webpack_require__(metadata[ID]);

  if (isAsyncImport(metadata)) {
    if (typeof moduleExports.then !== 'function') ; else if (moduleExports.status === 'fulfilled') {
      // This Promise should've been instrumented by preloadModule.
      moduleExports = moduleExports.value;
    } else {
      throw moduleExports.reason;
    }
  }

  if (metadata[NAME] === '*') {
    // This is a placeholder value that represents that the caller imported this
    // as a CommonJS module as is.
    return moduleExports;
  }

  if (metadata[NAME] === '') {
    // This is a placeholder value that represents that the caller accessed the
    // default property of this if it was an ESM interop module.
    return moduleExports.__esModule ? moduleExports.default : moduleExports;
  }

  return moduleExports[metadata[NAME]];
}

var chunkMap = new Map();
/**
 * We patch the chunk filename function in webpack to insert our own resolution
 * of chunks that come from Flight and may not be known to the webpack runtime
 */

var webpackGetChunkFilename = __webpack_require__.u;

__webpack_require__.u = function (chunkId) {
  var flightChunk = chunkMap.get(chunkId);

  if (flightChunk !== undefined) {
    return flightChunk;
  }

  return webpackGetChunkFilename(chunkId);
};

function loadChunk(chunkId, filename) {
  chunkMap.set(chunkId, filename);
  return __webpack_chunk_load__(chunkId);
}

var ReactDOMSharedInternals = ReactDOM.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

// This client file is in the shared folder because it applies to both SSR and browser contexts.
var ReactDOMCurrentDispatcher = ReactDOMSharedInternals.ReactDOMCurrentDispatcher;
function dispatchHint(code, model) {
  var dispatcher = ReactDOMCurrentDispatcher.current;

  switch (code) {
    case 'D':
      {
        var refined = refineModel(code, model);
        var href = refined;
        dispatcher.prefetchDNS(href);
        return;
      }

    case 'C':
      {
        var _refined = refineModel(code, model);

        if (typeof _refined === 'string') {
          var _href = _refined;
          dispatcher.preconnect(_href);
        } else {
          var _href2 = _refined[0];
          var crossOrigin = _refined[1];
          dispatcher.preconnect(_href2, crossOrigin);
        }

        return;
      }

    case 'L':
      {
        var _refined2 = refineModel(code, model);

        var _href3 = _refined2[0];
        var as = _refined2[1];

        if (_refined2.length === 3) {
          var options = _refined2[2];
          dispatcher.preload(_href3, as, options);
        } else {
          dispatcher.preload(_href3, as);
        }

        return;
      }

    case 'm':
      {
        var _refined3 = refineModel(code, model);

        if (typeof _refined3 === 'string') {
          var _href4 = _refined3;
          dispatcher.preloadModule(_href4);
        } else {
          var _href5 = _refined3[0];
          var _options = _refined3[1];
          dispatcher.preloadModule(_href5, _options);
        }

        return;
      }

    case 'S':
      {
        var _refined4 = refineModel(code, model);

        if (typeof _refined4 === 'string') {
          var _href6 = _refined4;
          dispatcher.preinitStyle(_href6);
        } else {
          var _href7 = _refined4[0];
          var precedence = _refined4[1] === 0 ? undefined : _refined4[1];

          var _options2 = _refined4.length === 3 ? _refined4[2] : undefined;

          dispatcher.preinitStyle(_href7, precedence, _options2);
        }

        return;
      }

    case 'X':
      {
        var _refined5 = refineModel(code, model);

        if (typeof _refined5 === 'string') {
          var _href8 = _refined5;
          dispatcher.preinitScript(_href8);
        } else {
          var _href9 = _refined5[0];
          var _options3 = _refined5[1];
          dispatcher.preinitScript(_href9, _options3);
        }

        return;
      }

    case 'M':
      {
        var _refined6 = refineModel(code, model);

        if (typeof _refined6 === 'string') {
          var _href10 = _refined6;
          dispatcher.preinitModuleScript(_href10);
        } else {
          var _href11 = _refined6[0];
          var _options4 = _refined6[1];
          dispatcher.preinitModuleScript(_href11, _options4);
        }

        return;
      }
  }
} // Flow is having trouble refining the HintModels so we help it a bit.
// This should be compiled out in the production build.

function refineModel(code, model) {
  return model;
}

var ReactSharedInternals = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

function error(format) {
  {
    {
      for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        args[_key2 - 1] = arguments[_key2];
      }

      printWarning('error', format, args);
    }
  }
}

function printWarning(level, format, args) {
  // When changing this logic, you might want to also
  // update consoleWithStackDev.www.js as well.
  {
    var ReactDebugCurrentFrame = ReactSharedInternals.ReactDebugCurrentFrame;
    var stack = ReactDebugCurrentFrame.getStackAddendum();

    if (stack !== '') {
      format += '%s';
      args = args.concat([stack]);
    } // eslint-disable-next-line react-internal/safe-string-coercion


    var argsWithFormat = args.map(function (item) {
      return String(item);
    }); // Careful: RN currently depends on this prefix

    argsWithFormat.unshift('Warning: ' + format); // We intentionally don't use spread (or .apply) directly because it
    // breaks IE9: https://github.com/facebook/react/issues/13610
    // eslint-disable-next-line react-internal/no-production-logging

    Function.prototype.apply.call(console[level], console, argsWithFormat);
  }
}

// ATTENTION
// When adding new symbols to this file,
// Please consider also adding to 'react-devtools-shared/src/backend/ReactSymbols'
// The Symbol used to tag the ReactElement-like types.
var REACT_ELEMENT_TYPE = Symbol.for('react.element');
var REACT_PROVIDER_TYPE = Symbol.for('react.provider'); // TODO: Delete with enableRenderableContext
var REACT_FORWARD_REF_TYPE = Symbol.for('react.forward_ref');
var REACT_SUSPENSE_TYPE = Symbol.for('react.suspense');
var REACT_SUSPENSE_LIST_TYPE = Symbol.for('react.suspense_list');
var REACT_MEMO_TYPE = Symbol.for('react.memo');
var REACT_LAZY_TYPE = Symbol.for('react.lazy');
var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
var FAUX_ITERATOR_SYMBOL = '@@iterator';
function getIteratorFn(maybeIterable) {
  if (maybeIterable === null || typeof maybeIterable !== 'object') {
    return null;
  }

  var maybeIterator = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL];

  if (typeof maybeIterator === 'function') {
    return maybeIterator;
  }

  return null;
}

var isArrayImpl = Array.isArray; // eslint-disable-next-line no-redeclare

function isArray(a) {
  return isArrayImpl(a);
}

var getPrototypeOf = Object.getPrototypeOf;

// in case they error.

var jsxPropsParents = new WeakMap();
var jsxChildrenParents = new WeakMap();

function isObjectPrototype(object) {
  if (!object) {
    return false;
  }

  var ObjectPrototype = Object.prototype;

  if (object === ObjectPrototype) {
    return true;
  } // It might be an object from a different Realm which is
  // still just a plain simple object.


  if (getPrototypeOf(object)) {
    return false;
  }

  var names = Object.getOwnPropertyNames(object);

  for (var i = 0; i < names.length; i++) {
    if (!(names[i] in ObjectPrototype)) {
      return false;
    }
  }

  return true;
}

function isSimpleObject(object) {
  if (!isObjectPrototype(getPrototypeOf(object))) {
    return false;
  }

  var names = Object.getOwnPropertyNames(object);

  for (var i = 0; i < names.length; i++) {
    var descriptor = Object.getOwnPropertyDescriptor(object, names[i]);

    if (!descriptor) {
      return false;
    }

    if (!descriptor.enumerable) {
      if ((names[i] === 'key' || names[i] === 'ref') && typeof descriptor.get === 'function') {
        // React adds key and ref getters to props objects to issue warnings.
        // Those getters will not be transferred to the client, but that's ok,
        // so we'll special case them.
        continue;
      }

      return false;
    }
  }

  return true;
}
function objectName(object) {
  // $FlowFixMe[method-unbinding]
  var name = Object.prototype.toString.call(object);
  return name.replace(/^\[object (.*)\]$/, function (m, p0) {
    return p0;
  });
}

function describeKeyForErrorMessage(key) {
  var encodedKey = JSON.stringify(key);
  return '"' + key + '"' === encodedKey ? key : encodedKey;
}

function describeValueForErrorMessage(value) {
  switch (typeof value) {
    case 'string':
      {
        return JSON.stringify(value.length <= 10 ? value : value.slice(0, 10) + '...');
      }

    case 'object':
      {
        if (isArray(value)) {
          return '[...]';
        }

        if (value !== null && value.$$typeof === CLIENT_REFERENCE_TAG) {
          return describeClientReference();
        }

        var name = objectName(value);

        if (name === 'Object') {
          return '{...}';
        }

        return name;
      }

    case 'function':
      {
        if (value.$$typeof === CLIENT_REFERENCE_TAG) {
          return describeClientReference();
        }

        var _name = value.displayName || value.name;

        return _name ? 'function ' + _name : 'function';
      }

    default:
      // eslint-disable-next-line react-internal/safe-string-coercion
      return String(value);
  }
}

function describeElementType(type) {
  if (typeof type === 'string') {
    return type;
  }

  switch (type) {
    case REACT_SUSPENSE_TYPE:
      return 'Suspense';

    case REACT_SUSPENSE_LIST_TYPE:
      return 'SuspenseList';
  }

  if (typeof type === 'object') {
    switch (type.$$typeof) {
      case REACT_FORWARD_REF_TYPE:
        return describeElementType(type.render);

      case REACT_MEMO_TYPE:
        return describeElementType(type.type);

      case REACT_LAZY_TYPE:
        {
          var lazyComponent = type;
          var payload = lazyComponent._payload;
          var init = lazyComponent._init;

          try {
            // Lazy may contain any component type so we recursively resolve it.
            return describeElementType(init(payload));
          } catch (x) {}
        }
    }
  }

  return '';
}

var CLIENT_REFERENCE_TAG = Symbol.for('react.client.reference');

function describeClientReference(ref) {
  return 'client';
}

function describeObjectForErrorMessage(objectOrArray, expandedName) {
  var objKind = objectName(objectOrArray);

  if (objKind !== 'Object' && objKind !== 'Array') {
    return objKind;
  }

  var str = '';
  var start = -1;
  var length = 0;

  if (isArray(objectOrArray)) {
    if (jsxChildrenParents.has(objectOrArray)) {
      // Print JSX Children
      var type = jsxChildrenParents.get(objectOrArray);
      str = '<' + describeElementType(type) + '>';
      var array = objectOrArray;

      for (var i = 0; i < array.length; i++) {
        var value = array[i];
        var substr = void 0;

        if (typeof value === 'string') {
          substr = value;
        } else if (typeof value === 'object' && value !== null) {
          substr = '{' + describeObjectForErrorMessage(value) + '}';
        } else {
          substr = '{' + describeValueForErrorMessage(value) + '}';
        }

        if ('' + i === expandedName) {
          start = str.length;
          length = substr.length;
          str += substr;
        } else if (substr.length < 15 && str.length + substr.length < 40) {
          str += substr;
        } else {
          str += '{...}';
        }
      }

      str += '</' + describeElementType(type) + '>';
    } else {
      // Print Array
      str = '[';
      var _array = objectOrArray;

      for (var _i = 0; _i < _array.length; _i++) {
        if (_i > 0) {
          str += ', ';
        }

        var _value = _array[_i];

        var _substr = void 0;

        if (typeof _value === 'object' && _value !== null) {
          _substr = describeObjectForErrorMessage(_value);
        } else {
          _substr = describeValueForErrorMessage(_value);
        }

        if ('' + _i === expandedName) {
          start = str.length;
          length = _substr.length;
          str += _substr;
        } else if (_substr.length < 10 && str.length + _substr.length < 40) {
          str += _substr;
        } else {
          str += '...';
        }
      }

      str += ']';
    }
  } else {
    if (objectOrArray.$$typeof === REACT_ELEMENT_TYPE) {
      str = '<' + describeElementType(objectOrArray.type) + '/>';
    } else if (objectOrArray.$$typeof === CLIENT_REFERENCE_TAG) {
      return describeClientReference();
    } else if (jsxPropsParents.has(objectOrArray)) {
      // Print JSX
      var _type = jsxPropsParents.get(objectOrArray);

      str = '<' + (describeElementType(_type) || '...');
      var object = objectOrArray;
      var names = Object.keys(object);

      for (var _i2 = 0; _i2 < names.length; _i2++) {
        str += ' ';
        var name = names[_i2];
        str += describeKeyForErrorMessage(name) + '=';
        var _value2 = object[name];

        var _substr2 = void 0;

        if (name === expandedName && typeof _value2 === 'object' && _value2 !== null) {
          _substr2 = describeObjectForErrorMessage(_value2);
        } else {
          _substr2 = describeValueForErrorMessage(_value2);
        }

        if (typeof _value2 !== 'string') {
          _substr2 = '{' + _substr2 + '}';
        }

        if (name === expandedName) {
          start = str.length;
          length = _substr2.length;
          str += _substr2;
        } else if (_substr2.length < 10 && str.length + _substr2.length < 40) {
          str += _substr2;
        } else {
          str += '...';
        }
      }

      str += '>';
    } else {
      // Print Object
      str = '{';
      var _object = objectOrArray;

      var _names = Object.keys(_object);

      for (var _i3 = 0; _i3 < _names.length; _i3++) {
        if (_i3 > 0) {
          str += ', ';
        }

        var _name2 = _names[_i3];
        str += describeKeyForErrorMessage(_name2) + ': ';
        var _value3 = _object[_name2];

        var _substr3 = void 0;

        if (typeof _value3 === 'object' && _value3 !== null) {
          _substr3 = describeObjectForErrorMessage(_value3);
        } else {
          _substr3 = describeValueForErrorMessage(_value3);
        }

        if (_name2 === expandedName) {
          start = str.length;
          length = _substr3.length;
          str += _substr3;
        } else if (_substr3.length < 10 && str.length + _substr3.length < 40) {
          str += _substr3;
        } else {
          str += '...';
        }
      }

      str += '}';
    }
  }

  if (expandedName === undefined) {
    return str;
  }

  if (start > -1 && length > 0) {
    var highlight = ' '.repeat(start) + '^'.repeat(length);
    return '\n  ' + str + '\n  ' + highlight;
  }

  return '\n  ' + str;
}

function createTemporaryReferenceSet() {
  return [];
}
function writeTemporaryReference(set, object) {
  // We always create a new entry regardless if we've already written the same
  // object. This ensures that we always generate a deterministic encoding of
  // each slot in the reply for cacheability.
  var newId = set.length;
  set.push(object);
  return newId;
}
function readTemporaryReference(set, id) {
  if (id < 0 || id >= set.length) {
    throw new Error("The RSC response contained a reference that doesn't exist in the temporary reference set. " + 'Always pass the matching set that was used to create the reply when parsing its response.');
  }

  return set[id];
}

var ObjectPrototype = Object.prototype;
var knownServerReferences = new WeakMap(); // Serializable values
// Thenable<ReactServerValue>

function serializeByValueID(id) {
  return '$' + id.toString(16);
}

function serializePromiseID(id) {
  return '$@' + id.toString(16);
}

function serializeServerReferenceID(id) {
  return '$F' + id.toString(16);
}

function serializeTemporaryReferenceID(id) {
  return '$T' + id.toString(16);
}

function serializeFormDataReference(id) {
  // Why K? F is "Function". D is "Date". What else?
  return '$K' + id.toString(16);
}

function serializeNumber(number) {
  if (Number.isFinite(number)) {
    if (number === 0 && 1 / number === -Infinity) {
      return '$-0';
    } else {
      return number;
    }
  } else {
    if (number === Infinity) {
      return '$Infinity';
    } else if (number === -Infinity) {
      return '$-Infinity';
    } else {
      return '$NaN';
    }
  }
}

function serializeUndefined() {
  return '$undefined';
}

function serializeDateFromDateJSON(dateJSON) {
  // JSON.stringify automatically calls Date.prototype.toJSON which calls toISOString.
  // We need only tack on a $D prefix.
  return '$D' + dateJSON;
}

function serializeBigInt(n) {
  return '$n' + n.toString(10);
}

function serializeMapID(id) {
  return '$Q' + id.toString(16);
}

function serializeSetID(id) {
  return '$W' + id.toString(16);
}

function escapeStringValue(value) {
  if (value[0] === '$') {
    // We need to escape $ prefixed strings since we use those to encode
    // references to IDs and as special symbol values.
    return '$' + value;
  } else {
    return value;
  }
}

function processReply(root, formFieldPrefix, temporaryReferences, resolve, reject) {
  var nextPartId = 1;
  var pendingParts = 0;
  var formData = null;

  function resolveToJSON(key, value) {
    var parent = this; // Make sure that `parent[key]` wasn't JSONified before `value` was passed to us

    {
      // $FlowFixMe[incompatible-use]
      var originalValue = parent[key];

      if (typeof originalValue === 'object' && originalValue !== value && !(originalValue instanceof Date)) {
        if (objectName(originalValue) !== 'Object') {
          error('Only plain objects can be passed to Server Functions from the Client. ' + '%s objects are not supported.%s', objectName(originalValue), describeObjectForErrorMessage(parent, key));
        } else {
          error('Only plain objects can be passed to Server Functions from the Client. ' + 'Objects with toJSON methods are not supported. Convert it manually ' + 'to a simple value before passing it to props.%s', describeObjectForErrorMessage(parent, key));
        }
      }
    }

    if (value === null) {
      return null;
    }

    if (typeof value === 'object') {
      switch (value.$$typeof) {
        case REACT_ELEMENT_TYPE:
          {
            if (temporaryReferences === undefined) {
              throw new Error('React Element cannot be passed to Server Functions from the Client without a ' + 'temporary reference set. Pass a TemporaryReferenceSet to the options.' + (describeObjectForErrorMessage(parent, key) ));
            }

            return serializeTemporaryReferenceID(writeTemporaryReference(temporaryReferences, value));
          }

        case REACT_LAZY_TYPE:
          {
            // Resolve lazy as if it wasn't here. In the future this will be encoded as a Promise.
            var lazy = value;
            var payload = lazy._payload;
            var init = lazy._init;

            if (formData === null) {
              // Upgrade to use FormData to allow us to stream this value.
              formData = new FormData();
            }

            pendingParts++;

            try {
              var resolvedModel = init(payload); // We always outline this as a separate part even though we could inline it
              // because it ensures a more deterministic encoding.

              var lazyId = nextPartId++;
              var partJSON = JSON.stringify(resolvedModel, resolveToJSON); // $FlowFixMe[incompatible-type] We know it's not null because we assigned it above.

              var data = formData; // eslint-disable-next-line react-internal/safe-string-coercion

              data.append(formFieldPrefix + lazyId, partJSON);
              return serializeByValueID(lazyId);
            } catch (x) {
              if (typeof x === 'object' && x !== null && typeof x.then === 'function') {
                // Suspended
                pendingParts++;

                var _lazyId = nextPartId++;

                var thenable = x;

                var retry = function () {
                  // While the first promise resolved, its value isn't necessarily what we'll
                  // resolve into because we might suspend again.
                  try {
                    var _partJSON = JSON.stringify(value, resolveToJSON); // $FlowFixMe[incompatible-type] We know it's not null because we assigned it above.


                    var _data = formData; // eslint-disable-next-line react-internal/safe-string-coercion

                    _data.append(formFieldPrefix + _lazyId, _partJSON);

                    pendingParts--;

                    if (pendingParts === 0) {
                      resolve(_data);
                    }
                  } catch (reason) {
                    reject(reason);
                  }
                };

                thenable.then(retry, retry);
                return serializeByValueID(_lazyId);
              } else {
                // In the future we could consider serializing this as an error
                // that throws on the server instead.
                reject(x);
                return null;
              }
            } finally {
              pendingParts--;
            }
          }
      } // $FlowFixMe[method-unbinding]


      if (typeof value.then === 'function') {
        // We assume that any object with a .then property is a "Thenable" type,
        // or a Promise type. Either of which can be represented by a Promise.
        if (formData === null) {
          // Upgrade to use FormData to allow us to stream this value.
          formData = new FormData();
        }

        pendingParts++;
        var promiseId = nextPartId++;
        var _thenable = value;

        _thenable.then(function (partValue) {
          try {
            var _partJSON2 = JSON.stringify(partValue, resolveToJSON); // $FlowFixMe[incompatible-type] We know it's not null because we assigned it above.


            var _data2 = formData; // eslint-disable-next-line react-internal/safe-string-coercion

            _data2.append(formFieldPrefix + promiseId, _partJSON2);

            pendingParts--;

            if (pendingParts === 0) {
              resolve(_data2);
            }
          } catch (reason) {
            reject(reason);
          }
        }, function (reason) {
          // In the future we could consider serializing this as an error
          // that throws on the server instead.
          reject(reason);
        });

        return serializePromiseID(promiseId);
      }

      if (isArray(value)) {
        // $FlowFixMe[incompatible-return]
        return value;
      } // TODO: Should we the Object.prototype.toString.call() to test for cross-realm objects?


      if (value instanceof FormData) {
        if (formData === null) {
          // Upgrade to use FormData to allow us to use rich objects as its values.
          formData = new FormData();
        }

        var _data3 = formData;
        var refId = nextPartId++; // Copy all the form fields with a prefix for this reference.
        // These must come first in the form order because we assume that all the
        // fields are available before this is referenced.

        var prefix = formFieldPrefix + refId + '_'; // $FlowFixMe[prop-missing]: FormData has forEach.

        value.forEach(function (originalValue, originalKey) {
          _data3.append(prefix + originalKey, originalValue);
        });
        return serializeFormDataReference(refId);
      }

      if (value instanceof Map) {
        var _partJSON3 = JSON.stringify(Array.from(value), resolveToJSON);

        if (formData === null) {
          formData = new FormData();
        }

        var mapId = nextPartId++;
        formData.append(formFieldPrefix + mapId, _partJSON3);
        return serializeMapID(mapId);
      }

      if (value instanceof Set) {
        var _partJSON4 = JSON.stringify(Array.from(value), resolveToJSON);

        if (formData === null) {
          formData = new FormData();
        }

        var setId = nextPartId++;
        formData.append(formFieldPrefix + setId, _partJSON4);
        return serializeSetID(setId);
      }

      var iteratorFn = getIteratorFn(value);

      if (iteratorFn) {
        return Array.from(value);
      } // Verify that this is a simple plain object.


      var proto = getPrototypeOf(value);

      if (proto !== ObjectPrototype && (proto === null || getPrototypeOf(proto) !== null)) {
        if (temporaryReferences === undefined) {
          throw new Error('Only plain objects, and a few built-ins, can be passed to Server Actions. ' + 'Classes or null prototypes are not supported.');
        } // We can serialize class instances as temporary references.


        return serializeTemporaryReferenceID(writeTemporaryReference(temporaryReferences, value));
      }

      {
        if (value.$$typeof === (REACT_PROVIDER_TYPE)) {
          error('React Context Providers cannot be passed to Server Functions from the Client.%s', describeObjectForErrorMessage(parent, key));
        } else if (objectName(value) !== 'Object') {
          error('Only plain objects can be passed to Server Functions from the Client. ' + '%s objects are not supported.%s', objectName(value), describeObjectForErrorMessage(parent, key));
        } else if (!isSimpleObject(value)) {
          error('Only plain objects can be passed to Server Functions from the Client. ' + 'Classes or other objects with methods are not supported.%s', describeObjectForErrorMessage(parent, key));
        } else if (Object.getOwnPropertySymbols) {
          var symbols = Object.getOwnPropertySymbols(value);

          if (symbols.length > 0) {
            error('Only plain objects can be passed to Server Functions from the Client. ' + 'Objects with symbol properties like %s are not supported.%s', symbols[0].description, describeObjectForErrorMessage(parent, key));
          }
        }
      } // $FlowFixMe[incompatible-return]


      return value;
    }

    if (typeof value === 'string') {
      // TODO: Maybe too clever. If we support URL there's no similar trick.
      if (value[value.length - 1] === 'Z') {
        // Possibly a Date, whose toJSON automatically calls toISOString
        // $FlowFixMe[incompatible-use]
        var _originalValue = parent[key];

        if (_originalValue instanceof Date) {
          return serializeDateFromDateJSON(value);
        }
      }

      return escapeStringValue(value);
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return serializeNumber(value);
    }

    if (typeof value === 'undefined') {
      return serializeUndefined();
    }

    if (typeof value === 'function') {
      var metaData = knownServerReferences.get(value);

      if (metaData !== undefined) {
        var metaDataJSON = JSON.stringify(metaData, resolveToJSON);

        if (formData === null) {
          // Upgrade to use FormData to allow us to stream this value.
          formData = new FormData();
        } // The reference to this function came from the same client so we can pass it back.


        var _refId = nextPartId++; // eslint-disable-next-line react-internal/safe-string-coercion


        formData.set(formFieldPrefix + _refId, metaDataJSON);
        return serializeServerReferenceID(_refId);
      }

      if (temporaryReferences === undefined) {
        throw new Error('Client Functions cannot be passed directly to Server Functions. ' + 'Only Functions passed from the Server can be passed back again.');
      }

      return serializeTemporaryReferenceID(writeTemporaryReference(temporaryReferences, value));
    }

    if (typeof value === 'symbol') {
      if (temporaryReferences === undefined) {
        throw new Error('Symbols cannot be passed to a Server Function without a ' + 'temporary reference set. Pass a TemporaryReferenceSet to the options.' + (describeObjectForErrorMessage(parent, key) ));
      }

      return serializeTemporaryReferenceID(writeTemporaryReference(temporaryReferences, value));
    }

    if (typeof value === 'bigint') {
      return serializeBigInt(value);
    }

    throw new Error("Type " + typeof value + " is not supported as an argument to a Server Function.");
  } // $FlowFixMe[incompatible-type] it's not going to be undefined because we'll encode it.


  var json = JSON.stringify(root, resolveToJSON);

  if (formData === null) {
    // If it's a simple data structure, we just use plain JSON.
    resolve(json);
  } else {
    // Otherwise, we use FormData to let us stream in the result.
    formData.set(formFieldPrefix + '0', json);

    if (pendingParts === 0) {
      // $FlowFixMe[incompatible-call] this has already been refined.
      resolve(formData);
    }
  }
}

function registerServerReference(proxy, reference, encodeFormAction) {

  knownServerReferences.set(proxy, reference);
} // $FlowFixMe[method-unbinding]

function createServerReference(id, callServer, encodeFormAction) {
  var proxy = function () {
    // $FlowFixMe[method-unbinding]
    var args = Array.prototype.slice.call(arguments);
    return callServer(id, args);
  };

  registerServerReference(proxy, {
    id: id,
    bound: null
  });
  return proxy;
}

var ROW_ID = 0;
var ROW_TAG = 1;
var ROW_LENGTH = 2;
var ROW_CHUNK_BY_NEWLINE = 3;
var ROW_CHUNK_BY_LENGTH = 4;
var PENDING = 'pending';
var BLOCKED = 'blocked';
var CYCLIC = 'cyclic';
var RESOLVED_MODEL = 'resolved_model';
var RESOLVED_MODULE = 'resolved_module';
var INITIALIZED = 'fulfilled';
var ERRORED = 'rejected'; // $FlowFixMe[missing-this-annot]

function Chunk(status, value, reason, response) {
  this.status = status;
  this.value = value;
  this.reason = reason;
  this._response = response;

  {
    this._debugInfo = null;
  }
} // We subclass Promise.prototype so that we get other methods like .catch


Chunk.prototype = Object.create(Promise.prototype); // TODO: This doesn't return a new Promise chain unlike the real .then

Chunk.prototype.then = function (resolve, reject) {
  var chunk = this; // If we have resolved content, we try to initialize it first which
  // might put us back into one of the other states.

  switch (chunk.status) {
    case RESOLVED_MODEL:
      initializeModelChunk(chunk);
      break;

    case RESOLVED_MODULE:
      initializeModuleChunk(chunk);
      break;
  } // The status might have changed after initialization.


  switch (chunk.status) {
    case INITIALIZED:
      resolve(chunk.value);
      break;

    case PENDING:
    case BLOCKED:
    case CYCLIC:
      if (resolve) {
        if (chunk.value === null) {
          chunk.value = [];
        }

        chunk.value.push(resolve);
      }

      if (reject) {
        if (chunk.reason === null) {
          chunk.reason = [];
        }

        chunk.reason.push(reject);
      }

      break;

    default:
      reject(chunk.reason);
      break;
  }
};

function readChunk(chunk) {
  // If we have resolved content, we try to initialize it first which
  // might put us back into one of the other states.
  switch (chunk.status) {
    case RESOLVED_MODEL:
      initializeModelChunk(chunk);
      break;

    case RESOLVED_MODULE:
      initializeModuleChunk(chunk);
      break;
  } // The status might have changed after initialization.


  switch (chunk.status) {
    case INITIALIZED:
      return chunk.value;

    case PENDING:
    case BLOCKED:
    case CYCLIC:
      // eslint-disable-next-line no-throw-literal
      throw chunk;

    default:
      throw chunk.reason;
  }
}

function getRoot(response) {
  var chunk = getChunk(response, 0);
  return chunk;
}

function createPendingChunk(response) {
  // $FlowFixMe[invalid-constructor] Flow doesn't support functions as constructors
  return new Chunk(PENDING, null, null, response);
}

function createBlockedChunk(response) {
  // $FlowFixMe[invalid-constructor] Flow doesn't support functions as constructors
  return new Chunk(BLOCKED, null, null, response);
}

function createErrorChunk(response, error) {
  // $FlowFixMe[invalid-constructor] Flow doesn't support functions as constructors
  return new Chunk(ERRORED, null, error, response);
}

function wakeChunk(listeners, value) {
  for (var i = 0; i < listeners.length; i++) {
    var listener = listeners[i];
    listener(value);
  }
}

function wakeChunkIfInitialized(chunk, resolveListeners, rejectListeners) {
  switch (chunk.status) {
    case INITIALIZED:
      wakeChunk(resolveListeners, chunk.value);
      break;

    case PENDING:
    case BLOCKED:
    case CYCLIC:
      chunk.value = resolveListeners;
      chunk.reason = rejectListeners;
      break;

    case ERRORED:
      if (rejectListeners) {
        wakeChunk(rejectListeners, chunk.reason);
      }

      break;
  }
}

function triggerErrorOnChunk(chunk, error) {
  if (chunk.status !== PENDING && chunk.status !== BLOCKED) {
    // We already resolved. We didn't expect to see this.
    return;
  }

  var listeners = chunk.reason;
  var erroredChunk = chunk;
  erroredChunk.status = ERRORED;
  erroredChunk.reason = error;

  if (listeners !== null) {
    wakeChunk(listeners, error);
  }
}

function createResolvedModelChunk(response, value) {
  // $FlowFixMe[invalid-constructor] Flow doesn't support functions as constructors
  return new Chunk(RESOLVED_MODEL, value, null, response);
}

function createResolvedModuleChunk(response, value) {
  // $FlowFixMe[invalid-constructor] Flow doesn't support functions as constructors
  return new Chunk(RESOLVED_MODULE, value, null, response);
}

function createInitializedTextChunk(response, value) {
  // $FlowFixMe[invalid-constructor] Flow doesn't support functions as constructors
  return new Chunk(INITIALIZED, value, null, response);
}

function resolveModelChunk(chunk, value) {
  if (chunk.status !== PENDING) {
    // We already resolved. We didn't expect to see this.
    return;
  }

  var resolveListeners = chunk.value;
  var rejectListeners = chunk.reason;
  var resolvedChunk = chunk;
  resolvedChunk.status = RESOLVED_MODEL;
  resolvedChunk.value = value;

  if (resolveListeners !== null) {
    // This is unfortunate that we're reading this eagerly if
    // we already have listeners attached since they might no
    // longer be rendered or might not be the highest pri.
    initializeModelChunk(resolvedChunk); // The status might have changed after initialization.

    wakeChunkIfInitialized(chunk, resolveListeners, rejectListeners);
  }
}

function resolveModuleChunk(chunk, value) {
  if (chunk.status !== PENDING && chunk.status !== BLOCKED) {
    // We already resolved. We didn't expect to see this.
    return;
  }

  var resolveListeners = chunk.value;
  var rejectListeners = chunk.reason;
  var resolvedChunk = chunk;
  resolvedChunk.status = RESOLVED_MODULE;
  resolvedChunk.value = value;

  if (resolveListeners !== null) {
    initializeModuleChunk(resolvedChunk);
    wakeChunkIfInitialized(chunk, resolveListeners, rejectListeners);
  }
}

var initializingChunk = null;
var initializingChunkBlockedModel = null;

function initializeModelChunk(chunk) {
  var prevChunk = initializingChunk;
  var prevBlocked = initializingChunkBlockedModel;
  initializingChunk = chunk;
  initializingChunkBlockedModel = null;
  var resolvedModel = chunk.value; // We go to the CYCLIC state until we've fully resolved this.
  // We do this before parsing in case we try to initialize the same chunk
  // while parsing the model. Such as in a cyclic reference.

  var cyclicChunk = chunk;
  cyclicChunk.status = CYCLIC;
  cyclicChunk.value = null;
  cyclicChunk.reason = null;

  try {
    var value = parseModel(chunk._response, resolvedModel);

    if (initializingChunkBlockedModel !== null && initializingChunkBlockedModel.deps > 0) {
      initializingChunkBlockedModel.value = value; // We discovered new dependencies on modules that are not yet resolved.
      // We have to go the BLOCKED state until they're resolved.

      var blockedChunk = chunk;
      blockedChunk.status = BLOCKED;
      blockedChunk.value = null;
      blockedChunk.reason = null;
    } else {
      var resolveListeners = cyclicChunk.value;
      var initializedChunk = chunk;
      initializedChunk.status = INITIALIZED;
      initializedChunk.value = value;

      if (resolveListeners !== null) {
        wakeChunk(resolveListeners, value);
      }
    }
  } catch (error) {
    var erroredChunk = chunk;
    erroredChunk.status = ERRORED;
    erroredChunk.reason = error;
  } finally {
    initializingChunk = prevChunk;
    initializingChunkBlockedModel = prevBlocked;
  }
}

function initializeModuleChunk(chunk) {
  try {
    var value = requireModule(chunk.value);
    var initializedChunk = chunk;
    initializedChunk.status = INITIALIZED;
    initializedChunk.value = value;
  } catch (error) {
    var erroredChunk = chunk;
    erroredChunk.status = ERRORED;
    erroredChunk.reason = error;
  }
} // Report that any missing chunks in the model is now going to throw this
// error upon read. Also notify any pending promises.


function reportGlobalError(response, error) {
  response._chunks.forEach(function (chunk) {
    // If this chunk was already resolved or errored, it won't
    // trigger an error but if it wasn't then we need to
    // because we won't be getting any new data to resolve it.
    if (chunk.status === PENDING) {
      triggerErrorOnChunk(chunk, error);
    }
  });
}

function createElement(type, key, props) {
  var element;

  {
    element = {
      // This tag allows us to uniquely identify this as a React Element
      $$typeof: REACT_ELEMENT_TYPE,
      type: type,
      key: key,
      ref: null,
      props: props,
      // Record the component responsible for creating this element.
      _owner: null
    };
  }

  {
    // We don't really need to add any of these but keeping them for good measure.
    // Unfortunately, _store is enumerable in jest matchers so for equality to
    // work, I need to keep it or make _store non-enumerable in the other file.
    element._store = {};
    Object.defineProperty(element._store, 'validated', {
      configurable: false,
      enumerable: false,
      writable: true,
      value: true // This element has already been validated on the server.

    }); // debugInfo contains Server Component debug information.

    Object.defineProperty(element, '_debugInfo', {
      configurable: false,
      enumerable: false,
      writable: true,
      value: null
    });
  }

  return element;
}

function createLazyChunkWrapper(chunk) {
  var lazyType = {
    $$typeof: REACT_LAZY_TYPE,
    _payload: chunk,
    _init: readChunk
  };

  {
    // Ensure we have a live array to track future debug info.
    var chunkDebugInfo = chunk._debugInfo || (chunk._debugInfo = []);
    lazyType._debugInfo = chunkDebugInfo;
  }

  return lazyType;
}

function getChunk(response, id) {
  var chunks = response._chunks;
  var chunk = chunks.get(id);

  if (!chunk) {
    chunk = createPendingChunk(response);
    chunks.set(id, chunk);
  }

  return chunk;
}

function createModelResolver(chunk, parentObject, key, cyclic) {
  var blocked;

  if (initializingChunkBlockedModel) {
    blocked = initializingChunkBlockedModel;

    if (!cyclic) {
      blocked.deps++;
    }
  } else {
    blocked = initializingChunkBlockedModel = {
      deps: cyclic ? 0 : 1,
      value: null
    };
  }

  return function (value) {
    parentObject[key] = value;
    blocked.deps--;

    if (blocked.deps === 0) {
      if (chunk.status !== BLOCKED) {
        return;
      }

      var resolveListeners = chunk.value;
      var initializedChunk = chunk;
      initializedChunk.status = INITIALIZED;
      initializedChunk.value = blocked.value;

      if (resolveListeners !== null) {
        wakeChunk(resolveListeners, blocked.value);
      }
    }
  };
}

function createModelReject(chunk) {
  return function (error) {
    return triggerErrorOnChunk(chunk, error);
  };
}

function createServerReferenceProxy(response, metaData) {
  var callServer = response._callServer;

  var proxy = function () {
    // $FlowFixMe[method-unbinding]
    var args = Array.prototype.slice.call(arguments);
    var p = metaData.bound;

    if (!p) {
      return callServer(metaData.id, args);
    }

    if (p.status === INITIALIZED) {
      var bound = p.value;
      return callServer(metaData.id, bound.concat(args));
    } // Since this is a fake Promise whose .then doesn't chain, we have to wrap it.
    // TODO: Remove the wrapper once that's fixed.


    return Promise.resolve(p).then(function (bound) {
      return callServer(metaData.id, bound.concat(args));
    });
  };

  registerServerReference(proxy, metaData);
  return proxy;
}

function getOutlinedModel(response, id) {
  var chunk = getChunk(response, id);

  switch (chunk.status) {
    case RESOLVED_MODEL:
      initializeModelChunk(chunk);
      break;
  } // The status might have changed after initialization.


  switch (chunk.status) {
    case INITIALIZED:
      {
        return chunk.value;
      }
    // We always encode it first in the stream so it won't be pending.

    default:
      throw chunk.reason;
  }
}

function parseModelString(response, parentObject, key, value) {
  if (value[0] === '$') {
    if (value === '$') {
      // A very common symbol.
      return REACT_ELEMENT_TYPE;
    }

    switch (value[1]) {
      case '$':
        {
          // This was an escaped string value.
          return value.slice(1);
        }

      case 'L':
        {
          // Lazy node
          var id = parseInt(value.slice(2), 16);
          var chunk = getChunk(response, id); // We create a React.lazy wrapper around any lazy values.
          // When passed into React, we'll know how to suspend on this.

          return createLazyChunkWrapper(chunk);
        }

      case '@':
        {
          // Promise
          if (value.length === 2) {
            // Infinite promise that never resolves.
            return new Promise(function () {});
          }

          var _id = parseInt(value.slice(2), 16);

          var _chunk = getChunk(response, _id);

          return _chunk;
        }

      case 'S':
        {
          // Symbol
          return Symbol.for(value.slice(2));
        }

      case 'F':
        {
          // Server Reference
          var _id2 = parseInt(value.slice(2), 16);

          var metadata = getOutlinedModel(response, _id2);
          return createServerReferenceProxy(response, metadata);
        }

      case 'T':
        {
          // Temporary Reference
          var _id3 = parseInt(value.slice(2), 16);

          var temporaryReferences = response._tempRefs;

          if (temporaryReferences == null) {
            throw new Error('Missing a temporary reference set but the RSC response returned a temporary reference. ' + 'Pass a temporaryReference option with the set that was used with the reply.');
          }

          return readTemporaryReference(temporaryReferences, _id3);
        }

      case 'Q':
        {
          // Map
          var _id4 = parseInt(value.slice(2), 16);

          var data = getOutlinedModel(response, _id4);
          return new Map(data);
        }

      case 'W':
        {
          // Set
          var _id5 = parseInt(value.slice(2), 16);

          var _data = getOutlinedModel(response, _id5);

          return new Set(_data);
        }

      case 'I':
        {
          // $Infinity
          return Infinity;
        }

      case '-':
        {
          // $-0 or $-Infinity
          if (value === '$-0') {
            return -0;
          } else {
            return -Infinity;
          }
        }

      case 'N':
        {
          // $NaN
          return NaN;
        }

      case 'u':
        {
          // matches "$undefined"
          // Special encoding for `undefined` which can't be serialized as JSON otherwise.
          return undefined;
        }

      case 'D':
        {
          // Date
          return new Date(Date.parse(value.slice(2)));
        }

      case 'n':
        {
          // BigInt
          return BigInt(value.slice(2));
        }

      case 'E':
        {
          {
            // In DEV mode we allow indirect eval to produce functions for logging.
            // This should not compile to eval() because then it has local scope access.
            try {
              // eslint-disable-next-line no-eval
              return (0, eval)(value.slice(2));
            } catch (x) {
              // We currently use this to express functions so we fail parsing it,
              // let's just return a blank function as a place holder.
              return function () {};
            }
          } // Fallthrough

        }

      default:
        {
          // We assume that anything else is a reference ID.
          var _id6 = parseInt(value.slice(1), 16);

          var _chunk2 = getChunk(response, _id6);

          switch (_chunk2.status) {
            case RESOLVED_MODEL:
              initializeModelChunk(_chunk2);
              break;

            case RESOLVED_MODULE:
              initializeModuleChunk(_chunk2);
              break;
          } // The status might have changed after initialization.


          switch (_chunk2.status) {
            case INITIALIZED:
              var chunkValue = _chunk2.value;

              if (_chunk2._debugInfo) {
                // If we have a direct reference to an object that was rendered by a synchronous
                // server component, it might have some debug info about how it was rendered.
                // We forward this to the underlying object. This might be a React Element or
                // an Array fragment.
                // If this was a string / number return value we lose the debug info. We choose
                // that tradeoff to allow sync server components to return plain values and not
                // use them as React Nodes necessarily. We could otherwise wrap them in a Lazy.
                if (typeof chunkValue === 'object' && chunkValue !== null && (Array.isArray(chunkValue) || chunkValue.$$typeof === REACT_ELEMENT_TYPE) && !chunkValue._debugInfo) {
                  // We should maybe use a unique symbol for arrays but this is a React owned array.
                  // $FlowFixMe[prop-missing]: This should be added to elements.
                  Object.defineProperty(chunkValue, '_debugInfo', {
                    configurable: false,
                    enumerable: false,
                    writable: true,
                    value: _chunk2._debugInfo
                  });
                }
              }

              return chunkValue;

            case PENDING:
            case BLOCKED:
            case CYCLIC:
              var parentChunk = initializingChunk;

              _chunk2.then(createModelResolver(parentChunk, parentObject, key, _chunk2.status === CYCLIC), createModelReject(parentChunk));

              return null;

            default:
              throw _chunk2.reason;
          }
        }
    }
  }

  return value;
}

function parseModelTuple(response, value) {
  var tuple = value;

  if (tuple[0] === REACT_ELEMENT_TYPE) {
    // TODO: Consider having React just directly accept these arrays as elements.
    // Or even change the ReactElement type to be an array.
    return createElement(tuple[1], tuple[2], tuple[3]);
  }

  return value;
}

function missingCall() {
  throw new Error('Trying to call a function from "use server" but the callServer option ' + 'was not implemented in your router runtime.');
}

function createResponse(bundlerConfig, moduleLoading, callServer, encodeFormAction, nonce, temporaryReferences) {
  var chunks = new Map();
  var response = {
    _bundlerConfig: bundlerConfig,
    _moduleLoading: moduleLoading,
    _callServer: callServer !== undefined ? callServer : missingCall,
    _encodeFormAction: encodeFormAction,
    _nonce: nonce,
    _chunks: chunks,
    _stringDecoder: createStringDecoder(),
    _fromJSON: null,
    _rowState: 0,
    _rowID: 0,
    _rowTag: 0,
    _rowLength: 0,
    _buffer: [],
    _tempRefs: temporaryReferences
  }; // Don't inline this call because it causes closure to outline the call above.

  response._fromJSON = createFromJSONCallback(response);
  return response;
}

function resolveModel(response, id, model) {
  var chunks = response._chunks;
  var chunk = chunks.get(id);

  if (!chunk) {
    chunks.set(id, createResolvedModelChunk(response, model));
  } else {
    resolveModelChunk(chunk, model);
  }
}

function resolveText(response, id, text) {
  var chunks = response._chunks; // We assume that we always reference large strings after they've been
  // emitted.

  chunks.set(id, createInitializedTextChunk(response, text));
}

function resolveModule(response, id, model) {
  var chunks = response._chunks;
  var chunk = chunks.get(id);
  var clientReferenceMetadata = parseModel(response, model);
  var clientReference = resolveClientReference(response._bundlerConfig, clientReferenceMetadata);
  // For now we preload all modules as early as possible since it's likely
  // that we'll need them.

  var promise = preloadModule(clientReference);

  if (promise) {
    var blockedChunk;

    if (!chunk) {
      // Technically, we should just treat promise as the chunk in this
      // case. Because it'll just behave as any other promise.
      blockedChunk = createBlockedChunk(response);
      chunks.set(id, blockedChunk);
    } else {
      // This can't actually happen because we don't have any forward
      // references to modules.
      blockedChunk = chunk;
      blockedChunk.status = BLOCKED;
    }

    promise.then(function () {
      return resolveModuleChunk(blockedChunk, clientReference);
    }, function (error) {
      return triggerErrorOnChunk(blockedChunk, error);
    });
  } else {
    if (!chunk) {
      chunks.set(id, createResolvedModuleChunk(response, clientReference));
    } else {
      // This can't actually happen because we don't have any forward
      // references to modules.
      resolveModuleChunk(chunk, clientReference);
    }
  }
}

function resolveErrorDev(response, id, digest, message, stack) {


  var error = new Error(message || 'An error occurred in the Server Components render but no message was provided');
  error.stack = stack;
  error.digest = digest;
  var errorWithDigest = error;
  var chunks = response._chunks;
  var chunk = chunks.get(id);

  if (!chunk) {
    chunks.set(id, createErrorChunk(response, errorWithDigest));
  } else {
    triggerErrorOnChunk(chunk, errorWithDigest);
  }
}

function resolveHint(response, code, model) {
  var hintModel = parseModel(response, model);
  dispatchHint(code, hintModel);
}

function resolveDebugInfo(response, id, debugInfo) {

  var chunk = getChunk(response, id);
  var chunkDebugInfo = chunk._debugInfo || (chunk._debugInfo = []);
  chunkDebugInfo.push(debugInfo);
}

function resolveConsoleEntry(response, value) {

  var payload = parseModel(response, value);
  var methodName = payload[0]; // TODO: Restore the fake stack before logging.
  // const stackTrace = payload[1];

  var env = payload[2];
  var args = payload.slice(3);
  printToConsole(methodName, args, env);
}

function processFullRow(response, id, tag, buffer, chunk) {

  var stringDecoder = response._stringDecoder;
  var row = '';

  for (var i = 0; i < buffer.length; i++) {
    row += readPartialStringChunk(stringDecoder, buffer[i]);
  }

  row += readFinalStringChunk(stringDecoder, chunk);

  switch (tag) {
    case 73
    /* "I" */
    :
      {
        resolveModule(response, id, row);
        return;
      }

    case 72
    /* "H" */
    :
      {
        var code = row[0];
        resolveHint(response, code, row.slice(1));
        return;
      }

    case 69
    /* "E" */
    :
      {
        var errorInfo = JSON.parse(row);

        {
          resolveErrorDev(response, id, errorInfo.digest, errorInfo.message, errorInfo.stack);
        }

        return;
      }

    case 84
    /* "T" */
    :
      {
        resolveText(response, id, row);
        return;
      }

    case 68
    /* "D" */
    :
      {
        {
          var debugInfo = JSON.parse(row);
          resolveDebugInfo(response, id, debugInfo);
          return;
        } // Fallthrough to share the error with Console entries.

      }

    case 87
    /* "W" */
    :
      {
        {
          resolveConsoleEntry(response, row);
          return;
        }
      }

    case 80
    /* "P" */
    :
    // Fallthrough

    default:
      /* """ "{" "[" "t" "f" "n" "0" - "9" */
      {
        // We assume anything else is JSON.
        resolveModel(response, id, row);
        return;
      }
  }
}

function processBinaryChunk(response, chunk) {
  var i = 0;
  var rowState = response._rowState;
  var rowID = response._rowID;
  var rowTag = response._rowTag;
  var rowLength = response._rowLength;
  var buffer = response._buffer;
  var chunkLength = chunk.length;

  while (i < chunkLength) {
    var lastIdx = -1;

    switch (rowState) {
      case ROW_ID:
        {
          var byte = chunk[i++];

          if (byte === 58
          /* ":" */
          ) {
              // Finished the rowID, next we'll parse the tag.
              rowState = ROW_TAG;
            } else {
            rowID = rowID << 4 | (byte > 96 ? byte - 87 : byte - 48);
          }

          continue;
        }

      case ROW_TAG:
        {
          var resolvedRowTag = chunk[i];

          if (resolvedRowTag === 84
          /* "T" */
          || enableBinaryFlight 
          /* "V" */
          ) {
              rowTag = resolvedRowTag;
              rowState = ROW_LENGTH;
              i++;
            } else if (resolvedRowTag > 64 && resolvedRowTag < 91
          /* "A"-"Z" */
          ) {
              rowTag = resolvedRowTag;
              rowState = ROW_CHUNK_BY_NEWLINE;
              i++;
            } else {
            rowTag = 0;
            rowState = ROW_CHUNK_BY_NEWLINE; // This was an unknown tag so it was probably part of the data.
          }

          continue;
        }

      case ROW_LENGTH:
        {
          var _byte = chunk[i++];

          if (_byte === 44
          /* "," */
          ) {
              // Finished the rowLength, next we'll buffer up to that length.
              rowState = ROW_CHUNK_BY_LENGTH;
            } else {
            rowLength = rowLength << 4 | (_byte > 96 ? _byte - 87 : _byte - 48);
          }

          continue;
        }

      case ROW_CHUNK_BY_NEWLINE:
        {
          // We're looking for a newline
          lastIdx = chunk.indexOf(10
          /* "\n" */
          , i);
          break;
        }

      case ROW_CHUNK_BY_LENGTH:
        {
          // We're looking for the remaining byte length
          lastIdx = i + rowLength;

          if (lastIdx > chunk.length) {
            lastIdx = -1;
          }

          break;
        }
    }

    var offset = chunk.byteOffset + i;

    if (lastIdx > -1) {
      // We found the last chunk of the row
      var length = lastIdx - i;
      var lastChunk = new Uint8Array(chunk.buffer, offset, length);
      processFullRow(response, rowID, rowTag, buffer, lastChunk); // Reset state machine for a new row

      i = lastIdx;

      if (rowState === ROW_CHUNK_BY_NEWLINE) {
        // If we're trailing by a newline we need to skip it.
        i++;
      }

      rowState = ROW_ID;
      rowTag = 0;
      rowID = 0;
      rowLength = 0;
      buffer.length = 0;
    } else {
      // The rest of this row is in a future chunk. We stash the rest of the
      // current chunk until we can process the full row.
      var _length = chunk.byteLength - i;

      var remainingSlice = new Uint8Array(chunk.buffer, offset, _length);
      buffer.push(remainingSlice); // Update how many bytes we're still waiting for. If we're looking for
      // a newline, this doesn't hurt since we'll just ignore it.

      rowLength -= remainingSlice.byteLength;
      break;
    }
  }

  response._rowState = rowState;
  response._rowID = rowID;
  response._rowTag = rowTag;
  response._rowLength = rowLength;
}

function parseModel(response, json) {
  return JSON.parse(json, response._fromJSON);
}

function createFromJSONCallback(response) {
  // $FlowFixMe[missing-this-annot]
  return function (key, value) {
    if (typeof value === 'string') {
      // We can't use .bind here because we need the "this" value.
      return parseModelString(response, this, key, value);
    }

    if (typeof value === 'object' && value !== null) {
      return parseModelTuple(response, value);
    }

    return value;
  };
}

function close(response) {
  // In case there are any remaining unresolved chunks, they won't
  // be resolved now. So we need to issue an error to those.
  // Ideally we should be able to early bail out if we kept a
  // ref count of pending chunks.
  reportGlobalError(response, new Error('Connection closed.'));
}

function createResponseFromOptions(options) {
  return createResponse(null, null, options && options.callServer ? options.callServer : undefined, undefined, // encodeFormAction
  undefined, // nonce
  options && options.temporaryReferences ? options.temporaryReferences : undefined);
}

function startReadingFromStream(response, stream) {
  var reader = stream.getReader();

  function progress(_ref) {
    var done = _ref.done,
        value = _ref.value;

    if (done) {
      close(response);
      return;
    }

    var buffer = value;
    processBinaryChunk(response, buffer);
    return reader.read().then(progress).catch(error);
  }

  function error(e) {
    reportGlobalError(response, e);
  }

  reader.read().then(progress).catch(error);
}

function createFromReadableStream(stream, options) {
  var response = createResponseFromOptions(options);
  startReadingFromStream(response, stream);
  return getRoot(response);
}

function createFromFetch(promiseForResponse, options) {
  var response = createResponseFromOptions(options);
  promiseForResponse.then(function (r) {
    startReadingFromStream(response, r.body);
  }, function (e) {
    reportGlobalError(response, e);
  });
  return getRoot(response);
}

function encodeReply(value, options)
/* We don't use URLSearchParams yet but maybe */
{
  return new Promise(function (resolve, reject) {
    processReply(value, '', options && options.temporaryReferences ? options.temporaryReferences : undefined, resolve, reject);
  });
}

exports.createFromFetch = createFromFetch;
exports.createFromReadableStream = createFromReadableStream;
exports.createServerReference = createServerReference;
exports.createTemporaryReferenceSet = createTemporaryReferenceSet;
exports.encodeReply = encodeReply;
  })();
}
