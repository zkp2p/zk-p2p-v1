BUILD_DIR=${1:-./circuit}

echo "****GENERATING PROOF USING RAPIDSNARK****"
start=`date +%s`
$RAPIDSNARK_PATH $BUILD_DIR/circuit.zkey $BUILD_DIR/witness.wtns $BUILD_DIR/proof.json $BUILD_DIR/public.json
end=`date +%s`
echo "DONE ($((end-start))s)"