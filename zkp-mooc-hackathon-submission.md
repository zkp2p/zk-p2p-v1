# ZKP MOOC Hackathon submission

## Project Description

ZKP2P is a privacy preserving trustless P2P fiat onramp that can integrate with any web2 payment rails (e.g. Venmo) 
without permission from the payment network itself. We build upon the 0xParc / PSE ZK-Email libraries to prove the 
contents in a payment email and bring that data on-chain in a privacy preserving manner to unlock escrowed assets on-chain.

Our current PoC enables trustless and privacy-preserving USDC to USD trades on the Goerli network using Venmo as the off-chain payment rails.
Our PoC is live! Give it a try at https://zkp2p.xyz. 😄 

We began hacking on this submission at ZKHack Lisbon in early April, where we built a working v0. Since then, we have reworked the flow to prioritize privacy. We modified our circuits and smart contracts to preserve the privacy of our users' Venmo IDs, implemented full client-side proving to prevent private data leakage to servers, and added optimizations for faster client-side proving.


### Flow Diagram
There are 2 actors in the system: 
1. On-rampers: Users who intend to trade their USD on Venmo to USDC on-chain.
2. Off-rampers: Users who intend to trade their USDC on-chain to USD on Venmo.

<img src="./images/P2P_Venmo_Onramp_v1.png">

<!-- **Onramp / Offramp**
1. Onrampers create a new order specifying the amount of USDC they want to receive and the maximum amount of USD they are willing to pay

<img width="1706" alt="Screenshot 2023-04-04 at 11 36 50 AM" src="https://user-images.githubusercontent.com/6797244/229766694-05d67c79-80c0-40c6-a751-07f1e6fca8c0.png">

2. Offrampers view orders that are posted and can indicate interest in filling an onrampers order by claiming. When offrampers claim an order, they lock their USDC to the Ramp escrow contract. Multiple offrampers can indicate interest in an order.

<img width="1706" alt="Screenshot 2023-04-04 at 11 37 23 AM" src="https://user-images.githubusercontent.com/6797244/229767231-2dad605e-74eb-4495-be16-f5db263a7442.png">

3. Offrampers send a Venmo request off-chain to the onramper's Venmo ID. Multiple offrampers can send Venmo request to the onramper
4. Onramper chooses which Venmo request to complete the charge for and check that `orderID`, offramper `userID`, and amount are correct
5. Onramper completes request and downloads the confirmation email from Venmo. They generate a proof of the confirmation email and submit the transaction on-chain to unlock the escrow funds

<img align="center" width="1715" alt="Screenshot 2023-04-02 at 1 39 16 PM" src="https://user-images.githubusercontent.com/6797244/229768914-236fdc83-76b5-4e54-925f-ae29e4ff6cd2.png"> -->

## Technology Overview

