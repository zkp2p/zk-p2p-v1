#!/bin/bash
# This command generates a proving key for groth16
# There is an option to skip a phase2 contribution, which is unsafe but can be used for testing purposes
# For production, set SKIP_PHASE2_CONTRIBUTION to false

# Log to both console and file
exec &> >(tee -a test_log.out)

PATH_TO_CIRCUIT=${1:-./circuit}                                         # First argument $1 is path to circuit directory
CIRCUIT_NAME=${2:-circuit}                                             # Second argument $2 is circuit name
SKIP_PHASE2_CONTRIBUTION=${3:-true}                                 # Third argument $3 is true/false whether to skip phase 2 contribution. Setting to true is unsafe but can be for testing. Otherwise, set to false
RANDOM_ENTROPY=${4:-"some random text for entropy"}                    # Fourth argument $4 is random entropy
PHASE1=$HOME/ptau_files/powersOfTau28_hez_final_${5:-23}.ptau     # Fourth argument $5 is ptau file number 
SKIP_ZKEY_VERIFICATION=${6:-true}                                   # Fifth argument $6 is true/false whether to skip zkey verification
echo $PWD

# if [ ! $# -eq 5 ]; # Check if there are 5 arguments
# then
#     echo "Wrong number of arguments"
#     exit 1
# fi
if [ -f "$PHASE1" ]; then
    echo "Found Phase 1 ptau file"
else
    echo "No Phase 1 ptau file found. Exiting..."
    exit 1
fi

# Back in build directory
cd "$PATH_TO_CIRCUIT/"
# $SNARKJS_PATH wej witness.wtns witness.json

if $SKIP_PHASE2_CONTRIBUTION; then
    echo "****GENERATING ZKEY 0****"
    start=`date +%s`
    $NODE_PATH --trace-gc --trace-gc-ignore-scavenger --max-old-space-size=2048000 --initial-old-space-size=2048000 --no-global-gc-scheduling --no-incremental-marking --max-semi-space-size=1024 --initial-heap-size=2048000 --expose-gc $SNARKJS_PATH zkey new "$CIRCUIT_NAME".r1cs "$PHASE1" "$CIRCUIT_NAME".zkey -v
    end=`date +%s`
    echo "DONE ($((end-start))s)"
else
    echo "****GENERATING ZKEY 0****"
    start=`date +%s`
    $NODE_PATH --trace-gc --trace-gc-ignore-scavenger --max-old-space-size=2048000 --initial-old-space-size=2048000 --no-global-gc-scheduling --no-incremental-marking --max-semi-space-size=1024 --initial-heap-size=2048000 --expose-gc $SNARKJS_PATH zkey new "$CIRCUIT_NAME".r1cs "$PHASE1" "$CIRCUIT_NAME"_0.zkey -v
    end=`date +%s`
    echo "DONE ($((end-start))s)"

    echo "****CONTRIBUTE TO PHASE 2 CEREMONY****"
    start=`date +%s`
    $NODE_PATH $SNARKJS_PATH zkey contribute -verbose "$CIRCUIT_NAME"_0.zkey "$CIRCUIT_NAME".zkey -n="First phase2 contribution" -e="$RANDOM_ENTROPY"
    end=`date +%s`
    echo "DONE ($((end-start))s)"
fi

if ! $SKIP_ZKEY_VERIFICATION; then
    echo "****VERIFYING FINAL ZKEY****"
    start=`date +%s`
    $NODE_PATH --trace-gc --trace-gc-ignore-scavenger --max-old-space-size=2048000 --initial-old-space-size=2048000 --no-global-gc-scheduling --no-incremental-marking --max-semi-space-size=1024 --initial-heap-size=2048000 --expose-gc $SNARKJS_PATH zkey verify -verbose "$CIRCUIT_NAME".r1cs "$PHASE1" "$CIRCUIT_NAME".zkey
    end=`date +%s`
    echo "DONE ($((end-start))s)"
fi

echo "****EXPORTING VKEY****"
start=`date +%s`
$NODE_PATH $SNARKJS_PATH zkey export verificationkey "$CIRCUIT_NAME".zkey vkey.json -v
end=`date +%s`
echo "DONE ($((end-start))s)"