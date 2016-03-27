import angular from 'angular'
import angular_route from 'angular-route'
import uibootstrap from 'angular-ui-bootstrap'
import BinBuf from './binbuf.js'
import {englocale,ruslocale} from './locale'
import keys from './keys.js'



var MainCtrl = function ($scope, $http, scripting,$sce,$location) { // $location
    'use strict';

    var allSelected = [];

    console.log("root");

    var path = $location.path();
    $scope.lang = "eng";
    $scope.locale = englocale;


    if (path === "/") {
        if (navigator.language === "ru") {
            path = "/rus";
        } else {
            path = "/eng";
        }
        $location.path(path);
    }

    if (path === "/rus") {
        $scope.lang = "rus";
    }  else {
        if (path === "/eng") {
            $scope.lang = "eng";
        }
    }


    $scope.forceLang = function (l) {
        $scope.lang = l;
        if (l == "eng") {
            $scope.locale = englocale;
        } else {
            $scope.locale = ruslocale;
        }
    }
    $scope.forceLang($scope.lang);



    $scope.render = 0;
    $scope.usescroll = 0;
    $scope.inspheader = "";
    $scope.ready = 0;
    $scope.busy = 1;

    $scope.tabs = [];
    $scope.activetab = -1;
    $scope.buffer = {"uninit": true};
    $scope.flags = {mastertab: true};
    $scope.mastertab = -1;

    $scope.calc_busy = false;
    $scope.calc_error = "";
    $scope.calc_form = "";
    $scope.calc_ready = false;

    $scope.dialogtitle = "";
    $scope.dialogdestination = "";
    $scope.scriptname = "";

    $scope.calculators = [];

    $scope.inspector = {
        value: "",
        vinv: "",
        value_hex: "",
        value_hex_inv: "",
        bvalue: "",
        bvinv: "",
        bvalue_hex: "",
        bvalue_hex_inv: "",
        sum: "",
        sumxor: "",
        sum16:"",
        sumxor16:"",

        script:"2+2",
        scriptresult: "",
        scriptingerror: true,

        value_error: false,
        vinv_error: false,
        value_hex_error: false,
        value_hex_inv_error: false,
        bvalue_error: false,
        bvinv_error: false,
        bvalue_hex_error: false,
        bvalue_hex_inv_error: false


    };

    $scope.calcname = "";
    window.rscope = $scope;
    $http.get("/calclist").success(function (r) {
        $(".css-treeview").html(r);


    }).error(function () {
        console.log("list loading failed");

    });


    $(document).ready(function () {

        $(function () {
            $("[rel='tooltip']").tooltip();

        });

        $scope.ready = 1;
        ZeroClipboard.config( { swfPath: "/lib/ZeroClipboard.swf" } );
        var client = new ZeroClipboard( $(".clip_button") );
        client.on( "copy", function (event) {
            var clipboard = event.clipboardData;
            var target  = $(event.target).attr("id");
            if (target == "navbar_copy") {
                clipboard.setData("text/plain", $scope.buffer.toString());
            } else {
                clipboard.setData("text/plain", $scope.buffer.getSelection());
                $("#clipboard_modal").modal('hide');
            }

        });


    });

    $scope.cmdPaste = function () {
        $("#clipboard_paste_modal").modal();
        $("#clipboard_paste_modal").click(function () {
            $("#clipboard_paste_modal").modal('hide');
        })
        setTimeout(function () {
            $("#clipboard_paste_modal").modal('hide');
        },2000);

    }

    $scope.searchText = function (text) {
        console.log(text);
    }

    $scope.openTab = function(data,name,norender) {

        var buffer = openFile(data,name);

        if (buffer) {

            var n = $scope.tabs.length;
            $scope.tabs.push(buffer)
            $scope.buffer = $scope.tabs[n];
            $scope.buffer.setName(name)
            $scope.activetab = n;

            $scope.$apply();

            //$scope.flags.mastertab = $scope.buffer.master;

            var tabname = '#hextab' + $scope.activetab;
            $(tabname).click(); // TODO eliminate this hack

            $scope.render++;

        }


    };

    $scope.changeTab = function (n) {

        $scope.buffer = $scope.tabs[n];
        $scope.activetab = n;

        var mstr = $scope.masterExists();
        if (mstr) {
            $scope.buffer.offset = mstr.offset;
        }

        $scope.render=0;

        var thistab = $scope.buffer.uuid;

        $scope.flags.mastertab = (thistab === $scope.mastertab);


    }

    $scope.changeMasterFlag = function () {

        if ($scope.flags.mastertab) {
            $scope.mastertab = $scope.buffer.uuid;

        } else {
            $scope.mastertab = -1;
        }
        $scope.render++;

    }

    $scope.masterExists = function () {
        if ($scope.mastertab !== -1) {
            for (var tab in $scope.tabs)  {
                if ($scope.tabs[tab].uuid === $scope.mastertab) {
                    return $scope.tabs[tab];
                }
            }
        }
        return undefined;

    }

    $scope.compareToTab = function (tab) {
        console.log("Comparing",tab)
        tab.compareToBuffer($scope.buffer);
        $scope.render++;

    }


    $scope.killTab = function (id) {
        console.log("Killing",id)
        localforage.removeItem($scope.tabs[id].uuid)

        if ($scope.tabs[id].uuid == $scope.mastertab) {
            $scope.mastertab = -1;
            var thistab = $scope.buffer.uuid;
            $scope.flags.mastertab = (thistab === $scope.mastertab);
        }

        $scope.tabs.splice(id,1);


        $scope.buffer = $scope.tabs[0];
        $scope.render++;



    };

    function openFile(data,name) { // open file to current tab

        if (typeof data === "undefined") {
            debugger;
            return;
        }

        var buffer = new BinBuf(0);
        var rv;
        console.log(typeof data);
        if (typeof data.data === "undefined") {
            rv = buffer.loadDataFromFile(data)
        } else {
            rv = buffer.loadDataFromLocalStorage(data)
        }

        if (rv) {
            if (name){
                buffer.setName(name);
            }
            return buffer;
        }

    }


    // called from file directive when file opened
    $scope.loadFromFile = function(file) {
        jBinary.loadData(file, function(err, data) {
            if (err) {
                console.log(err.message);

            } else {
                $scope.openTab(data,file.name);
            }


        });
    };

    // try to restore all tabs from localforage database
    // fail - where no file in local storage db
    $scope.loadFromLS = function (fail) {

        localforage.getItem('tabnames',function(err,val) {

            if (err) { // no tabnames record at all, fallback
                fail();
                return;
            }
            if (val) {
                var count = val.length;
                if (val) for (var i = 0; i < val.length; i++) {

                    localforage.getItem(val[i], function (err, data) {

                        console.log(err)
                        console.log(data)

                        if (data) {
                            $scope.openTab(data, data.name, 1); // open tab but no render

                        } else {
                            console.log("No data in storage")
                            fail();

                        }
                        count--;
                        if (count == 0) {
                            $scope.busy = 0;
                           // $scope.htmlReady();
                            $scope.render++;
                            $scope.$apply()

                        }
                    })

                } else {
                    fail();

                }
            } else fail();

        })


    };

    $scope.saveFile = function() {
        var blob = new Blob([$scope.buffer.buffer], {type: "application/octet-stream"});
        saveAs(blob, $scope.buffer.getName());
    }


    $scope.calculators  = {};
    $scope.loadFromLS(function () { // try to reload tabs from localstorage, if not
        var buf = new BinBuf(4096);    // create default buffer if there is no localstorage
        $scope.openTab(buf.saveToDict(),'unnamed');
        $scope.busy=0;
//        $scope.htmlReady();

    });

    function showSaved() {
        $(".saved").removeClass('hide-opacity');
        setTimeout(function () {
            $(".saved").addClass('hide-opacity');
        },1000);

    }

    // autosave for now
    setInterval(function() {
        var tabs = []

        if ($scope.tabs.length == 0) {
            return
        }
        var tabnames = []
        for (var tab in $scope.tabs) {
            tabnames.push($scope.tabs[tab].uuid)
            if ($scope.tabs[tab].changed) {
                console.log("autosave tab["+$scope.tabs[tab].uuid+"]");
                showSaved();
                localforage.setItem($scope.tabs[tab].uuid,$scope.tabs[tab].saveToDict()); //save in localstorage
            }
        }

        localforage.setItem('tabnames',tabnames);

        if (typeof $scope.saveSource !== "undefined") {
            if ($scope.saveSource()) {
                showSaved();
            };
        }

    },2000);


    /// selection stuff

    var selStart=-1;
    var selEnd=-1;
    var selCallback;

    function hasSelection() {

        if ((selStart === -1) && (selEnd === -1)) {
            return false;
        }
        return true;

    }



    $scope.waitSelection = function (obj) {
        function getSel() {
            $selector.val(selStart.toString(16)+":"+selEnd.toString(16));
            selCallback = undefined;
            $selector.removeClass("greenbgi");
        }
        var $selector = $(obj).parent().find('input');
        if (hasSelection()) {
            getSel();
        } else {
            selCallback = getSel;
            $selector.addClass("greenbgi");
        }

    };

    $scope.onSelect = function (start,end) {
        selStart = start;
        selEnd = end;
        $scope.decodeByteStream(start,end);
        $scope.$apply();
        if (typeof selCallback !== "undefined") selCallback();

    };

    $scope.deSelect = function () {
        selStart = -1;
        selEnd = -1;
        $scope.buffer.selectionStart = -1;
        $scope.buffer.selectionEnd = -1;
        //$scope.clearInspector();

    };

    $scope.selectAll = function () {
        var selStart=0;
        var selEnd=$scope.buffer.length()-1;
        this.buffer.selectRange(selStart,selEnd);
        $scope.decodeByteStream(selStart,selEnd);
        $scope.render++;

    }

    $scope.clearMarkers = function () {
        console.log("Clearing Markers");
        $scope.buffer.clearMarkers();
        $scope.render++;
    }
    $scope.swapBytes = function () {
        console.log("Swaping");
        $scope.buffer.swapBytes();
        $scope.render++;
    }

    var oldscriptname = "";
    var scriptVariables=[];

    $scope.calculate = function (index,update) {
        $scope.calcname = index;
        $('.calc_busy').show();

        if (oldscriptname === index) {
            var values = extract_from_form(scriptVariables);
            console.log("Sending variables to script");
        }


        scripting.evaluate(index,$scope.buffer.toBuffer(),values,function (resp) {

            if (resp.error) {
                if ($scope.processScriptError) {
                    $scope.processScriptError(resp)
                } else {
                    $scope.calc_error = "Error executing calculator";
                }

                $('#calc_form').html("");
                $scope.calc_ready = false;
                $('.calc_busy').hide();
                if (update) $scope.$apply();

                return;
            }

            scriptVariables = resp.variables;
            oldscriptname = index;

            $scope.calc_error = "";

            $('#calc_form').html(resp.form);
            $scope.calc_ready = true;
            apply_to_form(resp.variables, resp.values,
                {
                    attr_color: resp.attr_color,
                    attr_bold: resp.attr_bold,
                    attr_alignment: resp.attr_alignment
                });

            showSource(resp);



            $('#details').collapse();
            $('.calc_busy').hide();
            if (update) $scope.$apply();
        }, function () {

            $scope.calc_error = "Error while executing calculator";
            $scope.calc_ready = false;
            $('.calc_busy').hide();
            if (update) $scope.$apply();
        });
    }

    $scope.setCurrentCalculator = function(index,elm) {
       $scope.calculate(index,true);
       $scope.scriptname = ": "+$(elm).html()
       $scope.$apply();
       $('.calclist').toggle();$('.calclist-backdrop').toggle();


    };
    $scope.readScript = function () {
        $scope.calculate($scope.calcname);
    }
    $scope.writeScript = function () {
        var values = extract_from_form(scriptVariables);
        $('.calc_busy').show();
        scripting.apply_values($scope.calcname,$scope.buffer.toBuffer(),values,function ok(resp) {

            if (resp.error) {
                if ($scope.processScriptError) {
                    $scope.processScriptError(resp)
                } else {
                    $scope.calc_error = "Error executing calculator";
                }

                $('#calc_form').html("");
                $scope.calc_ready = false;
                $('.calc_busy').hide();
                //if (update) $scope.$apply();

                return;
            }
            apply_to_form(resp.variables, resp.values,
                {
                    attr_color: resp.attr_color,
                    attr_bold: resp.attr_bold,
                    attr_alignment: resp.attr_alignment
                });
            showSource(resp);
            $scope.buffer.fromBuffer(resp.buffer);
            $scope.render++;
            $('.calc_busy').hide();
            $scope.$apply();

        },function fail () {
            $scope.calc_error = "Error while executing calculator";
            $scope.calc_ready = false;
            $('.calc_busy').hide();
        })

    }


    extendwithdevelopment($scope,scripting);


    var timeout = null;



    $scope.markWithColor = function (color) {
        console.log(color)

        var colormap = {
            whitebg: 0,
            redbg : 1,
            greenbg : 2,
            yellowbg : 3,
            bluebg : 4,
            purplebg : 5,
            violetbg : 6,
            greybg : 7,
            sel : 8
        }

        color = colormap[color];
        if (color === undefined) color = 0;

        var buf = $scope.masterExists()
        if (buf === undefined) buf = $scope.buffer;

        if (selStart == selEnd) {
            buf.setColor($scope.buffer.current,color)
            $scope.buffer.current++;

        } else {
            if (selStart > selEnd) {
                var t = selStart;
                selStart = selEnd;
                selEnd=t;
            }
            for (var i=selStart;i<=selEnd;i++) {
               buf.setColor(i,color);
            }
        }
        $scope.deSelect();
        $scope.render++;
    }


    var inspStart = -1;
    var inspEnd = -1;

    function validateHexValue(value, len) {
        len = len*2;
        if (value.length > len) {
            return false;
        }
        return true;
    }
    function validateBinValue(value,len) {
        if (value > Math.pow(2,len*8)) {
            return false;
        }
        return true;
    }


    $scope.encodeValue = function (param) {
        console.log(param);
        $scope.inspector.value = param.replace(/[^\-0-9]/g,''); // string unwanted chars

        if (validateBinValue($scope.inspector.value,inspEnd-inspStart+1)) {
            $scope.inspector.value_error = false;
            var paster = hexEncode($scope.inspector.value,inspEnd-inspStart+1);
            $scope.buffer.pasteSequence(paster,inspStart);
            $scope.decodeByteStream(inspStart,inspEnd,'value');
            $scope.render++;
        } else {
            $scope.inspector.value_error = true;

        };
    }
    $scope.encodeBValue = function (param) {
        console.log(param);
        $scope.inspector.bvalue = param.replace(/[^\-0-9]/g,''); // string unwanted chars

        if (validateBinValue($scope.inspector.bvalue,inspEnd-inspStart+1)) {
            $scope.inspector.bvalue_error = false;
            var paster = hexEncode($scope.inspector.bvalue,inspEnd-inspStart+1);
            paster = reverseByteString(paster);
            $scope.buffer.pasteSequence(paster,inspStart);
            $scope.decodeByteStream(inspStart,inspEnd,'value');
            $scope.render++;
        } else {
            $scope.inspector.bvalue_error = true;

        };
    }

    $scope.encodeVinv = function (param) {
        console.log(param);
        $scope.inspector.vinv = param.replace(/[^\-0-9]/g,''); // string unwanted chars

        if (validateBinValue($scope.inspector.vinv,inspEnd-inspStart+1)) {
            $scope.inspector.vinv_error = false;
            var paster = hexEncode($scope.inspector.vinv,inspEnd-inspStart+1);
            paster = hexInvert(paster);
            $scope.buffer.pasteSequence(paster,inspStart);
            $scope.decodeByteStream(inspStart,inspEnd,'vinv');
            $scope.render++;
        } else {
            $scope.inspector.vinv_error = true;

        };
    }
    $scope.encodeBVinv = function (param) {
        console.log(param);
        $scope.inspector.bvinv = param.replace(/[^\-0-9]/g,''); // string unwanted chars

        if (validateBinValue($scope.inspector.bvinv,inspEnd-inspStart+1)) {
            $scope.inspector.bvinv_error = false;
            var paster = hexEncode($scope.inspector.bvinv,inspEnd-inspStart+1);
            paster = reverseByteString(paster);
            paster = hexInvert(paster);
            $scope.buffer.pasteSequence(paster,inspStart);
            $scope.decodeByteStream(inspStart,inspEnd,'bvinv');
            $scope.render++;
        } else {
            $scope.inspector.bvinv_error = true;

        };
    }

    $scope.encodeValueHex = function (param) {
        console.log(param);
        $scope.inspector.value_hex = param.replace(/[^0-9a-fA-F]/g,''); // string unwanted chars

        if (validateHexValue($scope.inspector.value_hex,inspEnd-inspStart+1)) {
            $scope.inspector.value_hex_error = false;
            var paster = alignToLength($scope.inspector.value_hex,(inspEnd-inspStart+1)*2);
            $scope.buffer.pasteSequence(paster,inspStart);
            $scope.decodeByteStream(inspStart,inspEnd,'value_hex');
            $scope.render++;
        } else {
            $scope.inspector.value_hex_error = true;

        };
    }

    $scope.encodeValueHexInv = function (param) {
        console.log(param);
        $scope.inspector.value_hex_inv = param.replace(/[^0-9a-fA-F]/g,''); // string unwanted chars

        if (validateHexValue($scope.inspector.value_hex_inv,inspEnd-inspStart+1)) {
            $scope.inspector.value_hex_inv_error = false;
            var paster = alignToLength($scope.inspector.value_hex_inv,(inspEnd-inspStart+1)*2);
            var paster = hexInvert(paster);
            $scope.buffer.pasteSequence(paster,inspStart);
            $scope.decodeByteStream(inspStart,inspEnd,'value_hex_inv');
            $scope.render++;
        } else {
            $scope.inspector.value_hex_inv_error = true;

        };
    }

    $scope.encodeBValueHex = function (param) {
        console.log(param);
        $scope.inspector.bvalue_hex = param.replace(/[^0-9a-fA-F]/g,''); // string unwanted chars

        if (validateHexValue($scope.inspector.bvalue_hex,inspEnd-inspStart+1)) {
            $scope.inspector.bvalue_hex_error = false;
            var paster = alignToLength($scope.inspector.bvalue_hex,(inspEnd-inspStart+1)*2);
            paster = reverseByteString(paster);
            $scope.buffer.pasteSequence(paster,inspStart);
            $scope.decodeByteStream(inspStart,inspEnd,'bvalue_hex');
            $scope.render++;
        } else {
            $scope.inspector.bvalue_hex_error = true;

        };

    }

    $scope.encodeBValueHexInv = function (param) {
        console.log(param);
        $scope.inspector.bvalue_hex_inv = param.replace(/[^0-9a-fA-F]/g,''); // string unwanted chars

        if (validateHexValue($scope.inspector.bvalue_hex_inv,inspEnd-inspStart+1)) {
            $scope.inspector.bvalue_hex_inv_error = false;
            var paster = alignToLength($scope.inspector.bvalue_hex_inv,(inspEnd-inspStart+1)*2);
            paster = reverseByteString(paster);
            var paster = hexInvert(paster);
            $scope.buffer.pasteSequence(paster,inspStart);
            $scope.decodeByteStream(inspStart,inspEnd,'bvalue_hex_inv');
            $scope.render++;
        } else {
            $scope.inspector.bvalue_hex_inv_error = true;

        };
    };



    $scope.decodeByteStream = function (start,end,except) {

        allSelected = [];
        for (var i = start; i <= end; i++) {
            allSelected.push(i)
        }

        inspStart = start;
        inspEnd = end;

        $scope.inspheader = "for (0x"+start.toString(16).toUpperCase()+' ... 0x'+end.toString(16).toUpperCase()+')';
        var v = 0,vinv=0;var vhx = "";var index=0;
        var vhx_inv = "";

        function parseValue() {
            v = 0;vinv=0;vhx = "";index=0;
            vhx_inv = "";
            for (var i in allSelected) {
                var item = $scope.buffer.getByte(allSelected[allSelected.length-i-1]);

                v += item << (i*8);
                vinv += (item ^ 0xFF) << (i*8);

                vhx += toHex($scope.buffer.getByte(allSelected[i]),2);
                vhx_inv += toHex($scope.buffer.getByte(allSelected[i])^0xFF,2);

            }
        }

        var sum=0,xorsum=0;
        var sum16=0;

        for (var i in allSelected) {
            var item = $scope.buffer.getByte(allSelected[i]);

            sum = item + sum;
            xorsum = item ^ xorsum;
            sum = sum & 0xFF;
            xorsum = xorsum & 0xFF

            sum16 = sum16+item;
            sum16 = sum16 & 0xFFFF;
        }
        $scope.inspector.sum = toHex(sum,2);
        $scope.inspector.sumxor =toHex(xorsum,2);
        $scope.inspector.sum16 = toHex(sum16,4);

        var vhx_rev="",vhx_inv_rev="";
        if (allSelected.length < 8) {
            parseValue();
            if (except !== "value_hex") $scope.inspector.value_hex = vhx;
            if (except !== "value_hex_inv") $scope.inspector.value_hex_inv = vhx_inv;
            if (except !== "value") $scope.inspector.value = v;
            if (except !== "vinv") $scope.inspector.vinv = vinv;

            allSelected = allSelected.reverse();

            parseValue();
            if (except !== "bvalue_hex") $scope.inspector.bvalue_hex = vhx;
            if (except !== "bvalue_hex_inv") $scope.inspector.bvalue_hex_inv = vhx_inv;
            if (except !== "bvalue") $scope.inspector.bvalue = v;
            if (except !== "bvinv") $scope.inspector.bvinv = vinv;
        } else {
            $scope.inspector.value_hex = $scope.inspector.value_hex_inv =  $scope.inspector.value =  $scope.inspector.vinv = $scope.inspector.bvalue_hex =   $scope.inspector.bvalue_hex_inv =   $scope.inspector.bvalue =  $scope.inspector.bvinv = ""
        }
        //$scope.$apply();
        allSelected = allSelected.reverse();
        $scope.inspector.value_hex_error = $scope.inspector.value_hex_inv_error =  $scope.inspector.value_error =  $scope.inspector.vinv_error = $scope.inspector.bvalue_hex_error =   $scope.inspector.bvalue_hex_inv_error =   $scope.inspector.bvalue_error =  $scope.inspector.bvinv_error = ""
        $scope.compileScript($scope.inspector.script);

    };

    $scope.clearInspector = function () {
        $scope.inspector.value_hex = $scope.inspector.value_hex_inv =  $scope.inspector.value =  $scope.inspector.vinv = $scope.inspector.bvalue_hex =   $scope.inspector.bvalue_hex_inv =   $scope.inspector.bvalue =  $scope.inspector.bvinv = ""
        $scope.inspector.value_hex_error = $scope.inspector.value_hex_inv_error =  $scope.inspector.value_error =  $scope.inspector.vinv_error = $scope.inspector.bvalue_hex_error =   $scope.inspector.bvalue_hex_inv_error =   $scope.inspector.bvalue_error =  $scope.inspector.bvinv_error = ""

        $scope.inspector.sum = "";
        $scope.inspector.sumxor ="";
        $scope.inspheader="";
        $scope.$apply();
    };

    $scope.compileScript = function (script) {
        console.log("Compiling script");
       // var buf = allSelected.map(function(v) {return $scope.buffer.getByte(v)});

        var varprep = "var hex=$scope.inspector.value_hex; var dec=$scope.inspector.value;var dec_inv = $scope.inspector.vinv;   var hex_inv = $scope.inspector.value_hex_inv;        var rhex=$scope.inspector.bvalue_hex;        var rdec=$scope.inspector.bvalue;        var rdec_inv = $scope.inspector.bvinv;        var rhex_inv = $scope.inspector.bvalue_hex_inv;"
        varprep += "var sel = allSelected.map(function(v) {return $scope.buffer.getByte(v)});\n"

        var evalpat = "$scope.userscript = function() {\n"+ varprep   + "return "+ script +";\n}";
        console.log(evalpat);
        try {
            eval(evalpat);
            $scope.inspector.scriptingerror = false;
        } catch(e) {
            $scope.inspector.scriptingerror = true;
        }


        $scope.runUserScript()
    };
    $scope.selectVar = function (v) {
        $scope.inspector.script = v;
        $scope.compileScript($scope.inspector.script);
    };

    $scope.runUserScript = function () {
        if (!$scope.inspector.scriptingerror) {
            var res = $scope.userscript();
            $scope.inspector.scriptresult = res;
        } else {
            $scope.inspector.scriptresult = "Error";
        }
    };



    var dlgcallback = function () {};
    $scope.dialog = {
        "value": "00"
    };

    $scope.dlgFinish = function () {
        dlgcallback();
        $("#xorModal").modal('hide');
        $scope.render++;
    };

    $scope.openDialog = function (title, destination, cb) {
        dlgcallback = cb;
        $scope.dialogtitle = title;
        $scope.dialogdestination = destination;
        $('#xorModal').modal();
    }

    $scope.xorDialog = function () {


        var seltext = hasSelection()?"with current selection":"with entire buffer";
        $scope.openDialog("XOR",seltext,function () {
            console.log("xoring..");
            var start,end;
            if (hasSelection()) {
                start = selStart;
                end = selEnd;
            } else {
                start = 0;
                end = $scope.buffer.length() - 1;
            }
            $scope.buffer.fillWithSequence(start,end,stringToByteSeq($scope.dialog.value),true);
        });

    };
    $scope.fillDialog = function () {

        var seltext = hasSelection()?"current selection":"entire buffer";
        var warning = hasSelection()?"":"Are you sure?";
        $scope.openDialog("Fill "+seltext+" with",warning,function () {
            console.log("Filling...");
            var start,end;
            if (hasSelection()) {
                start = selStart;
                end = selEnd;
            } else {
                start = 0;
                end = $scope.buffer.length() - 1;
            }
            $scope.buffer.fillWithSequence(start,end,stringToByteSeq($scope.dialog.value),false);

        });

    }




};

var app =  angular.module('hex', [uibootstrap,angular_route]); // ngRoute


app.config(function ($routeProvider,$locationProvider) {
    $locationProvider.html5Mode({
        enabled:true,
        rewriteLinks: false,
    });
    $routeProvider.when("/rus", {templateUrl:"/templates/rus.html"});
    $routeProvider.when("/eng", {templateUrl:"/templates/eng.html"});
});


app.controller('main', ['$scope','$http','scripting',"$sce","$location", MainCtrl]); // $location

app.service("scripting",['$http', function ($http) {
    'use strict';
}]);

export default app;