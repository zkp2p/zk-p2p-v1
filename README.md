# ZKP2P

### A trustless P2P fiat onramp powered by ZK proofs and Venmo

<img width="1000" align="center" src="https://user-images.githubusercontent.com/6797244/229355494-3f9fd4aa-76a2-4219-b294-88e356e43345.jpeg"/>

ZKP2P enables trustless USDC to USD trades using ZK proofs of DKIM signatures of Venmo confirmation emails. The app can be found at [zkp2p.xyz](https://zkp2p.xyz/). We use the libraries created by [ZK Email](https://github.com/zkemail/zk-email-verify/) to prove the SHA256 and RSA signatures and regex.

Part of [ZK Hack Lisbon](https://www.zklisbon.com/) 2023 (2nd place winner).

Our demo at the [ZK Hack closing ceremony](https://www.youtube.com/watch?v=GjxNsZ-Gg-Q) and [Devfolio](https://devfolio.co/projects/zkpp-23ef)

DM us to join the conversation!


Twitter
- [Richard](https://twitter.com/richardzliang)
- [Brian](https://twitter.com/Bmwball56)
- [Alex](https://twitter.com/asoong91)
- [Sachin](https://twitter.com/0xSachinK)


[Telegram](https://t.me/+XDj9FNnW-xs5ODNl)

### Problem
- New retail users face huge barriers to onboard funds onto web3
- Users must register for a centralized exchange (e.g. Coinbase) or use centralized fiat onramps which charge high fees (e.g. 5%)
- Crypto natives are unable to offboard funds into the real world
- Only institutional accounts have direct access to convert USDC or USDT to USD
- Existing P2P solutions either require meeting in person (e.g., LocalBitcoins) or rely on a centralized intermediary (e.g., OTC desks)

<!--
### High Level Flows

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
-->
### Usage
This is WIP
1. Clone the repo and run `yarn install` in both the root and `app` folders. Navigate to the app folder and run `yarn start`
2. Currently, we still need to wire up the generate proof to the UI flow. You have to paste your proof.json and public.json into the `Proof Output` and `Public Signal` text boxes in the UI. To generate the proof, you'll need to first download the proving key from our S3 bucket (link to be updated)
3. Then run `yarn genProofGroth` after cloning the repo. This will take a long time (5min+). Or user RapidSnark on a server by following [Best Practices for Large Circuits](https://hackmd.io/V-7Aal05Tiy-ozmzTGBYPA?view#Compilation-and-proving).

|Compilation|Value|
|------|------|
|non-linear constraints|8811533|
|public inputs|17|
|public outputs|9|
|private inputs|7543|
|wires|8449232|
|labels|34981572|

### Limitations
- Slow proving time. It takes 60s for witness generation and 15s for proof gen using RapidSnark. 5GB proving key size. 8M+ constraints (a lot can be heavily optimized in the future)
- Mechanism relies on trusting Venmo. It is likely not sound for large transactions where a malicious actor has more incentive to attack the system. (e.g. chargebacks, convincing Venmo signatures to sign a malicious email). Hopefully for smaller transactions, there is more recourse (e.g. user ID is doxxed and victim can complain to Venmo)

### Future Work
- Deploy to prod!
- Design around edge cases (What if a hacker gets Venmo to sign a malicious email? What are ways of recourse? How to deal with chargebacks? Nullifiers?)
- Optimizations. Speed up proving time perhaps using Halo2 libs
- Integrate more P2P payment systems (Paypal, Zelle) and potentially bank ACH / wires
- Support more tokens

### Deployed Addresses

#### Testnet (Goerli)
* Ramp - [0x805a3Ae6495Be653dE460685D5FFDD5A538550f1](https://goerli.etherscan.io/address/0x805a3Ae6495Be653dE460685D5FFDD5A538550f1)
* FakeUSDC - [0xb685Bdc019DEE17D073746a88bF6a6cDDED8Ae70](https://goerli.etherscan.io/address/0xb685Bdc019DEE17D073746a88bF6a6cDDED8Ae70)

### Venmo ID Instructions
...
