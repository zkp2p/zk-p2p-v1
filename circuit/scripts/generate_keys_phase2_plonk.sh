# Verify the ptau file ($1 is path to the ptau file [Stored at ~/ptau_files])
# echo "Verifying the Ptau file"
# ./node_modules/.bin/snarkjs powersoftau verify $1 # Not a necessary step cause downloaded from official repos

cd circuit
# Setup (PLONK does not require a specific trusted cermony for each circuit); Create the verification key
echo "Creating circuit specific keys"
../node_modules/.bin/snarkjs plonk setup circuit.r1cs $1 circuit_final.zkey

# Export the verification key to JSON
../node_modules/.bin/snarkjs zkey export verificationkey circuit_final.zkey verification_key.json

### Output Files:
# circuit_final.zkey
# verification_key.json

### Remove intermediate files that have been used
rm circuit.r1cs
