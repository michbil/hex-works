'use strict';

//var formData = {}

var a = 1;
function padToTwo(number) {
    if (number.length<=2) { number = ("0"+number).slice(-2); }
    return number;
}
function get_style(attributes,variable) {

    var style = "font-family: Arial;"
    if (attributes.attr_color[variable]) {

        var colorR = attributes.attr_color[variable] & 0xFF;
        var colorG = (attributes.attr_color[variable] >> 8)&0xFF;
        var colorB = (attributes.attr_color[variable] >> 16)&0xFF;
        colorR= padToTwo(colorR.toString(16));
        colorG= padToTwo(colorG.toString(16));
        colorB= padToTwo(colorB.toString(16));

        style+= "color:#"+colorR+colorG+colorB+";";
    }
    if (attributes.attr_bold[variable]) {

        style+= "font-weight:bold;";
    }
    if (attributes.attr_alignment[variable]) {

        style+= "text-align:center;";
    }
    return style;
}

function apply_to_form(variables, values, attriubtes) {
    for (var i in variables) {
        var tag = "#var_"+variables[i];
        var tagname = $(tag).prop("tagName");
        if (tagname == "INPUT") {
            if($(tag).hasClass("adr_range")) {
                var tuple = values[variables[i]];
                $(tag).val(tuple.start.toString(16)+":"+tuple.end.toString(16));
            } else {
                $(tag).val(values[variables[i]]);
            }

        }
        if (tagname == "P") {
            $(tag).html(values[variables[i]]);
            $(tag).attr("style",get_style(attriubtes, variables[i]));
        }

    }
}
function extract_from_form(variables) {
    var values = {}
    for (var i in variables) {
        var tag = "#var_"+variables[i];
        var tagname = $(tag).prop("tagName");
        if (tagname == "INPUT") {
            if($(tag).hasClass("adr_range")) {
                console.log("Adr range detected");
                var m = $(tag).val().toLowerCase().match(/([0-9a-f]+):([0-9a-f]+)/);
                if (m) {
                    var range = {
                        start:parseInt(m[1],16),
                        end:parseInt(m[2],16)
                    }

                } else {
                    range = {}
                }

                values[ variables[i] ]= range;
            } else
            {
                values[ variables[i] ]=$(tag).val();
            }

        }
        if (tagname == "P") {
            values[ variables[i] ] = $(tag).html();
        }


    }
    return values;
}


if (typeof  showSource === "undefined") {
    window.showSource = function () {}
    window.extendwithdevelopment = function () {}
}

function rangeSel(obj) {
    rscope.waitSelection(obj);

}