/*! uitest.js - v0.9.1-SNAPSHOT - 2013-02-17
* https://github.com/tigbro/uitest.js
* Copyright (c) 2013 Tobias Bosch; Licensed MIT */

/**
 * Simple implementation of AMD require/define assuming all
 * modules are named and loaded explicitly, and require is called
 * after all needed modules have been loaded.
 */
(function (window) {
    var ns = window.uitest = window.uitest || {};

    var define = function (name, deps, value) {
        var dotJs = name.indexOf('.js');
        if (dotJs !== -1) {
            name = name.substring(0, dotJs);
        }
        if (arguments.length === 2) {
            // No deps...
            value = deps;
            deps = [];
        }
        var def = {
            name:name,
            deps:deps,
            value:value
        };
        for (var i = 0; i < define.moduleDefs.length; i++) {
            var mod = define.moduleDefs[i];
            if (mod.name === name) {
                define.moduleDefs[i] = def;
                return;
            }
        }
        define.moduleDefs.push(def);
    };
    define.moduleDefs = [];

    function findModuleDefinition(name) {
        for (var i = 0; i < define.moduleDefs.length; i++) {
            var mod = define.moduleDefs[i];
            if (mod.name === name) {
                return mod;
            }
        }
        throw new Error("Could not find the module " + name);
    }

    define.findModuleDefinition = findModuleDefinition;

    function factory(name, instanceCache) {
        if (!instanceCache) {
            instanceCache = {};
        }
        if (instanceCache[name] === undefined) {
            var resolvedValue;
            var mod = findModuleDefinition(name);
            var resolvedDeps = listFactory(mod.deps, instanceCache);
            resolvedValue = mod.value;
            if (typeof mod.value === 'function') {
                resolvedValue = mod.value.apply(window, resolvedDeps);
            }

            instanceCache[name] = resolvedValue;
            if (resolvedValue && resolvedValue.global) {
                var global = factory('global', instanceCache);
                mergeObjects(resolvedValue.global, global);

            }

        }
        return instanceCache[name];
    }

    function mergeObjects(source, target) {
        var prop, oldValue, newValue;
        for (prop in source) {
            newValue = source[prop];
            oldValue = target[prop];
            if (typeof oldValue === 'object') {
                mergeObjects(newValue, oldValue);
            } else {
                target[prop] = newValue;
            }
        }
    }

    function listFactory(deps, instanceCache) {
        if (!instanceCache) {
            instanceCache = {};
        }
        var resolvedDeps = [];
        for (var i = 0; i < deps.length; i++) {
            resolvedDeps.push(factory(deps[i], instanceCache));
        }
        return resolvedDeps;
    }

    var require = function (cache, deps, callback) {
        var filteredDeps = [],
            i, def;
        if (arguments.length===1) {
            deps = cache;
            cache = {};
            callback = null;
        } else if (arguments.length===2) {
            if (typeof cache === 'function' || cache.slice) {
                callback = deps;
                deps = cache;
            }
        }
        if (deps.apply) {
            // if deps is a function, treat it as a filter function.
            for (i = 0; i < define.moduleDefs.length; i++) {
                def = define.moduleDefs[i];
                if (deps(def.name)) {
                    filteredDeps.push(def.name);
                }
            }
            deps = filteredDeps;
        }
        var resolvedDeps = listFactory(deps, cache);

        if (callback) {
            callback.apply(this, resolvedDeps);
        }

        return cache;
    };

    ns.require = require;
    ns.define = define;

})(window);

