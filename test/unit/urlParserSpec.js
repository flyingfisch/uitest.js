describe("urlParser", function () {
    var urlParser, global;
    beforeEach(function () {
        global = {
            document: {
                getElementsByTagName: jasmine.createSpy('getElementsByTagName').andReturn([{
                    src: 'uitest.js'
                }])
            }
        };
        urlParser = uitest.require({
            global: global
        },["urlParser"]
        ).urlParser;
    });

    describe('parseUrl and serializeUrl', function () {
        it('should parse and serialize urls without query and hash', function () {
            var someUrl = 'http://someUrl';
            var actualUrl = urlParser.parseUrl(someUrl);
            expect(actualUrl).toEqual({
                baseUrl:'http://someUrl',
                hash:undefined,
                query:[  ]
            });
            expect(urlParser.serializeUrl(actualUrl)).toEqual(someUrl);
        });
        it('should parse urls with hashes', function () {
            var someUrl = 'http://someUrl#123';
            var actualUrl = urlParser.parseUrl(someUrl);
            expect(actualUrl).toEqual({
                baseUrl:'http://someUrl',
                hash:"123",
                query:[  ]
            });
            expect(urlParser.serializeUrl(actualUrl)).toBe(someUrl);
        });
        it('should parse urls with queries', function () {
            var someUrl = 'http://someUrl?a=b&c';
            var actualUrl = urlParser.parseUrl(someUrl);
            expect(actualUrl).toEqual({
                baseUrl:'http://someUrl',
                hash:undefined,
                query:[ "a=b", "c" ]
            });
            expect(urlParser.serializeUrl(actualUrl)).toBe(someUrl);
        });
        it('should parse urls with queries and hashes', function () {
            var someUrl = 'http://someUrl?a=b&c#123';
            var actualUrl = urlParser.parseUrl(someUrl);
            expect(actualUrl).toEqual({
                baseUrl:'http://someUrl',
                hash:'123',
                query:[ "a=b", "c" ]
            });
            expect(urlParser.serializeUrl(actualUrl)).toBe(someUrl);
        });
    });

    describe('setOrReplaceQueryAttr', function() {
        it('should add a new query attribute if not existing', function() {
            var data = {
                query: []
            };
            urlParser.setOrReplaceQueryAttr(data, 'someProp', 'someValue');
            expect(data.query).toEqual(["someProp=someValue"]);
        });
        it('should replace a query attribute if existing', function() {
            var data = {
                query: ["a=b"]
            };
            urlParser.setOrReplaceQueryAttr(data, 'a', 'c');
            expect(data.query).toEqual(["a=c"]);
        });
    });

    describe('makeAbsoluteUrl', function() {
        it('should not change urls with a leading slash', function() {
            expect(urlParser.makeAbsoluteUrl('/someUrl', 'base')).toBe('/someUrl');
        });
        it('should not change urls with a protocol', function() {
            expect(urlParser.makeAbsoluteUrl('http://someUrl', 'base')).toBe('http://someUrl');
        });
        it('should change relative change urls with a base that contains no slash', function() {
            expect(urlParser.makeAbsoluteUrl('someUrl', 'base')).toBe('/someUrl');
        });
        it('should change relative change urls with a base that contains a single slash', function() {
            expect(urlParser.makeAbsoluteUrl('someUrl', '/base')).toBe('/someUrl');
        });
        it('should change relative change urls with a base that contains two or more slashes', function() {
            expect(urlParser.makeAbsoluteUrl('someUrl', '/base/file')).toBe('/base/someUrl');
        });
    });

    describe('uitestUrl', function() {
        function test(someUrl, shouldMatch) {
            global.document.getElementsByTagName.andReturn([{src: someUrl}]);
            if (shouldMatch) {
                expect(urlParser.uitestUrl()).toBe(someUrl);
            } else {
                expect(function() {
                    urlParser.uitestUrl();
                }).toThrow();
            }
        }

        it('should use the right regex', function() {
            test('uitest.js', true);
            test('uitest-v1.0.js', true);
            test('uitestutils.js', false);
            test('uitest/some.js', false);
            test('uitest.js/some.js', false);
            // Note: This test is required for our CI, as we load every file of uitest.js individually!
            test('simpleRequire.js', true);
        });
    });
});
