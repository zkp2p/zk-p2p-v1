# Verify the ptau file ($1 is path to the ptau file [Stored at ~/ptau_files])
# echo "Verifying the Ptau file"
# ../node_modules/.bin/snarkjs powersoftau verify $1 # Not a necessary step cause downloaded from official repos
cd circuit

# Are we missing a prepare command here?
# snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v

# Setup (GROTH16 does require a specific trusted cermony for each circuit); Create the verification key
echo "Creating circuit specific keys"
../node_modules/.bin/snarkjs groth16 setup circuit.r1cs $1 circuit_0000.zkey

# Contribute to the phase2 ceremony
# Just 1 contribution is enough
../node_modules/.bin/snarkjs zkey contribute circuit_0000.zkey circuit_0001.zkey --name="1st Contributor Name" -v -e="some random text"

# Verify the latest zkey
# Can skip this step
# snarkjs zkey verify circuit.r1cs $1 circuit_0001.zkey

# Apply a random beacon
# snarkjs zkey beacon <circuit_old.zkey> <circuit_new.zkey> <beaconHash(Hex)> <numIterationsExp>
../node_modules/.bin/snarkjs zkey beacon circuit_0001.zkey circuit_final.zkey 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon phase2"

# Verify the final zkey
../node_modules/.bin/snarkjs zkey verify circuit.r1cs $1 circuit_final.zkey

# Export the verification key to JSON
../node_modules/.bin/snarkjs zkey export verificationkey circuit_final.zkey verification_key.json

# Remove intermediary files
rm circuit_0000.zkey
rm circuit_0001.zkey

### Output Files:
# circuit_final.zkey
# verification_key.json

### Remove intermediate files that have been used
rm circuit.r1cs