uitest.define('annotate', ['utils'], function(utils) {

    // Copied from https://github.com/angular
    var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
    var FN_ARG_SPLIT = /,/;
    var FN_ARG = /^\s*(_?)(\S+?)\1\s*$/;
    var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;

    function annotate(fn) {
        var $inject, fnText, argDecl, last, args, i;

        if(typeof fn === 'function') {
            if(!($inject = fn.$inject)) {
                $inject = [];
                fnText = fn.toString().replace(STRIP_COMMENTS, '');
                argDecl = fnText.match(FN_ARGS);
                args = argDecl[1].split(FN_ARG_SPLIT);
                for(i = 0; i < args.length; i++) {
                    args[i].replace(FN_ARG, addFnArgTo$Inject);
                }
                fn.$inject = $inject;
            }
        } else if(utils.isArray(fn)) {
            last = fn.length - 1;
            assertArgFn(fn[last], 'fn');
            $inject = fn.slice(0, last);
        } else {
            assertArgFn(fn, 'fn', true);
        }
        return $inject;

        function addFnArgTo$Inject(all, underscore, name) {
            $inject.push(name);
        }
    }

    /**
     * throw error of the argument is falsy.
     */
    function assertArg(arg, name, reason) {
        if(!arg) {
            throw new Error("Argument '" + (name || '?') + "' is " + (reason || "required"));
        }
        return arg;
    }

    function assertArgFn(arg, name, acceptArrayAnnotation) {
        if(acceptArrayAnnotation && utils.isArray(arg)) {
            arg = arg[arg.length - 1];
        }
        assertArg(utils.isFunction(arg), name, 'not a function, got ' + (arg && typeof arg === 'object' ? arg.constructor.name || 'Object' : typeof arg));
        return arg;
    }

    return annotate;
});
uitest.define('config', [], function() {
	function create() {
		return new Create();
	}

	function Create() {
		this._data = {};
	}

	Create.prototype = {
		parent: simpleProp("_parent"),
		sealed: simpleProp("_sealed"),
		url: dataProp("url"),
		trace: dataProp("trace"),
		feature: dataAdder("features", featureValidator),
		append: dataAdder("appends"),
		prepend: dataAdder("prepends"),
		intercept: dataAdder("intercepts"),
		buildConfig: buildConfig
	};

	function getterSetter(getter, setter) {
		return result;

		function result() {
			if(arguments.length === 0) {
				return getter.call(this);
			} else {
				setter.apply(this, arguments);
				return this;
			}
		}
	}

	function simpleProp(name) {
		return getterSetter(function() {
			return this[name];
		}, function(newValue) {
			this[name] = newValue;
		});
	}

	function dataProp(name, checkFn) {
		return getterSetter(function() {
			return this._data[name];
		}, function(newValue) {
			checkNotSealed(this);
			if (checkFn) {
				checkFn(newValue);
			}
			this._data[name] = newValue;
		});
	}

	function dataAdder(name, checkFn) {
		return getterSetter(function() {
			return this._data[name];
		}, function() {
			var values = Array.prototype.slice.call(arguments),
				arr = this._data[name];
			checkNotSealed(this);
			if (checkFn) {
				checkFn(values);
			}
			if (!arr) {
				arr = this._data[name] = [];
			}
			arr.push.apply(arr, values);
		});
	}

	function featureValidator(features) {
		var i;
		for (i=0; i<features.length; i++) {
			if (!uitest.define.findModuleDefinition("run/feature/"+features[i])) {
				throw new Error("Unknown feature: "+features[i]);
			}
		}
	}

	function checkNotSealed(self) {
		if (self.sealed()) {
			throw new Error("This configuration cannot be modified.");
		}
	}

	function buildConfig(target) {
		target = target || {
			features: [],
			appends: [],
			prepends: [],
			intercepts: []
		};
		if (this.parent()) {
			this.parent().buildConfig(target);
		}
		var prop, value, oldValue,
            data = this._data;
		for(prop in data) {
			value = data[prop];
			if(isArray(value)) {
				value = (target[prop] || []).concat(value);
			}
			target[prop] = value;
		}
		return target;
	}

	function isArray(obj) {
		return obj && obj.push;
	}

	return {
		create: create
	};
});
uitest.define('documentUtils', ['global'], function(global) {

    var // Groups:
    // 1. opening script tag
    // 2. content of src attribute
    // 3. text content of script element.
    SCRIPT_RE = /(<script(?:[^>]*(src=\s*"([^"]+)"))?[^>]*>)([\s\S]*?)<\/script>/g;

    function serializeDocType(doc) {
        var node = doc.doctype;
        if(!node) {
            return '';
        }
        return "<!DOCTYPE " + node.name + (node.publicId ? ' PUBLIC "' + node.publicId + '"' : '') + (!node.publicId && node.systemId ? ' SYSTEM' : '') + (node.systemId ? ' "' + node.systemId + '"' : '') + '>';
    }

    function serializeHtmlTag(doc) {
        var el = doc.documentElement,
            i, attr;
        var parts = ['<html'];
        for(i = 0; i < el.attributes.length; i++) {
            attr = el.attributes[i];
            if(attr.value !== undefined) {
                parts.push(attr.name + '="' + attr.value + '"');
            } else {
                parts.push(attr.name);
            }
        }
        return parts.join(" ") + ">";
    }

    function serializeHtmlBeforeLastScript(doc) {
        var innerHtml = doc.documentElement.innerHTML;
        var lastScript = innerHtml.lastIndexOf('<script');
        return serializeDocType(doc) + serializeHtmlTag(doc) + innerHtml.substring(0, lastScript);
    }

    function contentScriptHtml(content) {
        return '<script type="text/javascript">' + content + '</script>';
    }

    function urlScriptHtml(url) {
        return '<script type="text/javascript" src="' + url + '"></script>';
    }

    function loadFile(win, url, async, resultCallback) {
        var xhr = new win.XMLHttpRequest();
        xhr.onreadystatechange = function() {
            if(xhr.readyState === 4) {
                if(xhr.status === 200 || xhr.status === 0) {
                    resultCallback(null, xhr.responseText);
                } else {
                    resultCallback(new Error("Error loading url " + url + ":" + xhr.statusText));
                }
            }
        };
        xhr.open("GET", url, async);
        xhr.send();
    }

    function loadScript(win, url, async, resultCallback) {
        loadFile(win, url, async, function(error, data) {
            if (!error) {
                resultCallback(error, data+"//@ sourceURL=" + url);
            } else {
                resultCallback(error, data);
            }
        });
    }

    function evalScript(win, scriptContent) { /*jshint evil:true*/
        win["eval"].call(win, scriptContent);
    }

    function loadAndEvalScriptSync(win, url, preProcessCallback) {
        loadScript(win, url, false, function(error, data) {
            if(error) {
                throw error;
            }
            if(preProcessCallback) {
                data = preProcessCallback(data);
            }
            evalScript(win, data);
        });
    }

    function replaceScripts(html, callback) {
        return html.replace(SCRIPT_RE, function(match, scriptOpenTag, srcAttribute, scriptUrl, textContent) {
            var result = callback({
                match: match,
                scriptOpenTag: scriptOpenTag,
                srcAttribute: srcAttribute||'',
                scriptUrl: scriptUrl||'',
                textContent: textContent
            });
            if(result === undefined) {
                return match;
            }
            return result;
        });
    }

    return {
        serializeDocType: serializeDocType,
        serializeHtmlTag: serializeHtmlTag,
        serializeHtmlBeforeLastScript: serializeHtmlBeforeLastScript,
        contentScriptHtml: contentScriptHtml,
        urlScriptHtml: urlScriptHtml,
        loadAndEvalScriptSync: loadAndEvalScriptSync,
        loadFile: loadFile,
        replaceScripts: replaceScripts
    };
});
uitest.define('facade', ['config', 'global'], function(config, global) {
    var CONFIG_FUNCTIONS = ['parent', 'url', 'loadMode', 'feature', 'append', 'prepend', 'intercept', 'trace'],
        _currentIdAccessor = function() { return ''; }, current;

    function create() {
        var res = {
            ready: ready,
            realoded: reloaded,
            reloaded: reloaded,
            inject: inject
        },
            i, fnName, configInstance;
        configInstance = res._config = config.create();
        for(i = 0; i < CONFIG_FUNCTIONS.length; i++) {
            fnName = CONFIG_FUNCTIONS[i];
            res[fnName] = delegate(configInstance[fnName], configAccessor);
        }
        return res;

        function configAccessor(uit) {
            return uit && uit._config;
        }
    }

    function createDispatcherFacade(dispatcher) {
        // create a dummy uitest instance,
        // so we know which functions we can delegate...
        var res = {};
        var dummy = create(),
            prop;
        for (prop in dummy) {
            if (typeof dummy[prop] === 'function') {
                res[prop] = delegate(dummy[prop], dispatcherWrapper);
            }
        }

        return res;

        function dispatcherWrapper(caller) {
            if (caller===res) {
                return dispatcher();
            }
        }
    }

    function createCurrentFacade() {
        var uitCache = {};
        return createDispatcherFacade(currentDispatcher);

        function currentDispatcher() {
            var currentId = currentIdAccessor()(),
                uit = uitCache[currentId],
                parentUit = findParentUit(currentId);
            if (!uit) {
                uit = create();
                if (parentUit) {
                    uit.parent(parentUit);
                }
                uitCache[currentId] = uit;
            }
            return uit;
        }

        function findParentUit(childId) {
            var id, parentId;
            for (id in uitCache) {
                if (id!==childId && childId.indexOf(id)===0) {
                    if (!parentId || id.length>parentId) {
                        parentId = id;
                    }
                }
            }
            return uitCache[parentId];
        }
    }

    function currentIdAccessor(value) {
        if (typeof value === 'function') {
            _currentIdAccessor = value;
        }
        return _currentIdAccessor;
    }

    function delegate(fn, targetAccessor) {
        return function() {
            var i,
                args = Array.prototype.slice.call(arguments),
                target = targetAccessor(this),
                otherTarget;
            for (i=0; i<args.length; i++) {
                otherTarget = targetAccessor(args[i]);
                if (otherTarget) {
                    args[i] = otherTarget;
                }
            }
            var res = fn.apply(target, args);
            if(res === target) {
                res = this;
            }
            return res;
        };
    }

    function ready(callback) {
        var self = this;
        if(!this._runModules) {
            run(this);
        }
        this._runModules["run/ready"].ready(callback);
    }

    function run(self) {
        var config, featureName, featureModules, i;

        self._config.sealed(true);
        config = self._config.buildConfig();
        config.now = global.Date.now();
        self._runModules = {"run/config": config};
        uitest.require(self._runModules, function(moduleName) {
            if (moduleName.indexOf('run/')!==0) {
                return false;
            }
            if (moduleName.indexOf('run/feature/')===0) {
                return false;
            }
            return true;
        });
        featureModules = [];
        for (i=0; i<config.features.length; i++) {
            featureName = config.features[i];
            featureModules.push(featureModule(featureName));
        }
        uitest.require(self._runModules, featureModules);
    }

    function featureModule(featureName) {
        return "run/feature/"+featureName;
    }

    function reloaded(callback) {
        checkRunning(this);
        this._runModules["run/loadSensor"].reloaded(callback);
    }

    function inject(callback) {
        checkRunning(this);
        var injector = this._runModules["run/injector"];
        return injector.inject(callback, null, []);
    }

    function checkRunning(self) {
        if(!self._runModules) {
            throw new Error("The test page has not yet loaded. Please call ready first");
        }
    }

    current = createCurrentFacade();

    return {
        create: create,
        current: current,
        currentIdAccessor: currentIdAccessor,
        global: {
            uitest: {
                create: create,
                current: current
            }
        }
    };
});
uitest.define('global', [], function() {
	return window;
});

uitest.define('run/defaultScriptAdder', ['run/config', 'run/instrumentor', 'documentUtils', 'run/injector', 'run/testframe', 'annotate', 'run/logger', 'urlParser', 'utils'], function(runConfig, instrumentor, docUtils, injector, testframe, annotate, logger, urlParser, utils) {
    // group 1: name of function
    var NAMED_FUNCTION_RE = /function\s*(\w+)[^\{]*\{/g;

    instrumentor.addPreprocessor(10, preprocess);

    function preprocess(html) {
        if (runConfig.prepends.length) {
            html = handlePrepends(html, runConfig.prepends);
        }
        if (runConfig.intercepts.length) {
            html = handleIntercepts(html, runConfig.intercepts);
        }
        if (runConfig.appends.length) {
            html = handleAppends(html, runConfig.appends);
        }
        return html;
    }

    function handlePrepends(html, prepends) {
        var htmlArr = ['<head>'],
            i;
        logger.log("adding prepends after <head>");
        createScriptTagForPrependsOrAppends(htmlArr, prepends);
        return html.replace(/<head>/, htmlArr.join(''));
    }

    function handleAppends(html, appends) {
        var htmlArr = [],
            i;
        logger.log("adding appends at </body>");
        createScriptTagForPrependsOrAppends(htmlArr, appends);
        htmlArr.push('</body>');
        return html.replace(/<\/body>/, htmlArr.join(''));
    }

    function createScriptTagForPrependsOrAppends(html, prependsOrAppends) {
        var i, prependOrAppend, lastCallbackArr;
        for(i = 0; i < prependsOrAppends.length; i++) {
            prependOrAppend = prependsOrAppends[i];
            if(utils.isString(prependOrAppend)) {
                html.push(docUtils.urlScriptHtml(prependOrAppend));
                lastCallbackArr = null;
            } else {
                if(!lastCallbackArr) {
                    lastCallbackArr = [];
                    html.push(docUtils.contentScriptHtml(instrumentor.createRemoteCallExpression(injectedCallbacks(lastCallbackArr), 'window')));
                }
                lastCallbackArr.push(prependOrAppend);
            }
        }
    }

    function injectedCallbacks(callbacks) {
        return function(win) {
            var i;
            for(i = 0; i < callbacks.length; i++) {
                injector.inject(callbacks[i], win, [win]);
            }
        };
    }

    function handleIntercepts(html, intercepts) {
        return docUtils.replaceScripts(html, function(parsedScript) {
            if(!parsedScript.scriptUrl) {
                return undefined;
            }
            
            var scriptExecutor = createInterceptingScriptExecutor(parsedScript.scriptUrl, intercepts);
            if(scriptExecutor) {
                return docUtils.contentScriptHtml(instrumentor.createRemoteCallExpression(function(win) {
                    scriptExecutor();
                }, "window"));
            } else {
                return undefined;
            }
        });
    }

    function createInterceptingScriptExecutor(scriptUrl, intercepts) {
        var matchingIntercepts = findMatchingIntercepts(scriptUrl, intercepts);
        if (matchingIntercepts.empty) {
            return undefined;
        }
        logger.log("intercepting "+scriptUrl);
        return function() {
            execInterceptScript(matchingIntercepts, scriptUrl);
        };
    }

    function findMatchingIntercepts(url, intercepts) {
        var i,
            matchingIntercepts = {
                empty: true
            },
            urlFilename = urlParser.filenameFor(url);

        if(intercepts) {
            for(i = 0; i < intercepts.length; i++) {
                if(intercepts[i].script === urlFilename) {
                    matchingIntercepts[intercepts[i].fn] = intercepts[i];
                    matchingIntercepts.empty = false;
                }
            }
        }
        return matchingIntercepts;
    }

    function execInterceptScript(matchingInterceptsByName, scriptUrl) {
        // Need to do the xhr in sync here so the script execution order in the document
        // stays the same!
        docUtils.loadAndEvalScriptSync(testframe, scriptUrl, preProcessCallback);

        function preProcessCallback(data) {
            return data.replace(NAMED_FUNCTION_RE, function(all, fnName) {
                if(matchingInterceptsByName[fnName]) {
                    return all + 'if (!' + fnName + '.delegate)return ' + instrumentor.createRemoteCallExpression(fnCallback, "window", fnName, "this", "arguments");
                }
                return all;

                function fnCallback(win, fn, self, args) {
                    var originalArgNames = annotate(fn),
                        originalArgsByName = {},
                        $delegate = {
                            fn: fn,
                            name: fnName,
                            self: self,
                            args: args
                        },
                        i;
                    for(i = 0; i < args.length; i++) {
                        originalArgsByName[originalArgNames[i]] = args[i];
                    }
                    fn.delegate = true;
                    try {
                        return injector.inject(matchingInterceptsByName[fnName].callback, self, [originalArgsByName,
                        {
                            $delegate: $delegate
                        },
                        win]);
                    } finally {
                        fn.delegate = false;
                    }
                }
            });
        }
    }

    return {
        preprocess: preprocess,
        handlePrepends: handlePrepends,
        handleAppends: handleAppends,
        handleIntercepts: handleIntercepts,
        createInterceptingScriptExecutor: createInterceptingScriptExecutor
    };
});
uitest.define("run/feature/angularIntegration", ["run/injector", "run/config"], function(injector, runConfig) {
    runConfig.appends.push(install);

    function install(angular, window) {
        if(!angular) {
            throw new Error("Angular is not loaded!");
        }

        var ng = angular.module("ng");

        installE2eMock(angular, ng);
        adaptPrototypes(ng, window);
        addAngularInjector(ng);
    }

    function addAngularInjector(ng) {
        ng.run(function($injector) {
            injector.addDefaultResolver(angularResolver);

            function angularResolver(argName) {
                try {
                    return $injector.get(argName);
                } catch(e) {
                    return undefined;
                }
            }
        });
    }

    function installE2eMock(angular, ng) {
        ng.config(function($provide) {
            if(angular.mock) {
                // disable auto-flushing by removing the $browser argument,
                // so we can control flushing using $httpBackend.flush()!
                angular.mock.e2e.$httpBackendDecorator.splice(1, 1);
                // enable the mock backend
                $provide.decorator('$httpBackend', angular.mock.e2e.$httpBackendDecorator);
            }
        });
    }

    // -----
    // Angular uses "instanceof Array" only at 3 places,
    // which can generically be decorated.
    function adaptPrototypes(ng, win) {
        function convertArr(inArr) {
            // On Android 2.3, just calling new win.Array() is not enough
            // to yield outArr instanceof win.Array.
            // Also, every call to "push" will also change the prototype somehow...
            /*jshint evil:true*/
            var outArr = win["eval"]("new Array("+inArr.length+")"),
                i;
            for (i=0; i<inArr.length; i++) {
                outArr[i] = inArr[i];
            }
            return outArr;
        }

        function adaptPrototypesInFilter($provide, filterName) {
            $provide.decorator(filterName, function($delegate) {
                return function() {
                    var args = Array.prototype.slice.call(arguments);
                    args[0] = convertArr(args[0]);
                    return $delegate.apply(this, args);
                };
            });
        }

        ng.config(function($provide) {
            adaptPrototypesInFilter($provide, "filterFilter");
            adaptPrototypesInFilter($provide, "limitToFilter");
            adaptPrototypesInFilter($provide, "orderByFilter");
        });
    }
});
uitest.define('run/feature/intervalSensor', ['run/config', 'run/ready'], function(runConfig, readyModule) {
    var intervals = {},
        intervalStartCounter = 0;

    runConfig.prepends.unshift(install);
    readyModule.addSensor('interval', state);
    return state;

    function install(window) {
        var oldInterval = window.setInterval;
        window.setInterval = function (fn, time) {
            var handle = oldInterval(fn, time);
            intervals[handle] = true;
            intervalStartCounter++;
            return handle;
        };

        var oldClearInterval = window.clearInterval;
        window.clearInterval = function (code) {
            oldClearInterval(code);
            delete intervals[code];
        };
    }

    function isReady() {
        var x;
        for (x in intervals) {
            return false;
        }
        return true;
    }

    function state() {
        return {
            count: intervalStartCounter,
            ready: isReady()
        };
    }
});

uitest.define('run/feature/jqmAnimationSensor', ['run/config', 'run/ready'], function(runConfig, readyModule) {

    var ready = true,
        startCounter = 0;

    runConfig.appends.unshift(install);

    readyModule.addSensor('jqmAnimationSensor', state);

    return state;

    function install(window) {
        var jQuery = window.jQuery;
        if(!(jQuery && jQuery.fn && jQuery.fn.animationComplete)) {
            return;
        }

        var oldFn = jQuery.fn.animationComplete;
        jQuery.fn.animationComplete = function(callback) {
            startCounter++;
            ready = false;
            return oldFn.call(this, function() {
                ready = true;
                return callback.apply(this, arguments);
            });
        };
    }

    function state() {
        return {
            count: startCounter,
            ready: ready
        };
    }
});
uitest.define('run/feature/mobileViewport', ['run/config'], function(runConfig) {
    runConfig.appends.push(install);

    function install(window) {
        var doc = window.document,
            topDoc = window.top.document,
            viewportMeta = findViewportMeta(doc),
            topViewportMeta = findViewportMeta(topDoc),
            newMeta;
        if (topViewportMeta) {
            topViewportMeta.parentNode.removeChild(topViewportMeta);
        }

        if (viewportMeta) {
            newMeta = topDoc.createElement("meta");
            newMeta.setAttribute("name", "viewport");
            newMeta.setAttribute("content", viewportMeta.getAttribute("content"));
            topDoc.head.appendChild(newMeta);
        }
    }

    function findViewportMeta(doc) {
        var metas = doc.getElementsByTagName("meta"),
            meta,
            i;
        for (i=0; i<metas.length; i++) {
            meta = metas[i];
            if (meta.getAttribute('name')==='viewport') {
                return meta;
            }
        }
        return null;
    }
});
uitest.define('run/feature/timeoutSensor', ['run/config', 'run/ready'], function(runConfig, readyModule) {
    
    var timeouts = {},
        timoutStartCounter = 0;

    runConfig.prepends.unshift(install);
    readyModule.addSensor('timeout', state);
    return state;

    function install(window) {
        var oldTimeout = window.setTimeout;
        window.setTimeout = function (fn, time) {
            var handle;
            var callback = function () {
                delete timeouts[handle];
                if (typeof fn === 'string') {
                    /*jshint evil:true*/
                    window['eval'](fn);
                } else {
                    fn();
                }
            };
            handle = oldTimeout(callback, time);
            timeouts[handle] = true;
            timoutStartCounter++;
            return handle;
        };

        var oldClearTimeout = window.clearTimeout;
        window.clearTimeout = function (code) {
            oldClearTimeout(code);
            delete timeouts[code];
        };
    }

    function isReady() {
        var x;
        for (x in timeouts) {
            return false;
        }
        return true;
    }

    function state() {
        return {
            count: timoutStartCounter,
            ready: isReady()
        };
    }
});

uitest.define('run/feature/xhrSensor', ['run/config', 'run/ready'], function(runConfig, readyModule) {

    var ready = true,
        startCounter = 0;

    runConfig.prepends.unshift(install);

    readyModule.addSensor('xhr', state);
    return state;

    function install(window) {
        var copyStateFields = ['readyState', 'responseText', 'responseXML', 'status', 'statusText'];
        var proxyMethods = ['abort', 'getAllResponseHeaders', 'getResponseHeader', 'open', 'send', 'setRequestHeader'];

        var OldXHR = window.XMLHttpRequest;
        var DONE = 4;
        var newXhr = function() {
                var self = this;
                this.origin = new OldXHR();

                function copyState() {
                    for(var i = 0; i < copyStateFields.length; i++) {
                        var field = copyStateFields[i];
                        try {
                            self[field] = self.origin[field];
                        } catch(_) {}
                    }
                }

                function proxyMethod(name) {
                    self[name] = function() {
                        if(name === 'send') {
                            ready = false;
                            startCounter++;
                        } else if(name === 'abort') {
                            ready = true;
                        }
                        var res = self.origin[name].apply(self.origin, arguments);
                        copyState();
                        return res;
                    };
                }

                for(var i = 0; i < proxyMethods.length; i++) {
                    proxyMethod(proxyMethods[i]);
                }
                this.origin.onreadystatechange = function() {
                    if(self.origin.readyState === DONE) {
                        ready = true;
                    }
                    copyState();
                    if(self.onreadystatechange) {
                        self.onreadystatechange.apply(self.origin, arguments);
                    }
                };
                copyState();
            };
        window.XMLHttpRequest = newXhr;
    }

    function state() {
        return {
            count: startCounter,
            ready: ready
        };
    }
});
uitest.define('run/forceScriptRefreshPreprocessor', ['documentUtils', 'run/config', 'run/instrumentor', 'run/logger'], function(docUtils, runConfig, instrumentor, logger) {
    
    instrumentor.addPreprocessor(9999, forceScriptRefresh);

    function forceScriptRefresh(html) {
        var now = runConfig.now;
        logger.log("forcing script refresh with timestamp "+runConfig.now);
        return docUtils.replaceScripts(html, function(parsedTag) {
            if(!parsedTag.scriptUrl) {
                return undefined;
            }
            return parsedTag.scriptOpenTag.replace(parsedTag.scriptUrl, parsedTag.scriptUrl+'?'+now)+"</script>";
        });
    }

});


uitest.define('run/injector', ['annotate', 'utils'], function(annotate, utils) {

	var defaultResolvers = [];

	function inject(fn, self, values) {
		var argNames = annotate(fn),
			argValues = [],
			i;
		fn = utils.isArray(fn)?fn[fn.length-1]:fn;
		for (i=0; i<argNames.length; i++) {
			
			argValues.push(resolveArgIncludingDefaultResolvers(argNames[i], values));
		}
		return fn.apply(self, argValues);
	}

	function resolveArgIncludingDefaultResolvers(argName, resolvers) {
		var resolved = resolveArg(argName, resolvers);
		if (resolved===undefined) {
			resolved = resolveArg(argName, defaultResolvers);
		}
		return resolved;
	}

	function resolveArg(argName, resolvers) {
		var i, resolver, resolved;
		for (i=0; i<resolvers.length && !resolved; i++) {
			resolver = resolvers[i];
			if (utils.isFunction(resolver)) {
				resolved = resolver(argName);
			} else {
				resolved = resolver[argName];
			}
		}
		return resolved;
	}

	function addDefaultResolver(resolver) {
		defaultResolvers.push(resolver);
	}

	return {
		inject: inject,
		addDefaultResolver: addDefaultResolver
	};
});
uitest.define('run/instrumentor', ['documentUtils', 'run/config', 'run/logger'], function(docUtils, runConfig, logger) {

    var exports,
        NO_SCRIPT_TAG = "noscript",
        preprocessors = [],
        COMPARE_BY_PRIO = function(entry1, entry2) {
            return entry2.prio - entry1.prio;
        };

    function addPreprocessor(priority, preprocessor) {
        preprocessors.push({prio: priority, processor: preprocessor});
    }

    instrument.callbacks = [];

    function instrument(win) {
        preprocessors.sort(COMPARE_BY_PRIO);
        logger.log("starting instrumentation");
        exports.internal.deactivateAndCaptureHtml(win, function(html, browserFlags) {
            var i;
            logger.log("captured html");
            
            for (i=0; i<preprocessors.length; i++) {
                html = preprocessors[i].processor(html, browserFlags);
            }

            exports.internal.rewriteDocument(win, html);
        });
    }

    function deactivateAndCaptureHtml(win, callback) {
        // This will wrap the rest of the document into a noscript tag.
        // By this, that content will not be executed!
        var htmlPrefix = docUtils.serializeHtmlBeforeLastScript(win.document);
        win.document.write('<!--[if lt IE 10]>' + docUtils.contentScriptHtml('window.ieLt10=true;') + '<![endif]-->');
        win.document.write('</head><body><' + NO_SCRIPT_TAG + '>');
        win.addEventListener('load', function() {
            var noscriptEl = win.document.getElementsByTagName(NO_SCRIPT_TAG)[0];
            var noscriptElContent = noscriptEl.textContent;
            var browserFlags = {
                ieLt10: !! win.ieLt10
            };
            if(noscriptElContent) {
                callback(htmlPrefix + noscriptElContent, browserFlags);
            } else {
                logger.log("couldn't retrive the document html using the noscript hack, doing another xhr request...");
                // Android 2.3 browsers don't wrap the rest of the document
                // into the noscript tag, but leave it empty :-(
                // At least it stops the document from loading...
                docUtils.loadFile(win, win.document.location.href, true, function(error, data) {
                    if(error) {
                        throw error;
                    }
                    data = data.replace("parent.uitest.instrument(window)", "");
                    callback(data, browserFlags);
                });
            }
        }, false);
    }

    function rewriteDocument(win, html) {
        win.newContent = html;
        // This trick is needed for IE10 and IE9
        // so that the window keeps it's original url although we replace it's content!
        // (setTimeout only needed for IE9!)
        var sn = win.document.createElement("script");
        sn.setAttribute("type", "text/javascript");
        sn.textContent = 'function rewrite() { document.open();document.write(newContent);document.close();} window.setTimeout(rewrite,0);';
        win.document.body.appendChild(sn);
    }

    function createRemoteCallExpression(callback) {
        var argExpressions = Array.prototype.slice.call(arguments, 1) || [],
            callbackId = instrument.callbacks.length;
        instrument.callbacks.push(callback);
        return "parent.uitest.instrument.callbacks[" + callbackId + "](" + argExpressions.join(",") + ");";
    }

    exports = {
        internal: {
            instrument: instrument,
            deactivateAndCaptureHtml: deactivateAndCaptureHtml,
            rewriteDocument: rewriteDocument
        },
        createRemoteCallExpression: createRemoteCallExpression,
        addPreprocessor: addPreprocessor,
        global: {
            uitest: {
                instrument: instrument
            }
        }
    };
    return exports;
});
uitest.define('run/lesserThanIe10Preprocessor', ['run/instrumentor', 'run/logger', 'documentUtils'], function(instrumentor, logger, docUtils) {
    instrumentor.addPreprocessor(-9999, fixIeLesserThan10ScriptExecutionOrderWithDocumentWrite);

    // IE<=9 executes scripts with src urls when doing a document.write
    // out of the normal order. Because of this, we are
    // replacing them by an inline script that executes those
    // scripts using eval at the right place.
    function fixIeLesserThan10ScriptExecutionOrderWithDocumentWrite(html, browserFlags) {
        if (!browserFlags.ieLt10) {
            return html;
        }
        logger.log("applying ie<10 bugfix");
        return docUtils.replaceScripts(html, function(parsedTag) {
            if(!parsedTag.scriptUrl) {
                return undefined;
            }
            var scriptOpenTag = parsedTag.scriptOpenTag.replace(parsedTag.srcAttribute, '');
            return scriptOpenTag + instrumentor.createRemoteCallExpression(function(win) {
                docUtils.loadAndEvalScriptSync(win, parsedTag.scriptUrl);
            }, "window") + '</script>';
        });
    }
    
});

uitest.define('run/loadSensor', ['run/ready', 'run/config'], function(readyModule, runConfig) {

	var count = 0,
		ready, win, doc, waitForDocComplete;

	init();
	runConfig.appends.push(function(window, document) {
		win = window;
		doc = document;
		waitForDocComplete = true;
	});

	loadSensor.reloaded = reloaded;

	readyModule.addSensor("load", loadSensor);
	return loadSensor;

	function init() {
		ready = false;
		waitForDocComplete = false;
	}

	function loadSensor() {
		if (waitForDocComplete && docReady(doc)) {
			waitForDocComplete = false;
			// this timeout is required for IE, as it sets the
			// readyState to "interactive" before the DOMContentLoaded event.
			win.setTimeout(function() {
				ready = true;
			},1);
		}
		return {
			count: count,
			ready: ready
		};
	}

	function docReady(doc) {
		return doc.readyState==='complete' || doc.readyState==='interactive';
	}

	function reloaded(callback) {
		count++;
		init();
		readyModule.ready(callback);
	}
});

uitest.define('run/logger', ['global', 'run/config'], function(global, runConfig) {

    var lastMsg;
    function log(msg) {
        if (runConfig.trace && lastMsg!==msg) {
            lastMsg = msg;
            global.console.log(msg);
        }
    }

    return {
        log: log
    };
});

uitest.define('run/ready', ['run/injector', 'global', 'run/logger'], function(injector, global, logger) {

	var sensorInstances = {};

	function addSensor(name, sensor) {
		sensorInstances[name] = sensor;
	}

	// Goal:
	// - Detect async work that cannot detected before some time after it's start
	//   (e.g. the WebKitAnimationStart event is not fired until some ms after the dom change that started the animation).
	// - Detect the situation where async work starts another async work
	//
	// Algorithm:
	// Wait until all readySensors did not change for 50ms.


	function ready(listener) {
		var sensorStatus;

		function restart() {
			sensorStatus = aggregateSensorStatus(sensorInstances);
			if(sensorStatus.busySensors.length !== 0) {
				logger.log("ready waiting for [" + sensorStatus.busySensors + "]");
				global.setTimeout(restart, 10);
			} else {
				global.setTimeout(ifNoAsyncWorkCallListenerElseRestart, 10);
			}
		}

		function ifNoAsyncWorkCallListenerElseRestart() {
			var currentSensorStatus = aggregateSensorStatus(sensorInstances);
			if(currentSensorStatus.busySensors.length === 0 && currentSensorStatus.count === sensorStatus.count) {
				injector.inject(listener, null, []);
			} else {
				restart();
			}
		}

		restart();
	}

	function aggregateSensorStatus(sensorInstances) {
		var count = 0,
			busySensors = [],
			sensorName, sensor, sensorStatus;
		for(sensorName in sensorInstances) {
			sensor = sensorInstances[sensorName];
			sensorStatus = sensor();
			count += sensorStatus.count;
			if(!sensorStatus.ready) {
				busySensors.push(sensorName);
			}
		}
		return {
			count: count,
			busySensors: busySensors
		};
	}

	return {
		addSensor: addSensor,
		ready: ready
	};
});
uitest.define('run/requirejsScriptAdder', ['run/config', 'run/instrumentor', 'run/defaultScriptAdder', 'documentUtils', 'run/injector', 'run/logger', 'utils'], function(runConfig, instrumentor, defaultScriptAdder, docUtils, injector, logger, utils) {
    var REQUIRE_JS_RE = /require[\W]/;

    instrumentor.addPreprocessor(11, preprocess);

    function preprocess(html) {
        return docUtils.replaceScripts(html, function(parsedScript) {
            var appends = runConfig.appends,
                intercepts = runConfig.intercepts;

            if(!parsedScript.scriptUrl) {
                return undefined;
            }
            if(parsedScript.scriptUrl.match(REQUIRE_JS_RE)) {
                // Empty the appends array in the config,
                // so the defaultScriptAdder does nothing for them.
                logger.log("detected requirejs with script url "+parsedScript.scriptUrl);
                runConfig.appends = [];
                return parsedScript.match + docUtils.contentScriptHtml(instrumentor.createRemoteCallExpression(function(win) {
                    afterRequireJsScript(win, appends, intercepts);
                }, "window"));
            }

            return undefined;
        });
    }

    function afterRequireJsScript(win, appends, intercepts) {
        if(!win.require) {
            throw new Error("requirejs script was detected by url matching, but no global require function found!");
        }

        var _require = patchRequire(win, appends);
        patchLoad(_require, intercepts);
    }

    function patchRequire(win, appends) {
        var _require = win.require;
        win.require = function(deps, originalCallback) {
            _require(deps, function() {
                var args = arguments,
                    self = this;
                execAppends(win, _require, appends, function() {
                    originalCallback.apply(self, args);
                });
            });
        };
        win.require.config = _require.config;
        return _require;
    }

    function execAppends(win, _require, appends, finishedCallback) {
        var i = 0;
        logger.log("adding appends using requirejs");
        execNext();

        function execNext() {
            var append;
            if(i >= appends.length) {
                finishedCallback();
            } else {
                append = appends[i++];
                if(utils.isString(append)) {
                    _require([append], execNext);
                } else {
                    injector.inject(append, win, [win]);
                    execNext();
                }
            }
        }
    }

    function patchLoad(_require, intercepts) {
        var _load = _require.load;
        _require.load = function(context, moduleName, url) {
            
            var scriptExecutor = defaultScriptAdder.createInterceptingScriptExecutor(url, intercepts);
            if(!scriptExecutor) {
                return _load.apply(this, arguments);
            }
            try {
                scriptExecutor();
                context.completeLoad(moduleName);
            } catch(error) {
                //Set error on module, so it skips timeout checks.
                context.registry[moduleName].error = true;
                throw error;
            }
        };
    }

    return {
        preprocess: preprocess
    };

});
uitest.define('run/testframe', ['urlParser', 'global', 'run/config', 'run/injector', 'run/logger'], function(urlParser, global, runConfig, injector, logger) {
    var REFRESH_URL_ATTRIBUTE = 'uitr',
        WINDOW_ID = 'uitestwindow',
        frameElement, frameWindow;

    global.top.uitest = global.uitest;
    frameElement = findIframe(global.top);
    if (!frameElement) {
        frameElement = createIframe(global.top);
        createToggleButton(global.top, frameElement);
    }
    frameWindow = getIframeWindow(frameElement);
    navigateWithReloadTo(frameWindow, runConfig.url);

    injector.addDefaultResolver(frameWindow);
    return frameWindow;

    function findIframe(topWindow) {
        return topWindow.document.getElementById(WINDOW_ID);
    }

    function createIframe(topWindow) {
        var doc = topWindow.document,
            frameElement = doc.createElement("iframe");

        frameElement.setAttribute("id", WINDOW_ID);
        frameElement.setAttribute("width", "100%");
        frameElement.setAttribute("height", "100%");
        frameElement.setAttribute("style", "position: absolute; bottom: 0; left: 0;background-color:white; border: 0px");
        frameElement.style.zIndex = 100;
        doc.body.appendChild(frameElement);

        return frameElement;
    }

    function createToggleButton(topWindow, iframeElement) {
        var doc = topWindow.document,
            toggleButton = doc.createElement("button");
        toggleButton.textContent = "Toggle testframe";
        toggleButton.setAttribute("style", "position: absolute; z-index: 1000; top: 0; right: 0; cursor: pointer;");
        toggleButton.addEventListener("click", toggleListener, false);
        doc.body.appendChild(toggleButton);
        return toggleButton;

        function toggleListener() {
            frameElement.style.zIndex = frameElement.style.zIndex * -1;
        }
    }

    function getIframeWindow(frameElement) {
        return frameElement.contentWindow || frameElement.contentDocument;
    }

    function navigateWithReloadTo(win, url) {
        url = makeAbsolute(url);
        logger.log("opening url "+url);
        var parsedUrl = urlParser.parseUrl(url);

        urlParser.setOrReplaceQueryAttr(parsedUrl, REFRESH_URL_ATTRIBUTE, runConfig.now);
        win.location.href = urlParser.serializeUrl(parsedUrl);
    }

    function makeAbsolute(url) {
        return urlParser.makeAbsoluteUrl(url, urlParser.uitestUrl());
    }
});

uitest.define('jasmineSugar', ['facade', 'global'], function(facade, global) {

    if (!global.jasmine) {
        return {};
    }

    function currentIdAccessor() {
        var ids = [],
            env = global.jasmine.getEnv(),
            spec = env.currentSpec,
            suite = env.currentSuite;
        // Note for the check of spec.queue.running:
        // Jasmine leaves env.currentSpec filled even if outside
        // of any spec from the last run!
        if (spec && spec.queue.running) {
            ids.unshift(spec.id);
            suite = spec.suite;
        }
        while (suite) {
            ids.unshift(suite.id);
            suite = suite.parentSuite;
        }
        return ids.join(".");
    }

    facade.currentIdAccessor(currentIdAccessor);

    function runs(callback, timeout) {
        var ready = false;
        global.runs(function() {
            facade.current.ready(function() {
                ready = true;
            });
        });
        global.waitsFor(function() {
            return ready;
        }, "uitest.ready", timeout);
        global.runs(function() {
            facade.current.inject(callback);
        });
    }

    function runsAfterReload(callback, timeout) {
        var ready = false;
        global.runs(function() {
            facade.current.reloaded(function() {
                ready = true;
            });
        });
        global.waitsFor(function() {
            return ready;
        }, "uitest.reloaded", timeout);
        global.runs(function() {
            facade.current.inject(callback);
        });

    }
 
    return {
        currentIdAccessor: currentIdAccessor,
        runs: runs,
        runsAfterReload: runsAfterReload,
        global: {
            uitest: {
                current: {
                    runs: runs,
                    runsAfterReload: runsAfterReload
                }
            }
        }
    };
});
uitest.define('urlParser', ['global'], function (global) {
    var UI_TEST_RE = /(uitest|simpleRequire)[^\w\/][^\/]*$/;


    function parseUrl(url) {
        var hashIndex = url.indexOf('#');
        var hash;
        var query = '';
        if (hashIndex !== -1) {
            hash = url.substring(hashIndex + 1);
            url = url.substring(0, hashIndex);
        }
        var queryIndex = url.indexOf('?');
        if (queryIndex !== -1) {
            query = url.substring(queryIndex + 1);
            url = url.substring(0, queryIndex);
        }
        return {
            baseUrl:url,
            hash:hash,
            query:query ? query.split('&') : []
        };
    }

    function serializeUrl(parsedUrl) {
        var res = parsedUrl.baseUrl;
        if (parsedUrl.query && parsedUrl.query.length) {
            res += '?' + parsedUrl.query.join('&');
        }
        if (parsedUrl.hash) {
            res += '#' + parsedUrl.hash;
        }
        return res;
    }

    function setOrReplaceQueryAttr(parsedUrl, attr, value) {
        var newQueryEntry = attr + '=' + value;
        var query = parsedUrl.query;
        for (var i = 0; i < query.length; i++) {
            if (query[i].indexOf(attr) === 0) {
                query[i] = newQueryEntry;
                return;
            }
        }
        query.push(newQueryEntry);
    }

    function uitestUrl() {
        var scriptNodes = global.document.getElementsByTagName("script"),
            i, src;
        for(i = 0; i < scriptNodes.length; i++) {
            src = scriptNodes[i].src;
            if(src && src.match(UI_TEST_RE)) {
                return src;
            }
        }
        throw new Error("Could not locate uitest.js in the script tags of the browser");
    }

    function basePath(url) {
        var lastSlash = url.lastIndexOf('/');
        if(lastSlash === -1) {
            return '';
        }
        return url.substring(0, lastSlash);
    }

    function makeAbsoluteUrl(url, baseUrl) {
        if(url.charAt(0) === '/' || url.indexOf('://') !== -1) {
            return url;
        }
        return basePath(baseUrl) + '/' + url;
    }

    function filenameFor(url) {
        var lastSlash = url.lastIndexOf('/');
        var urlWithoutSlash = url;
        if(lastSlash !== -1) {
            urlWithoutSlash = url.substring(lastSlash + 1);
        }
        var query = urlWithoutSlash.indexOf('?');
        if (query !== -1) {
            return urlWithoutSlash.substring(0, query);
        }
        return urlWithoutSlash;
    }

    return {
        setOrReplaceQueryAttr:setOrReplaceQueryAttr,
        parseUrl:parseUrl,
        serializeUrl:serializeUrl,
        makeAbsoluteUrl: makeAbsoluteUrl,
        filenameFor: filenameFor,
        uitestUrl: uitestUrl
    };
});
uitest.define('utils', ['global'], function(global) {
    function isString(obj) {
        return obj && obj.slice;
    }

    function isFunction(value) {
        return typeof value === 'function';
    }

    function isArray(value) {
        return global.Object.prototype.toString.apply(value) === '[object Array]';
    }

    return {
        isString: isString,
        isFunction: isFunction,
        isArray: isArray

    };

});
(function () {
    uitest.require(["facade", "jasmineSugar"]);
})();
