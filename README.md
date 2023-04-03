# ZKP2P

### A trustless P2P fiat onramp powered by ZK proofs and Venmo

![zkp2p](https://user-images.githubusercontent.com/6797244/229355494-3f9fd4aa-76a2-4219-b294-88e356e43345.jpeg)

ZKP2P enables trustless USDC to USD trades using ZK proofs of DKIM signatures of Venmo confirmation emails. The app can be found at zkp2p.xyz (not live yet). We use the libraries created by [ZK Email](https://github.com/zkemail/zk-email-verify/) to prove the SHA256 and RSA signatures and regex.

Part of [ZK Hack Lisbon](https://www.zklisbon.com/) 2023 (2nd place winner).

Our demo at the [ZK Hack closing ceremony](https://www.youtube.com/watch?v=GjxNsZ-Gg-Q) and [Devfolio](https://devfolio.co/projects/zkpp-23ef)

### Problem
- New retail users face huge barriers to onboard funds onto web3
- Users must register for a centralized exchange (e.g. Coinbase) or use centralized fiat onramps which charge high fees (e.g. 5%)
- Crypto natives are unable to offboard funds into the real world
- Only institutional accounts have direct access to convert USDC or USDT to USD
- Existing P2P solutions either require meeting in person (e.g., LocalBitcoins) or rely on a centralized intermediary (e.g., OTC desks)

<img width="1715" alt="Screenshot 2023-04-02 at 1 39 16 PM" src="https://user-images.githubusercontent.com/6797244/229353330-7dfec078-0a13-49be-9d89-be06bc79e77d.png">

### High Level Flow (TODO)

There are 2 actors in the system: 1) off-rampers and 2) on-rampers.

1. Onrampers post an order specifying the amount of USDC they want to receive and the maximum amount of USD they are willing to pay. Onrampers can cancel their order at any time
2. TODO

![P2P Venmo Onramp Hack](https://user-images.githubusercontent.com/6797244/229359133-e0862928-5849-43f5-8361-2ac698c1c17a.jpg)

### Limitations
- Slow proving time. It takes 60s for witness generation and 15s for proof gen using RapidSnark. 5GB proving key size. 8M+ constraints (a lot can be heavily optimized in the future)
- Mechanism relies on trusting Venmo. It is likely not sound for large transactions where a malicious actor has more incentive to attack the system. (e.g. chargebacks, convincing Venmo signatures to sign a malicious email). Hopefully for smaller transactions, there is more recourse (e.g. user ID is doxxed and victime can complain to Venmo)

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


### TODO REST OF DOCS
