/**
 * Created by mich.bil on 14.01.15.
 */
describe("Testing binbuf object", function() {
    it('test, that initialization value of array is zeros!', function() {
       var buf = new BinBuf(1024);
        for (var i=0;i<1024;i++) {
            expect(buf.getByte(i)).toBe(0);
        }
        expect(buf.length()).toBe(1024);

    });

    it('test, that initialization from arraybuffer', function() {
        var buffer = new ArrayBuffer(1024);
        var dataView = new DataView(buffer);
        for (var i=0;i<1024;i++) {
            dataView.setInt8(i,i&0xFF);
        };

        var buf = new BinBuf(buffer);

        for (var i=0;i<1024;i++) {
            expect(buf.getByte(i)).toBe(i & 0xFF);
        }

    });


    it('testing name setting',function() {
        var testname = 'fdsfs';
        var buf = new BinBuf(16);
        buf.setName(testname);
        expect (buf.getName()).toBe(testname);
    })

    it ('testgin buffer writes', function () {
        var buf = new BinBuf(1024);
        for (var i=0;i<1024;i++) {
            var writable = i & 0xFF;
            buf.setByte(i,writable)
            expect(buf.getByte(i)).toBe(writable);

        }
        expect(buf.getByteHex(5)).toBe("05")
        expect(buf.getByteHex(0x72)).toBe("72")

    })
    it ('testing buffer marker setting',function () {
        var buf = new BinBuf(1024);
        for (var i=5;i<100;i++) {
            buf.setByte(i,55)
        }
        for (var i=0;i<5;i++) {
            expect(buf.marked[i]).toBe(0);
        }
        for (var i=5;i<100;i++) {
            expect(buf.marked[i]).toBe(1);
        }
        for (var i=100;i<1024;i++) {
            expect(buf.marked[i]).toBe(0);
        }

    })
    it ('testing compare_to_buffer',function () {
        var bufA = new BinBuf(1024);
        var bufB = new BinBuf(1024);
        for (var i=5;i<100;i++) {
            bufA.setByte(i,55)
        }

       bufA.compareToBuffer(bufB);
/*        for (var i=5;i<100;i++) {
            expect(bufA.marked[i]).toBe(0);
        }*/
        for (var i=0;i<5;i++) {
            expect(bufB.marked[i]).toBe(0);
        }
        for (var i=5;i<100;i++) {
            expect(bufB.marked[i]).toBe(1);
        }
        for (var i=100;i<1024;i++) {
            expect(bufB.marked[i]).toBe(0);
        }

    })
    it ('testing compare_to_buffer on non equal length buffers',function () {
        var bufA = new BinBuf(1024);
        var bufB = new BinBuf(512);
        for (var i=5;i<100;i++) {
            bufA.setByte(i,55)
        }

        bufA.compareToBuffer(bufB);
/*        for (var i=5;i<100;i++) {
            expect(bufA.marked[i]).toBe(0);
        }*/
        for (var i=0;i<5;i++) {
            expect(bufB.marked[i]).toBe(0);
        }
        for (var i=5;i<100;i++) {
            expect(bufB.marked[i]).toBe(1);
        }
        for (var i=100;i<512;i++) {
            expect(bufB.marked[i]).toBe(0);
        }

    })
    it ('testing colorized chunk detector',function () {
        var buf = new BinBuf(256);

        for (var i=5;i<45;i++) buf.colors[i]="4";
        expect(buf.getColoredRegion(8).start).toBe(5)
        expect(buf.getColoredRegion(8).end).toBe(44);
        expect(buf.getColoredRegion(0)).toBe(undefined);

    })

});