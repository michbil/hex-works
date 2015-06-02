angular.module('hex').directive('file', function() {

    return {
        template: '<input style="display: none" type="file" multiple/>',
        transclude: false,
        replace: true,
        restrict: 'E',
        link: function(scope, element) {

            element.bind('change', function() {
                //console.log(this.files);
                for (var f in this.files) {
                    scope.loadFromFile( this.files[f] );
                }


            });

        }
    };

});

/*

// handle clipboard stuff
angular.module('hex').directive('clipboardListener', function () {
    return {

        template: '',
        replace: false,
        transclude: false,
        restrict: 'A',
        scope: false,
        link: function (scope, element, attrs) {
            element.css({
                position: "absolute",
                top: 0,
                left: 0,
                width: 1,
                height: 1,
                opacity: 0
            }).bind("paste", function (data) {
                data = data.originalEvent.clipboardData || $window.clipboardData;
                var text = data.getData('Text')
                console.log(text)
                scope.current+=scope.buffer.pasteSequence(text,scope.current)
                scope.render++;
                scope.$apply();
            }).focus();
        }
    }
})
    */