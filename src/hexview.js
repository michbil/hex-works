/**
 * Created by mich.bil on 21.01.15.
 */

import keys from './keys.js'
import Hammer from 'hammerjs'
import {toHex,toChar,alignToLength,hexInvert,reverseByteString,stringToByteSeq} from './utils.js'


var is_Mac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

angular.module('hex').directive('hexView', function () {
    'use strict';
    var cols = 16;
    var rows = 16;
    var scope = 0;

    //var cellSizeX = 22;
    var cellSizeY = 18;
    var font_width = 0;

    var coloffset = 80;
    var binoffset = 0;

    var offsetX = 0;
    var offsetY = 0
    var scrollbarX = 680;

    var scrollbarpar;
    var offscreen_canvas;
    var offscreen_context;
    var offscreen_height = 0;
    var offscreen_width = 0;
    var offscreen_ready = false;
    var resized=1;

    var focused = false;

    var use_spaces = 1;


    var cellcontent = Array.apply(null, new Array(rows  * cols)).map(Boolean.prototype.valueOf, true);
    var cellmarked = Array.apply(null, new Array(rows  * cols)).map(Boolean.prototype.valueOf, true);
    var cellcolor = Array.apply(null, new Array(rows  * cols)).map(Boolean.prototype.valueOf, true);

    var rootElement=0
   // var template = "<div class='hexdirective' tabindex='1' style=\"position: relative;height: calc(100% - 40px);\"><div class='scrollbar'></div> <div style=\"height:20px;margin-left: 71px;\"> <div class=\"view view-offset\"><\/div><div class=\"view view-hex adr\"> <span>00<\/span> <span>01<\/span> <span>02<\/span> <span>03<\/span> <span>04<\/span> <span>05<\/span> <span>06<\/span> <span>07<\/span> <span>08<\/span> <span>09<\/span> <span>0A<\/span> <span>0B<\/span> <span>0C<\/span> <span>0D<\/span> <span>0E<\/span> <span>0F<\/span> <\/div><div class=\"view view-char adr\"> <span>0<\/span><span>1<\/span><span>2<\/span><span>3<\/span><span>4<\/span><span>5<\/span><span>6<\/span><span>7<\/span><span>8<\/span><span>9<\/span> <span>A<\/span><span>B<\/span><span>C<\/span><span>D<\/span><span>E<\/span><span>F<\/span> <\/div><\/div><div id=\"adresscolumn\" class=\"view view-offset\"> <\/div><div id=\"hexcolumn\" class=\"view view-hex\"> <\/div><div id=\"bincolumn\" class=\"view view-char\"> <\/div><\/div>"
    var template = "<div class='hexdirective' tabindex='0'><canvas id='myCanvas' width='640px' height='320px'></canvas><canvas id='cursorCanvas' width='640px' height='320px'></canvas></div>"
    var selection_started = -1,selStart=-1,selEnd=-1;


    var scrollbar,adresscolumn;
    var hexes;
    var bins;

    var canvas,ctx;
    var cursorcanvas,cursorctx;
    var text_mode = false;


    var prevstyle = -1;

    function fillChar(ctx,x,y,len,bg) {

        if (bg !== "#ffffff") {
            if (bg != prevstyle) {
                ctx.fillStyle = bg;
            }
            prevstyle = bg;

            x = coloffset + font_width*x;
            y = cellSizeY*y;
            ctx.fillRect(x, y, font_width*len, -cellSizeY);
        }

    }
    function drawCursor(ctx,x,y) {



        ctx.fillStyle = "#449";

        x = coloffset + font_width*x;
        y = cellSizeY*y;
        ctx.fillRect(x, y, font_width, -cellSizeY);


    }

    function clearChar(ctx,x,y,len) {

        x = coloffset + font_width*x;
        y = cellSizeY*y;
        ctx.clearRect(x, y, font_width*len, cellSizeY);

    }

    function fillHex (ctx,x,y,style) {

        if (prevstyle == style.bg) {
            fillChar(ctx,  (x*(2+use_spaces))-1,   y+1  , 1, style.bg);
        }

        fillChar(ctx,  (x*(2+use_spaces)),   y+1  , 2, style.bg);

    }

    function fillBin (ctx,x,y,style) {

        fillChar(ctx,  ((2+use_spaces)*cols)+2+x,   y+1  , 1, style.bg);


    }

    var oldoffset = -1,oldlength = -1;
    var cursorx=-1, cursory=-1;
    function render_cursor (tmr) {

        if (hlx >= 0 ) {
            if ((scope.buffer.offset + hly*cols+hlx) !== scope.buffer.current) {
                var i = hlx;
                var j = hly;
                var rectx = (use_spaces+2)*i;
                var recty = j;
                clearChar(cursorctx,rectx, recty,2+use_spaces);
                clearChar(cursorctx,((2+use_spaces)*cols)+2+i,recty,1);
            };
        }

        if (cursorx >= 0 ) {
            var i = cursorx;
            var j = cursory;
            var rectx = (2+use_spaces)*i;
            var recty = j;
            clearChar(cursorctx,rectx, recty,2+use_spaces);
            clearChar(cursorctx,((2+use_spaces)*cols)+2+i,recty,1);
            if (tmr) return;
        }

        if (!focused) return;

        var adr = scope.buffer.current - scope.buffer.offset;
        if((adr >= 0) && (adr < (rows*cols))) {
            var j = Math.floor(adr / cols);
            var i = adr % cols;
            var style = {
                fg: "#555",
                bg: "#000"

            }
            var val = scope.buffer.getByte(adr+scope.buffer.offset);
            if (text_mode) {
                drawCursor(cursorctx,  ((2+use_spaces)*cols)+2+i,   j+1);
            } else {
                drawCursor(cursorctx,  i*(2+use_spaces)+scope.buffer.nibble,            j+1);
            }


            cursorx = i;
            cursory = j;
        }
    }
    var blink_tmr=0;
    function blink_cursor() {
        blink_tmr = !blink_tmr;
        render_cursor(blink_tmr);
    }


    var hlx=-1,hly=-1;
    function render_hightlight (elm) {

        if (elm == scope.buffer.current) {
            render_cursor();
        } else {

            if (hlx >= 0 ) {
                if ((scope.buffer.offset + hly*cols+hlx) !== scope.buffer.current) {
                    var i = hlx;
                    var j = hly;
                    var rectx = (2+use_spaces)*i;
                    var recty = j;
                    clearChar(cursorctx,rectx, recty,2+use_spaces);
                    clearChar(cursorctx,((2+use_spaces)*cols)+2+i,recty,1);
                };
            }

            var adr = elm - scope.buffer.offset;
            if((adr >= 0) && (adr < (scope.buffer.length()))) {
                var j = Math.floor(adr / cols);
                var i = adr % cols;
                var style = {
                    fg: "#999",
                    bg: "rgba(128,128,128,0.5);"

                }
                prevstyle = -1;
                var val = scope.buffer.getByte(adr+scope.buffer.offset);
                fillChar(cursorctx,  i*(2+use_spaces),   j+1, 2, style.bg);
                fillChar(cursorctx,  ((2+use_spaces)*cols)+2+i,     j+1, 1, style.bg);
                hlx = i;
                hly = j;
            }


        }

    }



    function setCurrent (event,index,dir) {

        if (event.button === 2) return;

        if (dir=="down") {
            selection_started = index;
            scope.buffer.current = index;

            var colorbuffer = scope.masterExists();
            if (colorbuffer === undefined) {
                colorbuffer = scope.buffer;
            }

            var reg = colorbuffer.getColoredRegion(index);
            if (reg) {
                //console.log(reg.start,reg.end)
                scope.decodeByteStream(reg.start,reg.end);
            }
            scope.$apply();
            render_cursor();
        } else {
            // mouse up
            if (selection_started >= 0) {
                if (selection_started != index) {
                    console.log ("selection",selection_started,index)
                    scope.buffer.selectRange(selection_started,index)
                    selStart = selection_started;
                    selEnd = index;
                    scope.onSelect(selection_started,index);
                    selection_started=-1;
                } else {
                    selection_started=-1;
                    selStart=-1;
                    selEnd=-1;
                    scope.buffer.selectRange(-1,-1);
                    scope.deSelect();
                }
            }
            render();
        }


    };

    function mouseHover (element) {
        //console.log("Hover", element)
        if (selection_started >=0) {
            scope.buffer.selectRange(selection_started,element)
            selStart = selection_started;
            selEnd = element;
            render();

        } else {
            render_hightlight(element);

        }


    }

    var colormap = {
        0: "#ffffff",
        1 : "#E57373",
        2 : "#80CBC4",
        3 : "#FFEB3B",
        4 : "#64B5F6",
        5 : "#B39DDB",
        6 : "#A1887F",
        7 : "#9E9E9E",
        8 : "lightblue"
    }

    function getMakred(i) {
        if (scope.buffer.marked) {
            return scope.buffer.marked[i];
        } else {
            return false;
        }


    }

    function getBg(index) {

        var colorbuffer = scope.masterExists();

        var red = "#F44336";
        var bg = colormap[0];

        if (colorbuffer === undefined) {
            colorbuffer = scope.buffer;
        }

        var colorcode = colorbuffer.colors[index];

        if (colorcode !== undefined) {
            bg=colormap[colorcode];
            if (bg === undefined) {
                bg = colormap[0];
            }
        }

        if (scope.buffer.isSelected(index)){

            bg = "#999";

        }

        return bg

    }


    function getStyle(index) {

        var colorbuffer = scope.masterExists();

        var red = "#F44336";
        var bg = colormap[0];
        var fg = "#000";

        if (colorbuffer === undefined) {
            colorbuffer = scope.buffer;
        }

        var colorcode = colorbuffer.colors[index];
        //var style=""

        if (colorcode !== undefined) {
            bg=colormap[colorcode];
            if (bg === undefined) {
                bg = colormap[0];
            }

        }

        var marked = scope.buffer.marked[index];
        if (marked) {
            fg = red;
        }
        if (scope.buffer.isSelected(index)){

            bg = "#999";

        }

        return {
            fg:fg,
            bg:bg
        };


    }

    function fontloadcallback () {
        resized = true;
        renderDOM(scope);
    }

    var waittext = "."
    function renderDOM(scope) {


        if (typeof window.font_loaded_ok == "undefined") {
            console.log("Waiting for font ...");
            ctx.fillStyle = "555";
            ctx.clearRect(0,0,300,30);
            ctx.fillText(waittext,0,30);waittext += ".";
            window.font_load_callback = fontloadcallback;

            return;
        }

        var start = new Date().getTime();

        if (scope.buffer['uninit'] === true) return;

        var buflen = scope.buffer.length();
        var leng = Math.min(rows * cols, buflen - scope.buffer.offset);
        var data = scope.buffer.buffer.subarray(scope.buffer.offset, scope.buffer.offset + leng);

        rows = Math.floor(ctx.canvas.height / cellSizeY);

        if (scope.buffer.offset < 0) {
            scope.buffer.offset = 0;
        }

        if (resized) {
            ctx.canvas.width = rootElement.innerWidth();
            ctx.canvas.height = cellSizeY * Math.floor(rootElement.innerHeight()/cellSizeY);
            offscreen_context.canvas.width = ctx.canvas.width;
            offscreen_context.canvas.height = ctx.canvas.height;
            cursorctx.canvas.width = ctx.canvas.width;
            cursorctx.canvas.height = ctx.canvas.height;

            offscreen_context.font = "15px Source Code Pro";
            cursorctx.font = "15px Source Code Pro";
            ctx.font = "15px Source Code Pro";
            ctx.textBaseline = "bottom";
            cursorctx.textBaseline= "bottom";
            cursorctx.globalAlpha = 0.5;

            cellmarked = [];
            cellcolor = [];
            cellcontent = []

            oldoffset =  -1;

            resized=0;
        }


        function render_chunk(ctx,screeenStart, screenEnd, dumpadr) {

           // console.log("offscreen");
            //ctx.fillStyle = "rgba(255, 255, 255, 1.0)";
            //ctx.clearRect(0, screeenStart*cellSizeY, ctx.canvas.width, screenEnd*cellSizeY+10);



            var yOffset = screeenStart*(cellSizeY +1);
            var count = screenEnd - screeenStart;


            var redlines = [], blacklines = [];

            function lineDirty(j) {
                var dirty = false;
                for (var i=0;i<cols;i++) {
                    var adr = j * cols + i;

                    if ((dumpadr + adr) >= (scope.buffer.length())) {
                        return dirty;
                    }
                    var byte = scope.buffer.getByte(dumpadr + adr);

                    if (cellcontent[adr] !== byte) return true;
                    if (cellcolor[adr] !== getBg(adr+dumpadr)) return true;
                    if (cellmarked[adr] !== getMakred(adr+dumpadr)) return true;

                }
            }

            function prepareLine(j) {
                var hexline = "";  var binline = "";
                var hexred = "";  var binred = "" ;
                var red=0;

                for (var i=0;i<cols;i++) {
                    var adr = j*cols+i;

                    if ((dumpadr+adr) >= (scope.buffer.length())) {
                        for (var z=0;z<(cols-i)*(2+use_spaces);z++) hexline += " ";
                        break;
                    }

                    var byte = scope.buffer.getByte(dumpadr + adr);
                    var style = getStyle(dumpadr + adr);

                    cellcontent[adr] = byte;
                    cellcolor[adr] = getBg(adr+dumpadr);
                    cellmarked[adr] = getMakred(adr+dumpadr);

                    if (style.fg == "#F44336") {
                        hexline += "  ";  if (use_spaces) hexline += " ";
                        binline += " ";
                        red = 1;
                        hexred += toHex(byte,2);
                        if (use_spaces) hexred += " ";
                        binred += toChar(byte);

                    } else {
                        hexline += toHex(byte,2);
                        if (use_spaces) hexline += " ";
                        binline += toChar(byte);
                        hexred += "  ";if (use_spaces) hexred += " ";
                        binred += " ";

                    }
                    if (style.bg !== "#ffffff") {
                        fillHex(ctx,  i, j, style);
                        fillBin(ctx,  i, j, style);

                    }

                }

                var delimit = "  "
                //if (use_spaces) delimit = " ";

                blacklines.push(hexline+delimit+binline);

                if (red) {
                    redlines.push(hexred+"  "+binred);
                } else {
                    redlines.push("");
                }
                prevstyle = -1;

            }


            // draw adress


            for (var j=0;j<count;j++) {
                if (lineDirty(j)) {
                    ctx.clearRect(0, j*cellSizeY, ctx.canvas.width, cellSizeY);
                    prepareLine(j);
                   // console.log("D "+j);

                } else {
                    blacklines.push("");
                    redlines.push("");// push dummys
                }


            }

            ctx.fillStyle = "#00F";
            for (var i=0;i<count;i++) {
                if ((dumpadr + i*cols) >= (scope.buffer.length())) break;
                if ((blacklines[i] !== "") || (redlines[i] !== "")) {

                    ctx.fillText(toHex(dumpadr + 0x10*i,7), offsetX, yOffset + cellSizeY*(i+1));
                }

            }
            // draw black text
            ctx.fillStyle = "#000000";
            for (var j=0;j<count;j++) {
                if (blacklines[j] !== "" ) {
                    ctx.fillText(blacklines[j], coloffset ,  yOffset +cellSizeY*(j+1));
                }

            }
            // drwaw red text
            ctx.fillStyle = "#F44336";
            for (var j=0;j<count;j++) {
                if (redlines[j] !== "") {
                    ctx.fillText(redlines[j], coloffset, yOffset + cellSizeY * (j + 1));
                }
            }


        }

//        function render_offscreen(ctx) {

        if (scope.buffer.length() != oldlength) {
            cellmarked = [];
            cellcolor = [];
            cellcontent = []
            
            offscreen_context.clearRect(0,0,offscreen_canvas.width,offscreen_canvas.height);
            ctx.clearRect(0,0,offscreen_canvas.width,offscreen_canvas.height);

        }
        oldlength = scope.buffer.length();

        if (scope.buffer.offset != oldoffset) {
            if (oldoffset != -1) {
                var delta = scope.buffer.offset - oldoffset;
               // console.log("DELT=",delta);
                var shift = Math.round(delta/cols)*cellSizeY;

                if (Math.abs(delta) >= rows*cols) {
                    // if delta too large, simply redraw all the screen
                    console.log("total redraw")
                    cellmarked = [];
                    cellcolor = [];
                    cellcontent = []
                    offscreen_context.clearRect(0,0,offscreen_canvas.width,offscreen_canvas.height);
                    ctx.clearRect(0,0,offscreen_canvas.width,offscreen_canvas.height);
                } else {
                    if (delta > 0) {
                        cellmarked = cellmarked.slice(delta,cellmarked.lenth);
                        cellcolor = cellcolor.slice(delta,cellcolor.lenth);
                        cellcontent = cellcontent.slice(delta,cellcontent.lenth);
                    }
                    if (delta < 0) {
                        var dummy = [];
                        delta = -delta;
                        // add some empty elements
                        for (var i =0;i<delta;i++) dummy.push(0);
                        cellmarked = dummy.concat(cellmarked.slice(0,-delta));
                        cellcolor =  dummy.concat(cellcolor.slice(0,-delta));
                        cellcontent = dummy.concat(cellcontent.slice(0,-delta));


                    }
                    offscreen_context.clearRect(0,0,offscreen_canvas.width,offscreen_canvas.height);
                    offscreen_context.drawImage(ctx.canvas, 0, 0);
                    ctx.clearRect(0,0,offscreen_canvas.width,offscreen_canvas.height);
                    ctx.drawImage(offscreen_canvas, 0, -shift);

                }



            }

        }


        render_chunk(ctx, 0, rows, scope.buffer.offset);
        oldoffset = scope.buffer.offset;


        render_cursor();

        var scollbarParams = updateScrollBar(cols);
        if (scollbarParams) {
            cursorctx.fillStyle = "#aaa";
            cursorctx.clearRect(scrollbarX,0,10,cursorcanvas.height);
            cursorctx.fillRect (scrollbarX,scollbarParams.top,10,scollbarParams.height);
        }


       var end = new Date().getTime();
       var time = end - start;
      // console.log('Execution time: ' + time);

    }


    function render () {
        if (scope.render==0) {
            scope.render++;
            scope.resized = 1;
        }
        renderDOM(scope,rootElement)
    }

    // handle meaning keys
    function keypress(key) {

        var digit = -1;
        var d = 0;

        if (text_mode) {
            var code = key.keyCode ? key.keyCode : key.charCode;

            if((code > 31) && (code <  127))
            {
                scope.buffer.setByte(scope.buffer.current, code);d++;
            }

        } else {
            if (key.which >= 0x30 && key.which <= 0x39) {
                digit = key.which - 0x30;
            }
            if (key.which >= 65 && key.which <= 70) {
                digit = key.which - 65 + 10;
            }
            if (key.which >= 97 && key.which <= 102) {
                digit = key.which - 97 + 10;
            }
            if (digit >= 0) {
                var val = scope.buffer.getByte(scope.buffer.current) & 0xFF;
                if (scope.buffer.nibble == 0) {
                    scope.buffer.nibble = 1;
                    val &= 0xF;
                    val |= digit << 4;
                    scope.buffer.setByte(scope.buffer.current, val);
                } else {
                    scope.buffer.nibble = 0;
                    val &= 0xF0;
                    val |= digit;
                    scope.buffer.setByte(scope.buffer.current, val);
                    d++;
                }
            }
        }
        handle_d(d);

    }

    // handle arrows etc
    function keylisten(key) {

        var d = 0;
        switch (key.which) {
            case keys.PAGEDN: // pagedn
                d =cols * rows;
                break;
            case keys.PAGEUP: // pageup
                d = -cols * rows;
                break;
            case keys.UP:
                d = -cols;
                break;

            case keys.LEFT:
                scope.buffer.nibble--;
                if (scope.buffer.nibble < 0) {
                    scope.buffer.nibble = 1;
                    d--;
                }
                break;
            case keys.RIGHT:
               scope.buffer.nibble++;
                if (scope.buffer.nibble > 1) {
                    scope.buffer.nibble = 0;
                    d++;
                }

                break;

            case keys.DOWN:
                d = cols;
                break;
            case 86:
                if (key.ctrlKey || key.metaKey) {

                    console.log("CTRLV");

                    $("textarea").focus();


                }
                break;
            case 67:
                if (key.ctrlKey || key.metaKey) {

                    console.log("CTRL-C");
                    $('#clipboard_modal').modal();

                }
                break;
            default:
        }


        if (key.ctrlKey || key.metaKey) return;
        handle_d(d);

    }

    function handle_d(d) {
        scope.buffer.current += d;
        if (scope.buffer.current < 0) scope.buffer.current = 0;
        if (scope.buffer.current >= scope.buffer.length()) scope.buffer.current = scope.buffer.length() - 1;

        var screenmax = scope.buffer.offset + rows * cols - 1;

        if (scope.buffer.current > screenmax) {
            scope.buffer.offset = getMaxOffset(scope.buffer.current)
        }
        if (scope.buffer.current < scope.buffer.offset) {
            scope.buffer.offset = cols * Math.floor(scope.buffer.current / cols);
        }
        render();
        scope.$apply();

    }

    function resize (element) {
        console.log("resize")
        var ht = element.height();
        rows = Math.round(ht / 20) - 1;
        if (rows <= 0) {
            rows = 16; // fallback value
        }

    }

    /// scrollbar related stuff

    function getMaxOffset (adress) {
        var v = Math.floor(adress / cols) * cols - cols * (rows - 1);
        if (v<0) {
            return 0;
        }
        //console.log("OFFSET = ", v.toString(16));
        return v;
    }

    function reverseScrollCompute (y) {

        var clientHeight = ctx.canvas.height;
        var scrollmax = getMaxOffset(scope.buffer.length()-1)
        var scrollBarHeight = scrollbarpar.height;

        var pos = y;

        if ((pos+scrollBarHeight) > clientHeight) {
            pos = clientHeight - scrollBarHeight;
        }

        var offset = pos / (clientHeight-scrollBarHeight);
        offset = Math.round(scrollmax*offset/cols)*cols;
        if (offset < 0) offset = 0;

        return offset;
    }

    function updateScrollBar (cols) {

        if (scope.buffer['uninit'] === true) {

            console.log("buffer is not ready, doing nothing");
            return;
        }

        var len = scope.buffer.length();
        var clientHeight = rootElement.height();

        if (len > (rows*cols)) {

            var scrollmax = getMaxOffset(scope.buffer.length())
            var scrollBarHeight = clientHeight*(rows * cols)/len;
            if (scrollBarHeight < 100) scrollBarHeight=100;
            //scrollbar.height(scrollBarHeight);

            var scrollBarPosition = (clientHeight-scrollBarHeight)*scope.buffer.offset / scrollmax;

            scrollbarpar = {
                top: Math.floor(scrollBarPosition),
                height: scrollBarHeight
            }
            scope.buffer.offset = Math.round(scope.buffer.offset/cols)*cols;


            if (scope.buffer.offset<0) scope.buffer.offset=0;
            if (scope.buffer.offset > scrollmax) {
                scope.buffer.offset = scrollmax;
            }

            if (scope.buffer.offset < 0) {  // prevent hard faults
                scope.buffer.offset = 0;
            }

            return scrollbarpar;

        } else {

           return undefined;

        }
    }

    var scrollOffset=-1;
    var scrollbar_grip = false;

    function processGlobalMouseMove(e) {
        if (scrollbar_grip) {
//            var x = e.pageX - rootElement.offset().left;
            var y = e.pageY - rootElement.offset().top;

            var offset = reverseScrollCompute(y+scrollOffset);
            scope.buffer.offset = Math.round(offset);
            renderDOM(scope,rootElement);
            return false;

        }
    }

    function processPointer(e,evt) {
        var x = e.pageX - rootElement.offset().left;
        var y = e.pageY - rootElement.offset().top;

        //console.log(x,y);

        var ly = Math.floor((y-4)/cellSizeY);


        if (scrollbar_grip) {

            if (evt === "up") {
                scrollbar_grip = false;
            }
            return undefined;

        }


        if (x < coloffset) return undefined;
        if ((x >= coloffset) && (x<(font_width*(2+use_spaces)*cols + coloffset))) {
            if (evt === "down") text_mode = false;
            var lx = Math.floor((x-coloffset)/(font_width*(2+use_spaces)));
            var nibble = Math.floor((x - coloffset - lx*font_width*(2+use_spaces))/font_width);
            if (nibble >=2) nibble = 1;
            if ((nibble < 2) && (evt == "down")) scope.buffer.nibble = nibble;
            //console.log(nibble);
//            console.log('hex',lx,ly);
            var rv = scope.buffer.offset + ly * cols + lx;
            return rv;

        }

        if ((x >= binoffset) && (x<(font_width*cols + binoffset))) {
            if (evt === "down") text_mode = true;
            var lx = Math.floor((x-binoffset)/(font_width));
            rv =  scope.buffer.offset + ly * cols + lx;
            return rv;
        }
        if (x > (scrollbarX-5)) {
//            console.log('scroll');

            if (evt === "down") {
                if ((y > scrollbarpar.top) && (y < (scrollbarpar.top+scrollbarpar.height))) {
                    scrollbar_grip = true;
                    scrollOffset = scrollbarpar.top - y;
                } else {
                    scrollOffset = scrollbarpar.top - y;
                    var offset = reverseScrollCompute(y+scrollOffset);
                    scope.buffer.offset = Math.round(offset)
                    renderDOM(scope,rootElement);
                }
            }


        }



        return undefined;
    }



    return {
        template: template,
        //templateUrl: 'templates/rus.html',
        replace: true,
        transclude: false,
        restrict: 'E',

        link: function (scope_param, element, attrs) {

            $(element).focus();
            focused = true;

            $(element).on('focus',function () {
                console.log("focused");
                focused = true;
                render_cursor();
            });
            $(element).on('blur',function () {
                console.log("lost focus");
                focused = false;
                render_cursor();

            });

            var options = {
                preventDefault: true
            };
            var hammer = new Hammer(element[0],options);



            canvas = document.getElementById('myCanvas');
            ctx = canvas.getContext('2d');

            cursorcanvas = document.getElementById('cursorCanvas');
            cursorctx = cursorcanvas.getContext('2d');

            offscreen_canvas = document.createElement('canvas');
            offscreen_context = offscreen_canvas.getContext('2d');

            offscreen_context.font = "15px Source Code Pro";
            cursorctx.font = "15px Source Code Pro";
            ctx.font = "15px Source Code Pro";
            ctx.textBaseline = "bottom";
            cursorctx.textBaseline= "bottom";


            console.log(scope_param.$id);
            adresscolumn = element.find('#adresscolumn').get(0);
            hexes = element.find('#hexcolumn').get(0);
            bins = element.find('#bincolumn').get(0);
            scrollbar = $(".scrollbar");


            scope = scope_param;
            rootElement = element;
            console.log("creating hexView");
            console.log(element);


            scope.$watch("ready",function () {

                resize(element);
                renderDOM(scope,element);

            });

            scope.$watch("render",render);
            element.on('keydown',keylisten);
            element.on('keypress',keypress);


            function manageCSS() {
                var w = $(window).width();
                //console.log(w);
                if (w < 750) {
                    $('.tab-content').removeClass('well');
                } else {
                    $('.tab-content').addClass('well');
                }

                if (w < 700) {
                    use_spaces = 0;
                } else {
                    use_spaces = 1;
                }

                if (w < 575) {
                    cols = 8;
                } else {
                    cols = 16;
                }

                font_width = 9;//$('#MeasureFont').width();
                binoffset = coloffset + font_width * ((2+use_spaces) * cols + 2);
                scrollbarX = binoffset + (cols+1)*font_width;

            }

            $(window).resize(function () {
                resized = 1;
                window.emulate_calc();
//                resize(element);
                renderDOM(scope,element);
                manageCSS();
            });
            resized = 1;

            manageCSS();

            // mouse click listeneres

            $('textarea').css({
                position: "absolute",
                top: 0,
                left: 0,
                width: 1,
                height: 1,
                opacity: 0
            }).bind("paste", function (data) {
                data = data.originalEvent.clipboardData || $window.clipboardData;
                var text = data.getData('Text');
                console.log(text)
                scope.buffer.current+=scope.buffer.pasteSequence(text,scope.buffer.current);
                render();
                scope.$apply();
            });


            element.on('mouseup', function(e) {
                var index = processPointer(e,"up");
                if (typeof index !== "undefined") setCurrent(e,index,"up")


            });
            element.on('mousedown', function(e) {
                var index = processPointer(e,'down');
                if (typeof index !== "undefined") setCurrent(e,index,"down")


            });
            element.on('mousemove', function(e) {
              //  console.log("over");
                var index = processPointer(e,'move');
                if (typeof index !== "undefined") mouseHover(index)

            });
            element.on("mouseleave",function (e) {
                render_hightlight(-1);
            })

            $(window).on('mouseup',function () {
                scrollbar_grip = false;

            });

            $(window).on('mousemove',processGlobalMouseMove);


            // init scrollbar


            element.on('mousewheel', function(event) {

                //console.log(event.deltaX, event.deltaY, event.deltaFactor);
                scope.buffer.offset -= Math.round(event.deltaY*cols);
                if (scope.buffer.offset < 0) scope.buffer.offset=0;
                if (scope.buffer.offset > getMaxOffset(scope.buffer.length()-1)) {
                    scope.buffer.offset = getMaxOffset(scope.buffer.length()-1)
                }

                render();


            });

            hammer.get('swipe').set({ direction: Hammer.DIRECTION_VERTICAL, threshold:3,velocity:0.22});
            hammer.on('swipe',function (event) {

                var dy = Math.round(event.deltaY /cols);

                console.log(dy);
                scope.buffer.offset -= Math.round(dy*cols);
                if (scope.buffer.offset < 0) scope.buffer.offset=0;
                if (scope.buffer.offset > getMaxOffset(scope.buffer.length()-1)) {
                    scope.buffer.offset = getMaxOffset(scope.buffer.length()-1);
                }

                render();

            });

            setInterval(blink_cursor,500);

        }
    }
})