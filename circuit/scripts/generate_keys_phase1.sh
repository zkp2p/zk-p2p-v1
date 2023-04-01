# Print warning

echo "PHASE 1 CAN BE SKIPPED AS IT IS VERY COMPUTATIONALY HEAVY. YOU CAN GRAB THE FILES FROM ~/ptau_files"
cd circuit
# Start a new powers of tau cermony
../node_modules/.bin/snarkjs powersoftau new bn128 5 pot_0000.ptau -v
# Contribute to the cermony
../node_modules/.bin/snarkjs powersoftau contribute pot_0000.ptau pot_0001.ptau --name="First contribution" -v -e="some random text"
# Provide a second contribution
../node_modules/.bin/snarkjs powersoftau contribute pot_0001.ptau pot_0002.ptau --name="Second contribution" -v -e="some random text 2"
# Provide a third contribution using third party software
../node_modules/.bin/snarkjs powersoftau export challenge pot_0002.ptau challenge_0003
../node_modules/.bin/snarkjs powersoftau challenge contribute bn128 challenge_0003 response_0003 -e="some random text 3"
../node_modules/.bin/snarkjs powersoftau import response pot_0002.ptau response_0003 pot_0003.ptau -n="Third contribution name"
# Verify the protocol so far
../node_modules/.bin/snarkjs powersoftau verify pot_0003.ptau
# Apply a random beacon
../node_modules/.bin/snarkjs powersoftau beacon pot_0003.ptau pot_beacon.ptau 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon"
# Prepare Phase 2 (Circuit Specific Phase)
../node_modules/.bin/snarkjs powersoftau prepare phase2 pot_beacon.ptau pot_final.ptau -v

# Remove unnecessary files
rm pot_0000.ptau
rm pot_0001.ptau
rm pot_0002.ptau
rm pot_0003.ptau
rm pot_beacon.ptau

rm challenge_0003
rm response_0003