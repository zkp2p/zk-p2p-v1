PATH_TO_CIRCUIT=${1:-./circuit}                                         # First argument $1 is path to circuit zkey directory
CIRCUIT_NAME=${2:-circuit}
SNARKJS_PATH=${3:-$SNARKJS_PATH}


cd "$PATH_TO_CIRCUIT/"

echo "****EXPORTING VKEY****"
start=`date +%s`
$NODE_PATH $SNARKJS_PATH zkey export verificationkey "$CIRCUIT_NAME".zkey vkey.json -v
end=`date +%s`
echo "DONE ($((end-start))s)"