# ZKP MOOC Hackathon submission

## Project Description
- ZKP2P enables trustless USDC to USD trades using ZK proofs of DKIM signatures of Venmo confirmation emails.
- We began to hack on this submission at ZKHack Lisbon in early April
- On-rampers and off-rampers interact through the client https://zkp2p.xyz/, and Venmo to exchange fiat and USDC

There are 2 actors in the system: 1) off-rampers and 2) on-rampers:
1. Off-rampers are users who intend to trade their USDC on-chain to USD on Venmo
2. On-rampers are users who intend to trade their USD on Venmo to USDC on-chain

There are currently 2 major flows in the protocol described below:
**Registration**
1. All users of the system must register and tie up a Venmo user ID to their public wallet address
2. Currently, users are able to specify any Venmo ID valid or not before posting orders. It is up to the counterparty to check that the Venmo ID is valid off-chain. In the future, we can make the system safer by requiring as part of the registration flow for the user to generate a proof of a historical Venmo transaction

**Onramp / Offramp**
1. Onrampers create a new order specifying the amount of USDC they want to receive and the maximum amount of USD they are willing to pay

<img width="1706" alt="Screenshot 2023-04-04 at 11 36 50 AM" src="https://user-images.githubusercontent.com/6797244/229766694-05d67c79-80c0-40c6-a751-07f1e6fca8c0.png">

2. Offrampers view orders that are posted and can indicate interest in filling an onrampers order by claiming. When offrampers claim an order, they lock their USDC to the Ramp escrow contract. Multiple offrampers can indicate interest in an order.

<img width="1706" alt="Screenshot 2023-04-04 at 11 37 23 AM" src="https://user-images.githubusercontent.com/6797244/229767231-2dad605e-74eb-4495-be16-f5db263a7442.png">

3. Offrampers send a Venmo request off-chain to the onramper's Venmo ID. Multiple offrampers can send Venmo request to the onramper
4. Onramper chooses which Venmo request to complete the charge for and check that `orderID`, offramper `userID`, and amount are correct
5. Onramper completes request and downloads the confirmation email from Venmo. They generate a proof of the confirmation email and submit the transaction on-chain to unlock the escrow funds

<img align="center" width="1715" alt="Screenshot 2023-04-02 at 1 39 16 PM" src="https://user-images.githubusercontent.com/6797244/229768914-236fdc83-76b5-4e54-925f-ae29e4ff6cd2.png">

## Technology Overview

### Background
Our project is build on top of the zk-email-verify circuit.

### Circuits

We used Circom 2.0 to write our circuits. We used circuits written by the zk-email team for the following tasks
- **RSA Signature verification**: Verifies a signature signed by a 2048 bit RSA public key
- **SHA256 Partial hashing**: Completes the sha256 hash given a pre-computed state. Allows us to calculate first part of the partial hashes outside the circuit thus reducing proving time.
- **Regex circuits**: To perform arbitrary regex checks within the circom framework, they implemented a Python program that converts a given regex into a deterministic finite automata (DFA) and then represents the DFA via gate operations in circom code.

We used their generator scripts to generate our own regex circuits for parsing a venmo email. Currently we have the following regex circuits:
- **Venmo MM Regex**: This regex circuit extracts out the venmo mm id from the venmo payment email.
- **Venmo User Regex**: This regex circuit extracts out the venmo user ID from the venmo payment email
- **Venmo Message Regex**: This regex circuit extracts out the venmo custom message from the venmo payment email. The venmo custom message contains the order ID which needs to be submitted as a public signal on-chain.

### P2P OnRamp Circuit:
The circuit is designed to verify certain information from an email in a zero-knowledge proof setting. It checks if the email header and body are correctly signed using RSA and SHA-256, ensuring the email's authenticity. It also extracts specific information from the email body, such as the Venmo user ID, Venmo MM ID, and a Venmo message, by matching them against predefined regex patterns. The extracted information is then packed into smaller chunks for efficient processing. The primary goal of the circuit is to verify the authenticity of the email and extract important information without revealing the complete content of the email.

|Compilation|Value|
|------|------|
|non-linear constraints|8811533|
|public inputs|17|
|public outputs|9|
|private inputs|7543|
|wires|8449232|
|labels|34981572|

