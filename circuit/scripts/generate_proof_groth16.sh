# Calculate the witness
cd circuit
echo "Running Python script to generate inputs"
python3 generate_inputs.py

cd circuit_js
node generate_witness.js circuit.wasm ../input.json ../witness.wtns
# Create the proof
echo "Generating proof"
cd ../
../node_modules/.bin/snarkjs groth16 prove circuit_final.zkey witness.wtns proof.json public.json

# Remove intermediary files
rm witness.wtns
