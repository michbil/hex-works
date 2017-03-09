import app from './controllers.js'
import directives from './directives'
import hexview from './hexview'
import fromcontrols from './formcontrols'


window.emulate_calc = function () {
    $('.bodycont').css('height', '100%').css('height', '-=134px');

    $('.calc').css('width', '100%').css('width', '-=20px');
    $('.inspector').css('height', '100%').css('height', '-=20px');
    $('.tab-content').css('height', '100%').css('height', '-=20px');
    $('.hexdirective').css('height', '100%').css('height', '-=40px');

    $('.calclist').css('height', '100%').css('width', '-=135px');
    $('.calclist-backdrop').css('height', '100%').css('width', '-=135px');

    //$('.bodycont').css('height', '100%').css('height', '-=134px');
};