### Smart Contracts

The smart contracts are written in Solidity and deployed on the Goerli test network. The contract provides trustless on-ramping and off-ramping mechanisms for USDC tokens using Venmo as the payment platform. The following functionalities are provided by the contract:

#### User Registration

Users can register their Venmo IDs using the `register` function, which maps their Ethereum address to their Venmo ID and vice versa.

#### Posting Orders

Registered users can post an order using the `postOrder` function, specifying the amount they want to receive and the maximum amount they're willing to pay. Orders are stored in the `orders` mapping, with an incremental `orderNonce` as the key.

#### Claiming Orders

Users can claim an open order using the `claimOrder` function. The function verifies that the order is open and not claimed by the caller. The claimer submits their USDC tokens, and the order's claim status is updated accordingly.

#### On-Ramping

Users can initiate the on-ramp process using the `onRamp` function, which verifies the zero-knowledge proof provided by the on-ramper. It checks if the order is open and if the off-ramper has submitted a claim. Once verified, the claim status is updated, the order is marked as filled, and USDC tokens are transferred to the on-ramper.

#### Canceling Orders

Order creators can cancel their open orders using the `cancelOrder` function, which checks if the order is open and if the caller is the order creator before marking the order as canceled.

#### Clawback

Users can claw back their funds from submitted claims that haven't been used or have expired using the `clawback` function. The function checks the claim status and order status before transferring the USDC tokens back to the caller.

#### View Functions

The contract offers view functions for retrieving claims associated with a specific order (`getClaimsForOrder`) and fetching all orders (`getAllOrders`).

#### Internal Functions

The contract has internal functions for verifying and parsing on-ramp proofs (`_verifyAndParseOnRampProof`), converting packed bytes to strings (`_convertPackedBytesToBytes`), and converting strings to uint256 (`_stringToUint256`). 

The contract uses the `IERC20` interface from OpenZeppelin for handling ERC20 token (USDC) interactions and a custom `Verifier` contract for handling zero-knowledge proofs. The contract stores orders and claims in mappings and maintains various enums and structs to represent order and claim statuses. 

The contract addresses are: 
- Ramp - `0x805a3Ae6495Be653dE460685D5FFDD5A538550f1`
- FakeUSDC - `0xb685Bdc019DEE17D073746a88bF6a6cDDED8Ae70`

### Proof generation
We set up an EC2 z1d.12x large instance. We followed the best practices for large circuits guide to setup the server for circuit compilation and proof generation.

## Approach to Problem

Our team aimed to create an end-to-end application that showcases the power of zero-knowledge proofs in fostering trustless interactions with existing Web 2.0 services. Drawing inspiration from the zk-email protocol, which enables users to prove their Twitter handle ownership through the verification of a DKIM-signed confirmation email, we recognized the potential for enhancing user experiences in onboarding and offboarding processes.

Onboarding, in particular, presents a problem for users seeking trustless end-to-end solutions. Currently, these solutions may require up to five minutes for client-side proof generation, yet they remain more competitive than the existing alternatives. New retail users face substantial barriers when attempting to onboard funds into the Web3 ecosystem. They must either register with a centralized exchange like Coinbase with prohibitive KYC requirements and long confirmation windows, or use centralized fiat onramps with high fees.

Additionally, crypto natives struggle to offboard funds for use in the real world, as only institutional accounts have direct access to convert USDC or USDT to USD. Existing P2P solutions, such as LocalBitcoins and OTC desks, either necessitate in-person meetings or rely on trusted intermediaries.

To address these issues, we designed a user-friendly onboarding flow that mitigates the need for synchronous coordination between counterparties. On-rampers can post their orders on-chain, including their Venmo IDs (an aspect we are working to improve), allowing multiple off-rampers to submit competitive bids through the payment service. The off-ramper then confirms the best order, generates a proof from the email confirmation, and submits that on chain to unlock the USDC.

In our first iteration, we made assumptions about user preferences, such as their willingness to register their Venmo ID with their address, similar to revealing their Twitter handle. As we move toward production, we will continue to refine our application, addressing these assumptions and enhancing the overall user experience.
