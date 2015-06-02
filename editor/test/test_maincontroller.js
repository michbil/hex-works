

describe('Controller: MainCtrl',function () {

    var $controller;
    var controller,$scope;

    calculate = function () {

    }

    function createTestBuffer() {
        var buffer = new ArrayBuffer(1024);
        var dataView = new DataView(buffer);
        for (var i=0;i<1024;i++) {
            dataView.setInt8(i,i&0xFF);
        };
        return buffer;
    }


    beforeEach(module('hex'))



    beforeEach(inject(function($injector,_$controller_,$rootScope) {
      $controller = _$controller_;
        $scope = $rootScope.$new()
        localforage.clear(function () { // clear local storage for test independency
            controller = $controller('main', { $scope: $scope });
        });
        $httpBackend = $injector.get('$httpBackend');
        // backend definition common for all tests
        authRequestHandler = $httpBackend.when('GET', '/calclist')
            .respond("<ul></ul>");

    }))
    it ('tesing controller import',function(done) {

        setTimeout(function() {

            expect($scope.tabs.length).toBe(1)
            var buffer = createTestBuffer();
            $scope.openTab(buffer,'name.bin');
            expect($scope.tabs.length).toBe(2)

            done();
        },1000);


    })
    it ('testing inspector',function (done) {
        setTimeout(function() {
            $scope.buffer.setByte(0,0x0);
            $scope.buffer.setByte(1,0x3);
            $scope.buffer.setByte(2,0x44);
            $scope.buffer.setByte(3,0x93);

            $scope.onSelect(0,3);
            expect($scope.inspector.value_hex).toBe('00034493');
            expect($scope.inspector.value_hex_inv).toBe('FFFCBB6C');
            expect($scope.inspector.value).toBe(214163);
            expect($scope.inspector.vinv).toBe(-214164);

            expect($scope.inspector.bvalue_hex).toBe('93440300');
            expect($scope.inspector.bvalue_hex_inv).toBe('6CBBFCFF');
            expect($scope.inspector.bvalue).toBe(-1824259328);
            expect($scope.inspector.bvinv).toBe(1824259327);

            expect($scope.inspector.sum).toBe(toHex(0xDA,2));
            expect($scope.inspector.sumxor).toBe(toHex(0xD4,2));

            done();
        },1000);
    })

    it ('testing encodeValue', function (done) {
        setTimeout(function() {
            $scope.buffer.setByte(0,0x45);
            $scope.buffer.setByte(1,0x23);
            $scope.buffer.setByte(2,0x12);
            $scope.buffer.setByte(3,0x9);

            $scope.onSelect(0,3);

            $scope.buffer.setByte(0,0x0);
            $scope.buffer.setByte(1,0x0);
            $scope.buffer.setByte(2,0x0);
            $scope.buffer.setByte(3,0x0);

            var val = $scope.inspector.value;
            $scope.encodeValue(val.toString());
            expect($scope.buffer.getByte(0)).toBe(0x45);
            expect($scope.buffer.getByte(1)).toBe(0x23);
            expect($scope.buffer.getByte(2)).toBe(0x12);
            expect($scope.buffer.getByte(3)).toBe(0x9);
            done();

        },1000);
    })
    it ('testing encodeBValue', function (done) {
        setTimeout(function() {
            $scope.buffer.setByte(0,0x45);
            $scope.buffer.setByte(1,0x23);
            $scope.buffer.setByte(2,0x12);
            $scope.buffer.setByte(3,0x9);

            $scope.onSelect(0,3);
            $scope.buffer.setByte(0,0x0);
            $scope.buffer.setByte(1,0x0);
            $scope.buffer.setByte(2,0x0);
            $scope.buffer.setByte(3,0x0);

            var val = $scope.inspector.bvalue;
            $scope.encodeBValue(val.toString());
            expect($scope.buffer.getByte(0)).toBe(0x45);
            expect($scope.buffer.getByte(1)).toBe(0x23);
            expect($scope.buffer.getByte(2)).toBe(0x12);
            expect($scope.buffer.getByte(3)).toBe(0x9);
            done();

        },1000);
    })

    it ('testing encodeValueInv', function (done) {
        setTimeout(function() {
            $scope.buffer.setByte(0,0x45);
            $scope.buffer.setByte(1,0x23);
            $scope.buffer.setByte(2,0x12);
            $scope.buffer.setByte(3,0x9);

            $scope.onSelect(0,3);

            $scope.buffer.setByte(0,0x0);
            $scope.buffer.setByte(1,0x0);
            $scope.buffer.setByte(2,0x0);
            $scope.buffer.setByte(3,0x0);

            var val = $scope.inspector.vinv;
            $scope.encodeVinv(val.toString());
            expect($scope.buffer.getByte(0)).toBe(0x45);
            expect($scope.buffer.getByte(1)).toBe(0x23);
            expect($scope.buffer.getByte(2)).toBe(0x12);
            expect($scope.buffer.getByte(3)).toBe(0x9);
            done();

        },1000);
    })
    it ('testing encodeBValueInv', function (done) {
        setTimeout(function() {
            $scope.buffer.setByte(0,0x45);
            $scope.buffer.setByte(1,0x23);
            $scope.buffer.setByte(2,0x12);
            $scope.buffer.setByte(3,0x9);

            $scope.onSelect(0,3);
            $scope.buffer.setByte(0,0x0);
            $scope.buffer.setByte(1,0x0);
            $scope.buffer.setByte(2,0x0);
            $scope.buffer.setByte(3,0x0);

            var val = $scope.inspector.bvinv;
            $scope.encodeBVinv(val.toString());
            expect($scope.buffer.getByte(0)).toBe(0x45);
            expect($scope.buffer.getByte(1)).toBe(0x23);
            expect($scope.buffer.getByte(2)).toBe(0x12);
            expect($scope.buffer.getByte(3)).toBe(0x9);
            done();

        },1000);
    })

})
