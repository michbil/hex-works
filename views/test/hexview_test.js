/**
 * Created by mich.bil on 21.01.15.
 */



describe('directive: hex-view', function() {
    var element, scope;

    beforeEach(module('hex'));

    beforeEach(inject(function($rootScope, $compile) {
        scope = $rootScope.$new();

        element = angular.element('<hex-view></hex-view>');

        scope.buffer = new BinBuf(1024);
        scope.offset = 0;
        scope.ready = 1;
        scope.current = 0;
        scope.render = 0;
        scope.masterExists = function () {
            return undefined;
        }

        scope.$digest();

        element = $compile(element)(scope);
        for (var i=5;i<1024;i++) {
            scope.buffer.setByte(i,i&0xFF);
        }
        scope.buffer.clearMarkers();
        scope.render++;
        scope.$digest();

    }));


    /*
    it("has to be correct size buffer displayed and correct data in it", function() {

        expect(element.find('#hexcolumn').children().length).toBe(16 * 16);
        expect(element.find('#bincolumn').children().length).toBe(16 * 16);

        element.find('#hexcolumn').children().each(function (i,el) {
            var cont = $(el).text();
            expect(cont).toBe(toHex(scope.buffer.getByte(i),2));
        })
    });

    it('testing buffer display lower than current screen size' ,function (done) {
        scope.buffer = new BinBuf(33);
        for (var i=0;i<33;i++) {
            scope.buffer.setByte(i,i&0xFF);
        }
        scope.render++;
        scope.$digest();

        expect(element.find('#hexcolumn').children().length).toBe(16 * 16);
        expect(element.find('#bincolumn').children().length).toBe(16 * 16);

        var elements = element.find('#hexcolumn').children();
        for (var i=0;i<33;i++) {

            expect($(elements[i]).text()).toBe(toHex(scope.buffer.getByte(i),2));
            var vis = $(elements[i]).css('display');
            vis = (vis === '') ||  (vis === 'block');
            expect(vis).toBe(true);
        }
        console.log("Checking that rest of the elements is hidden");
        for (var i=33;i<16*16;i++) {

            var vis = $(elements[i]).css('display');
            vis = (vis === 'none');
            expect(vis).toBe(true);
        }


        done();
    });


    var triggerKeyDown = function (element, keyCode) {
        var e = $.Event("keydown");
        e.which = keyCode;
        element.trigger(e);
    };

    function triggerKeyAscii(element,string) {
        for (var i=0;i<string.length;i++) {
            triggerKeyDown(element,string.charCodeAt(i))
        }

    }

    function inspectElementText(n) {
        var el = element.find('#hexcolumn').children()[n];
        return parseInt($(el).text(),16 );
    }

    it ('testing keyboard operation', function(done) {
        setTimeout(function () {
            // check key entry
            triggerKeyAscii(element,'1245612341')
            expect(inspectElementText(0)).toBe(0x12);
            expect(inspectElementText(1)).toBe(0x45);
            expect(inspectElementText(2)).toBe(0x61);
            expect(inspectElementText(3)).toBe(0x23);
            expect(inspectElementText(4)).toBe(0x41);
            expect(scope.buffer.current).toBe(5);

            // check changed markers
            expect($(element.find('#hexcolumn').children()[0]).hasClass("red")).toBe(true);
            expect($(element.find('#hexcolumn').children()[1]).hasClass("red")).toBe(true);
            expect($(element.find('#hexcolumn').children()[2]).hasClass("red")).toBe(true);
            expect($(element.find('#hexcolumn').children()[3]).hasClass("red")).toBe(true);
            expect($(element.find('#hexcolumn').children()[4]).hasClass("red")).toBe(true);
            expect($(element.find('#hexcolumn').children()[5]).hasClass("red")).toBe(false);
            expect($(element.find('#hexcolumn').children()[6]).hasClass("red")).toBe(false);

            // check marking with color redbg
            scope.buffer.setColor(0,'redbg');
            scope.render++;
            scope.$digest();
            var color = $(element.find('#hexcolumn').children()[0]).hasClass("redbg");
            expect(color).toBe(true);

            color = $(element.find('#hexcolumn').children()[1]).hasClass("redbg")
            expect(color).toBe(false);

            // test pagedown
            triggerKeyDown(element,keys.RIGHT);triggerKeyDown(element,keys.RIGHT);triggerKeyDown(element,keys.RIGHT);
            expect(scope.buffer.current).toBe(8);
            triggerKeyDown(element,keys.PAGEDN);
            expect(scope.buffer.current).toBe(8+16*16);

            done()
        }, 1000)
    });


     */
});
