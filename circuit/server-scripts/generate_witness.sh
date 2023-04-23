BUILD_DIR=${1:-./circuit}
INPUT_JSON=${2:-./circuit/input.json}


echo "****GENERATING WITNESS FOR INPUT****"
start=`date +%s`
$NODE_PATH $BUILD_DIR/circuit_js/generate_witness.js $BUILD_DIR/circuit_js/circuit.wasm $INPUT_JSON $BUILD_DIR/witness.wtns
end=`date +%s`
echo "DONE ($((end-start))s)"

