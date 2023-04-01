# Calculate the witness
cd circuit
echo "Running Python script to generate inputs"
python3 generate_inputs.py

cd circuit_js
node generate_witness.js circuit.wasm ../input.json ../witness.wtns
echo "Generating proof"
# Create the proof
cd ../
../node_modules/.bin/snarkjs plonk prove circuit_final.zkey witness.wtns proof.json public.json

# Remove intermediate files
rm witness.wtns
