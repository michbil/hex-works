/**
 * Created by mich.bil on 23.01.15.
 */

describe("testing utilities", function () {

    it('testing toHex', function () {
        expect(toHex(0x23, 4)).toBe('0023');
    })

    it('testing reverseByteString', function() {
        var s = "123456";
        expect(reverseByteString(s)).toBe("563412");

        try {
            reverseByteString("123");
            expect(0).toBe(1);
        } catch (a) {};
    });

    it('testing alignToLength', function() {
       expect(alignToLength("1234", 8)).toBe('00001234');
    });

    it ('testing hexInvert', function () {
        try { // check on invalid data
            hexInvert("123");
            expect(0).toBe(1);
        } catch (a) {};
        expect(hexInvert("AA55AA55")).toBe("55AA55AA");

    })

    it ('testing hexEncode', function () {
       expect(hexEncode(0x123456,3)).toBe("123456");
    });



})