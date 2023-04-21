cd circuit
# Compile the circuit
circom circuit.circom --wasm --r1cs --sym
# View information about the circuit
../node_modules/.bin/snarkjs r1cs info circuit.r1cs
# Export r1cs to json (To make it human redable)
# Skipped
# ./node_modules/.bin/snarkjs r1cs export json circuit.r1cs circuit.r1cs.json

### Output files
# circuit.r1cs
# circuit.sym
# circuit_js/
    # circuit.wasm
    # generate_witness.js
    # witness_calculator.js
