import app from './controllers.js'
import directives from './directives'
import hexview from './hexview'
import fromcontrols from './formcontrols'


if (!(Modernizr.canvas && Modernizr.canvastext)) {
    alert("Your browser is outdated, update to Google Chrome, firefox");
}
if (!Modernizr.csscalc) {
    // alert("No css calc support");
    function emulate_calc() {
        $('.bodycont').css('height', '100%').css('height', '-=134px');

        $('.calc').css('width', '100%').css('width', '-=20px');
        $('.inspector').css('height', '100%').css('height', '-=20px');
        $('.tab-content').css('height', '100%').css('height', '-=20px');
        $('.hexdirective').css('height', '100%').css('height', '-=40px');

        $('.calclist').css('height', '100%').css('width', '-=135px');
        $('.calclist-backdrop').css('height', '100%').css('width', '-=135px');




        //$('.bodycont').css('height', '100%').css('height', '-=134px');
    }
} else {
    emulate_calc = function () {};

}

function rdyfont() {
    console.log("Font loaded");
    font_loaded_ok = true;
    if (font_load_callback) {
        font_load_callback();
    }
}
font_load_callback = false;
WebFont.load({
    google: {
        families: ['Source Code Pro:500']
    },
    active: rdyfont,
    inactive: function () {
        console.log("Cant load font....");
        setTimeout(rdyfont,1000);
    }
});
