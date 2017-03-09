const evalJSContext
    = "var hex=$scope.inspector.value_hex; \n" +
    "var dec=$scope.inspector.value;\n" +
    "var dec_inv = $scope.inspector.vinv;\n" +
    "var hex_inv = $scope.inspector.value_hex_inv;\n" +
    "var rhex=$scope.inspector.bvalue_hex;" +
    "var rdec=$scope.inspector.bvalue;\n" +
    "var rdec_inv = $scope.inspector.bvinv;\n" +
    "var rhex_inv = $scope.inspector.bvalue_hex_inv;"+
    "var sel = allSelected.map(function(v) {\n" +
    "              return $scope.buffer.getByte(v)}\n" +
    ");\n";


export function compileScript(script) {
    const mod_script = script.replace(/@[a-zA-Z0-9]*/g, function (orig) {
        return "$scope.buffer.getByte(" + orig.substring(1) + ')';

    });
    const evalpat = "$scope.userscript = function() {\n"+ evalJSContext   + "return "+ mod_script +";\n}";
    return evalpat;
}