## ZK Starter

Get started with ZK-SNARKS using Circom and Snark.js

### Getting started (Rough Notes)

1. Write the circuit. Make sure it has constraints.
2. Compile the circuit.
    - `yarn compile`
3. Circuit compilation creates a circuit.r1cs file. 
    - R1CS stands for Rank1 constraint system.
        - Lower level representation of the constraints in the circuit.
    - Circuit.wasm is used to generate the witness.
        - Series of instructions, that takes inputs and generates the intermediate values (the computation trace) that is input for the snark prover.
    - WASM is just a single arrow representation of the circuit. It is the circuit but without constraints.
4. Optional step:
    - `yarn genKeyPhase1<Protocolname>`
        - `yarn genKeyPhase1Groth` or `yarn genKeyPhase1Plonk`. Can run either for getting started.
    - Output is a ptau file
        - Which can also be downloaded from https://github.com/iden3/snarkjs#7-prepare-phase-2
5. Gen Key Phase 2
    - `yarn genKeyPhase2Groth pot_final.ptau` if you ran `yarn genKeyPhase1<ProtocolName>`
    - `yarn genKeyPhase2Groth ~/ptau_files/powersOfTau28_hez_final_17.ptau` if you downloaded the ptau file
    - Generates a set of proving and verifying keys from the circuit file.
6. Prepare inputs
    - Modify the python script to prepare the inputs
7. Generate Proof
    - `yarn genProofGroth`
    - Calculates the witness.
        - Calculated using WASM + input.json
        - Basically a set of intermediate values that is input for the snark prover.
    - Prover
        - Takes the intermediate values (the witness file) and the proving key and generates a SNARK proof.
8. Verification
    - `yarn genVerifyGroth`
    - Takes in the SNARK proof, the verification key and the public variables (inputs/outputs) and verifies the SNARK proof.
9. Verification contract
    - `yarn genContract`
    - Snark js has a template verifier contract. Grabs all the values from verification key.json, and pastes them to the template contract to create the verifier contract.
    - Verifier contract, like the verification key, is specific to the circuit.
10. Creating calldata
    - `yarn genCalldata`
    - This is created using public.json and verification key.json

#### Notes:
- If we modify inputs, then you need to run 6, 7, 10.
- If you modify circuit, then compile, genKeyPhase2, and genContract. 