describe('run/instrumentor', function() {
    var instrumentor, frame, documentUtils, config, global, require;
    beforeEach(function() {
        config = {
            appends: [],
            prepends: [],
            intercepts: []
        };
        require = jasmine.createSpy('require');
        global = {
        };
        var modules = uitest.require({
            "run/config": config,
            global: global
     }, ["run/instrumentor", "documentUtils"]);
        documentUtils = modules.documentUtils;
        instrumentor = modules["run/instrumentor"];
        spyOn(documentUtils, 'rewriteDocument');
        spyOn(documentUtils, 'loadAndEvalScriptSync');
        spyOn(documentUtils, 'loadFile');
    });

    describe('instrument', function() {
        var win = {
            a: 1
        };
        beforeEach(function() {
            config.b = 2;
            spyOn(instrumentor.internal, 'deactivateAndCaptureHtml');
            spyOn(instrumentor.internal, 'modifyHtmlWithConfig');
            spyOn(instrumentor.internal, 'forceScriptRefresh');
            spyOn(instrumentor.internal, 'fixIeLesserThan10ScriptExecutionOrderWithDocumentWrite');
        });
        it('should deactivateAndCaptureHtml then modifyHtmlWithConfig, then forceScriptRefresh then rewriteHtml', function() {
            var someHtml = 'someHtml';
            var someModifiedHtml = 'someModifiedHtml';
            var someForcedHtml = 'someForcedHtml';
            instrumentor.internal.deactivateAndCaptureHtml.andCallFake(function(win, callback) {
                callback(someHtml, {});
            });
            instrumentor.internal.modifyHtmlWithConfig.andReturn(someModifiedHtml);
            instrumentor.internal.forceScriptRefresh.andReturn(someForcedHtml);


            instrumentor.internal.instrument(win);

            expect(instrumentor.internal.deactivateAndCaptureHtml).toHaveBeenCalled();
            expect(instrumentor.internal.deactivateAndCaptureHtml.mostRecentCall.args[0]).toBe(win);
            expect(instrumentor.internal.modifyHtmlWithConfig).toHaveBeenCalledWith(someHtml);
            expect(instrumentor.internal.forceScriptRefresh).toHaveBeenCalledWith(win, someModifiedHtml);
            expect(documentUtils.rewriteDocument).toHaveBeenCalledWith(win, someForcedHtml);
        });
        it('should fixIeLesserThan10ScriptExecutionOrderWithDocumentWrite if ie<10', function() {
            var someHtml = 'someHtml';
            var someModifiedHtml = 'someModifiedHtml';
            var someIeFixedHtml = 'someIeFixedHtml';
            instrumentor.internal.deactivateAndCaptureHtml.andCallFake(function(win, callback) {
                callback(someHtml, {ieLt10: true});
            });
            instrumentor.internal.modifyHtmlWithConfig.andReturn(someModifiedHtml);
            instrumentor.internal.fixIeLesserThan10ScriptExecutionOrderWithDocumentWrite.andReturn(someIeFixedHtml);
            instrumentor.internal.instrument(win);
            expect(instrumentor.internal.fixIeLesserThan10ScriptExecutionOrderWithDocumentWrite).toHaveBeenCalledWith(someModifiedHtml);
            expect(instrumentor.internal.forceScriptRefresh).toHaveBeenCalledWith(win, someIeFixedHtml);
        });
        it('should make it global', function() {
            expect(global.uitest.instrument).toBe(instrumentor.internal.instrument);
        });
    });
    
    describe('deactivateAndCaptureHtml', function() {
        var html;

        beforeEach(function() {
            documentUtils.loadFile.andCallFake(function(win, url, async, callback) {
                callback(null, 'someHtmlLoadedViaXhr');
            });
        });

        function init(prefix, suffix) {
            html = '';

            runs(function() {
                window.tmp = function() {
                    instrumentor.internal.deactivateAndCaptureHtml(testutils.frame.win, function(_html) {
                        html = _html;
                    });
                };
                testutils.createFrame(prefix + '<script>parent.tmp()</script>' + suffix);
            });
            waitsFor(function() {
                return html;
            }, 200);
        }

        var android = /android/i.test(window.navigator.userAgent.toLowerCase());
        if (!android) {
            describe('not on android', function() {
                // Here we want to enforce that the <noscript> tag works at least
                // on some browsers!
                // That deactivateAndCaptureHtml also works on android devices
                // is proofed by the ui tests!
                it('should give the html without the calling script to the callback', function() {
                    var prefix = '<html><head>',
                        suffix = '</head></html>';
                    init(prefix, suffix);
                    runs(function() {
                        expect(html).toBe(prefix + suffix);
                    });
                });
            });
        }

        it('should load the html using the noscript hack or xhr if the noscript hack did not work', function() {
            var prefix = '<html><head>',
                suffix = '</head></html>';
            init(prefix, suffix);
            runs(function() {
                expect(html===prefix+suffix || html==='someHtmlLoadedViaXhr').toBe(true);
            });
        });

        it('should not execute scripts after it', function() {
            var prefix = '<html><head>',
                suffix = '<script>window.test=true;</script></head></html>';
            init(prefix, suffix);
            runs(function() {
                expect(testutils.frame.win.test).toBeUndefined();
            });
        });
    });

    describe('fixIeLesserThan10ScriptExecutionOrderWithDocumentWrite',function() {
        var win;
        beforeEach(function() {
            win = {
                a:1
            };
        });
        it('should remove the src attribute from script tags, add an inline call and leave the other attributes ok', function() {
            var html = instrumentor.internal.fixIeLesserThan10ScriptExecutionOrderWithDocumentWrite('<script src="someUrl" data="test"></script>');
            expect(html).toBe('<script  data="test">parent.uitest.instrument.callbacks[0](window);</script>');
        });
        it('should load and eval the script using xhr on callback', function() {
            instrumentor.internal.fixIeLesserThan10ScriptExecutionOrderWithDocumentWrite('<script src="someUrl"></script>');
            instrumentor.internal.instrument.callbacks[0](win);
            expect(documentUtils.loadAndEvalScriptSync).toHaveBeenCalledWith(win, "someUrl");
        });
    });

    describe('forceScriptRefresh', function() {
        var win;
        beforeEach(function() {
            win = {
                Date: {
                    now: jasmine.createSpy('now').andReturn(123)
                }
            };
        });
        it('should add Date.now() to every script with a url', function() {
            var html = instrumentor.internal.forceScriptRefresh(win, '<script src="someUrl"></script>');
            expect(html).toBe('<script src="someUrl?123"></script>');
        });
        it('should not modify scripts without src', function() {
            var html = instrumentor.internal.forceScriptRefresh(win, '<script>some</script>');
            expect(html).toBe('<script>some</script>');
        });
    });

    describe('modifyHtmlWithConfig', function() {
        describe('prepends', function() {
            var html;
            beforeEach(function() {
                html = '<head>something';
            });
            describe('callbacks', function() {
                it('should add a script tag after <head>', function() {
                    var callback = jasmine.createSpy('callback');
                    config.prepends = [callback];
                    html = instrumentor.internal.modifyHtmlWithConfig(html);
                    expect(html).toBe('<head>' + '<script type="text/javascript">parent.uitest.instrument.callbacks[0](window);</script>something');
                });
                it('should call the callback with dependency injection', function() {
                    var receivedArgs;
                    var callback = function(a) {
                            receivedArgs = arguments;
                        };
                    config.prepends = [callback];
                    instrumentor.internal.modifyHtmlWithConfig(html);
                    instrumentor.internal.instrument.callbacks[0]({
                        a: 1
                    });
                    expect(receivedArgs).toEqual([1]);
                });
                it('should insert only one script tag if multiple callbacks follow each other', function() {
                    var callback = jasmine.createSpy('callback');
                    config.prepends = [callback, callback];
                    html = instrumentor.internal.modifyHtmlWithConfig(html);
                    expect(html).toBe('<head>' + '<script type="text/javascript">parent.uitest.instrument.callbacks[0](window);</script>something');
                    instrumentor.internal.instrument.callbacks[0]({});
                    expect(callback.callCount).toBe(2);
                });
            });
            it('should add a script tag for every config.prepend script-url after <head>', function() {
                config.prepends = ['someUrlScript'];
                html = instrumentor.internal.modifyHtmlWithConfig(html);
                expect(html).toBe('<head>' + '<script type="text/javascript" src="someUrlScript"></script>something');
            });
            it('should work for callback, script-url, callback', function() {
                config.prepends = ['someUrlScript', jasmine.createSpy('a'), 'someScriptUrl2'];
                html = instrumentor.internal.modifyHtmlWithConfig(html);
                expect(html).toBe('<head>' + '<script type="text/javascript" src="someUrlScript"></script><script type="text/javascript">parent.uitest.instrument.callbacks[0](window);</script><script type="text/javascript" src="someScriptUrl2"></script>something');

            });
        });
        describe('with requirejs', function() {
            var REQUIREJS_SCRIPT = '<script src="require.js"></script>',
                HTML = 'before'+REQUIREJS_SCRIPT+'after</body>',
                require, win, requireCallback, someDepNames, someDepValues, requireLoad,
                loadContext;
            beforeEach(function() {
                require = jasmine.createSpy('require');
                requireLoad = jasmine.createSpy('requireLoad');
                require.load = requireLoad;
                requireCallback = jasmine.createSpy('requireCallback');
                someDepNames = ['someDepName'];
                someDepValues = ['someDepValue'];
                win = {
                    require: require,
                    a: 1
                };
                loadContext = {
                    registry: {},
                    completeLoad: jasmine.createSpy('completeLoad')
                };
            });
            it('should append an inline script after requirejs', function() {
                var html = instrumentor.internal.modifyHtmlWithConfig(HTML);
                expect(html).toBe('before'+REQUIREJS_SCRIPT+'<script type="text/javascript">parent.uitest.instrument.callbacks[0](window);</script>after</body>');
            });
            it('should call the original require-callback with the original args', function() {
                var reqConfig = {};

                require.config = reqConfig;
                instrumentor.internal.modifyHtmlWithConfig(HTML);
                instrumentor.internal.instrument.callbacks[0](win);
                
                expect(win.require).not.toBe(require);
                expect(win.require.config).toBe(reqConfig);
                
                win.require(someDepNames, requireCallback);
                expect(require.mostRecentCall.args[0]).toBe(someDepNames);
                require.mostRecentCall.args[1](someDepValues);
                expect(requireCallback).toHaveBeenCalledWith(someDepValues);
            });
            it('should call the original require.load', function() {
                var someModuleName = 'someModule', someUrl = 'someUrl';

                instrumentor.internal.modifyHtmlWithConfig(HTML);
                instrumentor.internal.instrument.callbacks[0](win);

                expect(require.load).not.toBe(requireLoad);
                require.load(loadContext, someModuleName, someUrl);
                expect(requireLoad).toHaveBeenCalledWith(loadContext, someModuleName, someUrl);
            });

            describe('append', function() {
                it('should not add a script tag before </body>', function() {
                    config.appends = [jasmine.createSpy('callback')];
                    var html = instrumentor.internal.modifyHtmlWithConfig(HTML);
                    expect(html).toBe('before'+REQUIREJS_SCRIPT+'<script type="text/javascript">parent.uitest.instrument.callbacks[0](window);</script>after</body>');
                });
                it('should call callbacks with dep.inj. before calling the original callback', function() {
                    var receivedArgs;
                    var callback = function(a) {
                            receivedArgs = arguments;
                        };
                    config.appends = [callback];
                    instrumentor.internal.modifyHtmlWithConfig(HTML);
                    instrumentor.internal.instrument.callbacks[0](win);
                    
                    expect(receivedArgs).toBeUndefined();
                    win.require(someDepNames, requireCallback);
                    require.mostRecentCall.args[1](someDepValues);
                    expect(receivedArgs).toEqual([1]);
                    expect(requireCallback.mostRecentCall.args[0]).toEqual(someDepValues);
                });
                it('should add scripts using nested require calls and then call the original require callback', function() {
                    config.appends = ['someScript'];
                    instrumentor.internal.modifyHtmlWithConfig(HTML);
                    instrumentor.internal.instrument.callbacks[0](win);

                    win.require(someDepNames, requireCallback);
                    expect(require.mostRecentCall.args[0]).toBe(someDepNames);
                    require.mostRecentCall.args[1](someDepValues);
                    expect(requireCallback).not.toHaveBeenCalled();
                    expect(require.mostRecentCall.args[0]).toEqual(['someScript']);
                    require.mostRecentCall.args[1]();
                    expect(requireCallback).toHaveBeenCalledWith(someDepValues);
                });
            });
            describe('intercept', function() {
                function simulateLoad(intercept, scriptUrl) {
                    scriptUrl = scriptUrl || 'interceptUrl';
                    config.intercepts = [intercept];
                    instrumentor.internal.modifyHtmlWithConfig(HTML);
                    instrumentor.internal.instrument.callbacks[0](win);
                    require.load(loadContext, 'someModule', scriptUrl);
                }

                it('should load the original script using docUtils.loadAndEvalScriptSync', function() {
                    simulateLoad({
                            script: 'interceptUrl'
                    });

                    var args = documentUtils.loadAndEvalScriptSync.mostRecentCall.args;
                    expect(args[0]).toBe(win);
                    expect(args[1]).toBe('interceptUrl');

                    expect(loadContext.completeLoad).toHaveBeenCalledWith('someModule');
                });
                it('should do nothing if the filename does not match', function() {
                    simulateLoad({
                        script: 'interceptUrl2'
                    });

                    expect(documentUtils.loadAndEvalScriptSync).not.toHaveBeenCalled();
                });
                it('should match ignoring the folder', function() {
                    simulateLoad({
                            script: 'interceptUrl'
                    }, 'someFolder/interceptUrl');

                    expect(documentUtils.loadAndEvalScriptSync).toHaveBeenCalled();
                });
                it('should mark the module as erroneous if docUtils.loadAndEvalScriptSync threw an error', function() {
                    loadContext.registry.someModule = {};
                    documentUtils.loadAndEvalScriptSync.andThrow(new Error("someError"));

                    expect(function() {
                        simulateLoad({
                                script: 'interceptUrl'
                            });
                    }).toThrow(new Error("someError"));
                    expect(loadContext.registry.someModule).toEqual({error: true});
                    expect(loadContext.completeLoad).not.toHaveBeenCalled();
                });

                describe('function instrumentation', function() {
                    var evaledScript, originalThis, originalArguments, originalFn;
                    beforeEach(function() {
                        win.someGlobal = 'glob';
                        originalFn = jasmine.createSpy('originalFn');
                        originalThis = {
                            a: 1
                        };
                        originalArguments = ['loc'];
                    });

                    function simulateLoadAndFnCall(instrumentCb) {
                        simulateLoad({
                                script: 'interceptUrl',
                                fn: 'someName',
                                callback: instrumentCb
                            });

                        evaledScript = documentUtils.loadAndEvalScriptSync.mostRecentCall.args[2]('function someName(){');
                        instrumentor.internal.instrument.callbacks[1](win, originalFn, originalThis, originalArguments);
                    }

                    it('should instrument named functions in the original script', function() {
                        config.intercepts = [{
                                script: 'interceptUrl'
                            }];
                        var instrumentCallback = jasmine.createSpy('callback');
                        simulateLoadAndFnCall(instrumentCallback);
                        expect(evaledScript).toEqual('function someName(){if (!someName.delegate)return parent.uitest.instrument.callbacks[1](window,someName,this,arguments);');
                    });
                    it('should call the intercept callback using dependency injection', function() {
                        var instrumentCbArgs, instrumentCbSelf;
                        originalFn = function(someLocal) {

                        };
                        var instrumentCb = function(someGlobal, someLocal, $delegate) {
                                instrumentCbArgs = arguments;
                                instrumentCbSelf = this;
                            };
                        simulateLoadAndFnCall(instrumentCb);

                        expect(instrumentCbArgs).toEqual(['glob','loc',
                        {
                            name: 'someName',
                            fn: originalFn,
                            self: originalThis,
                            args: originalArguments
                        }]);
                        expect(instrumentCbSelf).toBe(originalThis);
                    });
                    it('should allow the instrumentCb to call the original function', function() {
                        var instrumentCb = function($delegate) {
                                $delegate.fn.apply($delegate.self, $delegate.args);
                            };
                        simulateLoadAndFnCall(instrumentCb);
                        expect(originalFn.mostRecentCall.args).toEqual(originalArguments);
                    });
                });

            });

        });
        describe('without requirejs', function() {
            describe('appends', function() {
                describe('callbacks', function() {
                    it('should add a script tag before </body>', function() {
                        var html = 'something</body>';
                        config.appends = [jasmine.createSpy('callback')];
                        html = instrumentor.internal.modifyHtmlWithConfig(html);
                        expect(html).toBe('something' + '<script type="text/javascript">parent.uitest.instrument.callbacks[0](window);</script></body>');
                    });
                    it('should call callbacks with dependency injection', function() {
                        var html = 'something</body>';
                        var receivedArgs;
                        var callback = function(a) {
                                receivedArgs = arguments;
                            };
                        config.appends = [callback];
                        instrumentor.internal.modifyHtmlWithConfig(html);
                        instrumentor.internal.instrument.callbacks[0]({
                            a: 1
                        });
                        expect(receivedArgs).toEqual([1]);
                    });
                    it('should insert only one script tag if multiple callbacks follow each other', function() {
                        var html = 'something</body>',
                            callback = jasmine.createSpy('callback');
                        config.appends = [callback, callback];
                        html = instrumentor.internal.modifyHtmlWithConfig(html);
                        expect(html).toBe('something' + '<script type="text/javascript">parent.uitest.instrument.callbacks[0](window);</script></body>');
                        instrumentor.internal.instrument.callbacks[0]({});
                        expect(callback.callCount).toBe(2);
                    });
                });
                it('should add a script tag for every config.append script-url', function() {
                    var html = 'something</body>';
                    config.appends = ['someUrlScript'];
                    html = instrumentor.internal.modifyHtmlWithConfig(html);
                    expect(html).toBe('something' + '<script type="text/javascript" src="someUrlScript"></script></body>');
                });
            });

            describe('intercepts', function() {
                var xhr, win, originalFn, originalThis, originalArguments, evaledScript;
                beforeEach(function() {
                    xhr = {
                        open: jasmine.createSpy('open'),
                        send: jasmine.createSpy('send')
                    };
                    win = {
                        someGlobal: 'glob'
                    };
                    originalFn = jasmine.createSpy('original');
                    originalThis = {
                        a: 1
                    };
                    originalArguments = ['loc'];
                });

                function simulateLoadAndFnCall(instrumentCb) {
                    config.intercepts = [{
                            script: 'interceptUrl',
                            fn: 'someName',
                            callback: instrumentCb
                        }];
                    instrumentor.internal.modifyHtmlWithConfig('<script src="interceptUrl"></script>');
                    instrumentor.internal.instrument.callbacks[0](win);
                    evaledScript = documentUtils.loadAndEvalScriptSync.mostRecentCall.args[2]('function someName(){');
                    instrumentor.internal.instrument.callbacks[1](win, originalFn, originalThis, originalArguments);
                }

                it('should replace intercepted scripts with an inline script', function() {
                    config.intercepts = [{
                            script: 'interceptUrl'
                        }];
                    var html = '<script src="interceptUrl"></script><script src="nonInterceptUrl"></script>';
                    html = instrumentor.internal.modifyHtmlWithConfig(html);
                    expect(html).toBe('<script type="text/javascript">parent.uitest.instrument.callbacks[0](window);</script><script src="nonInterceptUrl"></script>');
                });
                it('should only check the filname ignoring the folder', function() {
                    config.intercepts = [{
                            script: 'interceptUrl'
                        }];
                    var html = '<script src="someFolder/interceptUrl"></script><script src="nonInterceptUrl"></script>';
                    html = instrumentor.internal.modifyHtmlWithConfig(html);
                    expect(html).toBe('<script type="text/javascript">parent.uitest.instrument.callbacks[0](window);</script><script src="nonInterceptUrl"></script>');
                });
                it('should load the original script using docUtils.loadAndEvalScriptSync', function() {
                    config.intercepts = [{
                            script: 'interceptUrl'
                        }];
                    instrumentor.internal.modifyHtmlWithConfig('<script src="interceptUrl"></script>');
                    instrumentor.internal.instrument.callbacks[0](win);
                    var args = documentUtils.loadAndEvalScriptSync.mostRecentCall.args;
                    expect(args[0]).toBe(win);
                    expect(args[1]).toBe('interceptUrl');
                });
                it('should instrument named functions in the original script', function() {
                    var instrumentCallback = jasmine.createSpy('callback');
                    simulateLoadAndFnCall(instrumentCallback);
                    expect(evaledScript).toEqual('function someName(){if (!someName.delegate)return parent.uitest.instrument.callbacks[1](window,someName,this,arguments);');
                });
                it('should call the intercept callback using dependency injection', function() {
                    var instrumentCbArgs, instrumentCbSelf;
                    originalFn = function(someLocal) {

                    };
                    var instrumentCb = function(someGlobal, someLocal, $delegate) {
                            instrumentCbArgs = arguments;
                            instrumentCbSelf = this;
                        };
                    simulateLoadAndFnCall(instrumentCb);
                    expect(instrumentCbArgs).toEqual(['glob','loc',
                    {
                        name: 'someName',
                        fn: originalFn,
                        self: originalThis,
                        args: originalArguments
                    }]);
                    expect(instrumentCbSelf).toBe(originalThis);
                });
                it('should allow the instrumentCb to call the original function', function() {
                    var instrumentCb = function($delegate) {
                            $delegate.fn.apply($delegate.self, $delegate.args);
                        };
                    simulateLoadAndFnCall(instrumentCb);
                    expect(originalFn.mostRecentCall.args).toEqual(originalArguments);
                });

            });
        });
    });
});