### Circuits
#### ZK-email-verify
Our circuits are build on top of the [zk-email-verify](https://github.com/zkemail/zk-email-verify) circuits. We borrow the following circuits and scripts written by the zk-email team:
- **RSA Signature verification**: Verifies a signature signed by a 2048 bit RSA public key
- **SHA256 Partial hashing**: Completes the sha256 hash given a pre-computed state. Allows us to calculate first part of the partial hashes outside the circuit thus reducing proving time.
- **Regex circuit generator script**: To perform arbitrary regex checks within the circom framework, they implemented a Python script that converts a given regex into a deterministic finite automata (DFA) and then represents the DFA via gate operations in circom code.

#### Venmo Email regex circuits
We used their regex circuit generator scripts to generate our own regex circuits for parsing a venmo payment email. Currently we have the following regex circuits:
- **Venmo Off-ramper ID Regex**: This [regex circuit](./circuit/venmo_offramper_id_regex.circom) extracts out the venmo ID of the payee (user who was paid) from a venmo payment email's body. Written in circom.
- **Venmo Amount Regex**: This [regex circuit](./circuit/venmo_amount_regex.circom) extracts out the amount sent from a venmo payment email's header. Written in circom.

#### P2P OnRamp Circuit:
This is our [main circuit](./circuit/circuit.circom) written in circom and it performs the following operations:
* It accepts the email as an input and checks if the email header and body are signed by Venmo using RSA and SHA-256, ensuring the email's authenticity.
* It extracts the venmo ID of the payee (user who was paid) from the email's body and hashes it.
* It extracts the amount of USD transacted in the venmo email from the email's header and packs it into smaller chunks.
* Public signals revealed by the circuit:
    - RSA signature modulus against which the signature was checked. Is Venmo's DNS public key.
    - Hash of the payee's Venmo ID
    - Amount of USD paid to payee
    - Order ID specified by the on-ramper generating the proof [To prevent frontrunning]

Following table represents information about our circuit:
|Metric|Value|
|------|------|
|constraints| 6618823|
|public inputs| 18|
|public outputs| 4|
|private inputs| 7478|
|wires| 6400562|
|labels| 30385320|


### Proof generation in the browser

To preserver privacy of the user's email we opted for generating ZK proofs in the browser. Optimizations added to make client side proving faster:

#### Chunked Proving key
The size of our proving key is **3.5GB** which makes it difficult to download and generate proofs. So we chunked our keys into 10 parts using [sampriti's snarkjs fork](https://github.com/sampritipanda/snarkjs#fef81fc51d17a734637555c6edbd585ecda02d9e). We then compressed each one of them and hosted them on a public [AWS S3 bucket](https://s3.console.aws.amazon.com/s3/buckets/zk-p2p-onramp?region=us-east-1&tab=objects). Sizes of the chunked proving keys in total is **1.95 GB**. A reduction in size of 45%.

#### Storing proving keys
The chunked proving keys are downloaded when the user generates the proof for the very first time. These chunked keys are stored in their compressed form in the local storage of the browser on the user's machine, so that 
the user doesn't has to downaload the proving key again and waste network bandwidth.

Table presents steps taken to generate proof on the client end along with time taken for each step:
|Step|Time|
|------|------|
Chunked keys download (only once)| 207s (3.4s)
Proof generaiton | 623s (10.3 mins)

### Dev Server
We set up an AWS EC2 `z1d.12x large` instance as our development server. We chose this instance because it has one of the fastest single core performance for our circuit compilation and witness generation needs. It has 48 cores which speeds up our proving key generation. We followed the [best practices for large circuits](https://hackmd.io/V-7Aal05Tiy-ozmzTGBYPA?view) guide to setup our server. 

Table presents the various steps of circuit development alng with time taken to perform each step:
|Step|Time|
|------|------|
Compilation | 563.87s (9.3 mins)
Proving key generation| 782s (13 mins)
Chunked proving key generation| 3 hours
Witness geeration|60s
Proof generation using rapidsnark| 9.2s

#### Proving system

We used the Groth16 proving system because it produces proofs smaller in size compared to other proving systems, which translates into lower gas costs when verifying proof on-chain. Groth16 proofs can be verified quickly which is essential for on-chain verification.

Groth16 requires a trusted setup per circuit, but we have not done any trusted setup for our PoC deployed on https://zkp2p.xyz.

### Smart Contracts

The smart contracts are written in Solidity and deployed on the Goerli test network. The contract provides endpoints for different actors in the system to turstlessly coordinate with each other. 

#### Ramp contract

The [ramp contract](./contracts/Ramp.sol) offers the following functionality:

For on-rampers:
- Posting Orders: Allows on-rampers to post an on-ramp order specifying the amount to receive, max amount to pay, and an encryption public key.
- On-Ramping: Enables users to perform the on-ramp operation by providing ZK proof of off-chain payment to the off-ramper. The function verifies the proof and releases the escrowed funds to the on-ramper.
- Canceling Orders: Allows the creator of an order to cancel it if it is still open and has not been filled or canceled.

For off-rampers:
- Claiming Orders: Allows off-rampers to claim a posted order by providing their Venmo ID, the order nonce, an encrypted Venmo ID, and a minimum amount to pay.
- Clawback claims: Enables off-rampers to claw back funds from a submitted claim if the claim has expired or the order has been canceled or filled.

#### Verifier contract

The [verifier contract](./contracts/Verifier.sol) is for verifying zk-SNARK proofs using the Groth16 proving sysetem. It is generated using the SnarkJS template and hosts the on-chain verification logic. It is extended by the main Ramp contract.

#### Fake USDC contract

An ERC20 token deployed on Goerli network for testing purposes.

The latest contract addresses on the Goerli network are: 
- Ramp - [0x945D14a5c63769f4cf008a2994810940cc0DFd5C](https://goerli.etherscan.io/address/0x945D14a5c63769f4cf008a2994810940cc0DFd5C)
- FakeUSDC - [0xf6426A1fdE02c3d6f10b4af107cDd7669574E74C](https://goerli.etherscan.io/address/0xf6426A1fdE02c3d6f10b4af107cDd7669574E74C)


## Approach to Problem

Our team aimed to create an end-to-end application that showcases the power of zero-knowledge proofs in fostering trustless interactions with existing Web 2.0 services. Drawing inspiration from the zk-email protocol, which enables users to prove their Twitter handle ownership through the verification of a DKIM-signed confirmation email, we recognized the potential for enhancing user experiences in onboarding and offboarding processes.

Onboarding, in particular, presents a problem for users seeking trustless end-to-end solutions. New retail users face substantial barriers when attempting to onboard funds into the Web3 ecosystem. They must either register with a centralized exchange like Coinbase with prohibitive KYC requirements and long confirmation windows, or use centralized fiat onramps with high fees.

Additionally, crypto natives struggle to offboard funds for use in the real world, as only institutional accounts have direct access to convert USDC or USDT to USD. Existing P2P solutions, such as LocalBitcoins and OTC desks, either necessitate in-person meetings or rely on trusted intermediaries.

To address these issues, we designed a user-friendly onboarding flow that mitigates the need for trusted coordination between counterparties via a centralized intermediary. Our solution uses trustless technologies like smart contracts and zk-SNARKS. On-rampers can post their orders on-chain, allowing multiple off-rampers to submit competitive bids on-chain. The on-ramper then confirms the best order, peforms the off-chain payment, generates a proof from the email confirmation, and submits that on chain to unlock the USDC.

Our initial v0 implemention implemented in early April leaked users Venmo IDs on-chain and did not support client side proof generation. We have iterated on our initial v0 implemention since then and added privacy as a first class citizen ensuring no venmo IDs are leaked on-chain. Only the parties involved in the transaciton know their counterpartie's Venmo ID to facilitate the off-chain transaction. We added supported for full client side proving to preserve maximum privacy and not reveal contents of the email other than what is necessary.

Even now, our solution requires up to ten minutes for client-side proof generation, yet it remains more competitive than the existing alternatives. It caters to only venmo users and can only be used to on-board to USDC. As we move toward production, we will continue to optimize client side proof generation, add support for more payment services and on-chain tokens including ETH for gas token, improve security and enhance the overall user experience.