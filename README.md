# ZKP2P

## A trustless fiat onramp powered by ZK proofs
ZKP2P (V1) is a trustless fiat to crypto onramp that can is built on top of Venmo. The PoC is live on Optimism and Goerli! Try it out at [zkp2p.xyz](https://zkp2p.xyz/). V2 is currently under active development. Follow us on our [Twitter](https://twitter.com/zkp2p) and out [Telegram](https://t.me/+XDj9FNnW-xs5ODNl) for announcements and updates!

<img width="1000" align="center" src="https://user-images.githubusercontent.com/6797244/229355494-3f9fd4aa-76a2-4219-b294-88e356e43345.jpeg"/>


## Usage
The easiest way to get started is by watching our [Demo video](https://drive.google.com/file/d/1CaPoVMrZUEuvsFhXLLI9D1wUXevqSwkT/view) where we go through the application flow for both the on-ramper and the off-ramper.

On-rampers will:
* Begin by posting an order to the order book for the desired USDC amount (max 20). The order will appear in the order table when mined
* Wait for a claim to be submitted by an off-ramper. Claims will appear when clicking into your order from the table. Note: as this is a PoC, we are not running any relayers to claim orders. You will likely need to complete this yourself to test the application.
* Decrypt the order claim and send the requested fiat amount on Venmo. Make sure you have payment receipt emails enabled from Venmo.
* Open the confirmation email from Venmo, and paste the original contents into the generate proof text input.
* Generate the proof (this takes ~10 minute, don't close your browser!) and then submit the proof on chain to receive the USDC.

Off-rampers will:
* Submit a claim to an order. The flow will require your numeric Venmo ID and some USDC. You will also need to approve allowance to the ramp smart contract listed below. Note: submitting a claim escrows the USDC amount which can be clawed back if the claim is not completed by the on-ramper.
* That's it! Prepare to receive USD on Venmo.


### Additional Usage Requirements

#### Fetching Your Venmo ID
ZKP2P off-ramping requires submitting Venmo IDs on chain so the on-rampers knows where to send the payment. A Venmo ID is unique identifier (e.g. 1234567891011121314 up to 19 digits) for your Venmo account that is separate from your handle (@Venmo-User). They are encrypted with keys generated automatically for the on-ramper and stored locally. We cannot extract Venmo handles directly from the ID as it violates Venmo's Terms of Service. You can look up your Venmo ID using one of the following methods:

- Open any Venmo payment receipt email and click on 'Show original' and search for `user_id`. As of writing these instructions [4/30/2023], you should be able to locate your id in multiple places but may need to splice the `3D` encoding in front of the id.
- Paste `curl https://account.venmo.com/u/[YOUR_VENMO_HANDLE] | grep -o '"user":{"displayName":"[^"]*","id":"[0-9]*"' | sed 's/.*"id":"\([0-9]*\).*/\1/'` into the command line, replacing YOUR_VENMO_HANDLE with your Venmo username without the `@` e.g. `Alex-Soong`.

To verify your id, you can go to https://venmo.com/code?user_id=[YOUR_VENMO_ID] and the page should resolve to a profile for your account.

### Approving and Acquiring Fake USDC (Goerli Only)

To use the PoC on Goerli, users must mint and approve the fake USDC token on Goerli that we deployed. Mint and approval must be done manually. You can do so by going to the FakeUSDC Etherscan link below and calling the `mint` function with the amount of USDC you want to mint. Then, on the same Etherscan page and call the `approve` function with a USDC value scaled by 10e6 and the address of the Ramp contract (below)

### Deployed Addresses (Goerli)
Optimism:
- Ramp - [0xa8B1e2A1235E2B30B32233b9176867A05B48dc3e](https://optimistic.etherscan.io/address/0xa8B1e2A1235E2B30B32233b9176867A05B48dc3e)

Goerli:
- Ramp - [0xc77cf422df9a02c10d361d7d45581ac6ee73b97c](https://goerli.etherscan.io/address/0xc77cf422df9a02c10d361d7d45581ac6ee73b97c)
- FakeUSDC - [0xf6426A1fdE02c3d6f10b4af107cDd7669574E74C](https://goerli.etherscan.io/address/0xf6426A1fdE02c3d6f10b4af107cDd7669574E74C)


### Limitations

- Slow proving time
- Mechanism relies on trusting Venmo. It is likely not sound for large transactions where a malicious actor has more incentive to attack the system. (e.g. chargebacks, convincing Venmo signatures to sign a malicious email). Hopefully for smaller transactions, there is more recourse (e.g. user ID is doxxed and victim can complain to Venmo)
- Currently only supports USDC and Venmo. Can be extended to other P2P payment systems (e.g. Paypal, Zelle) and other assets (ETH, NFTs etc.)
See our refreshed [demo video](https://drive.google.com/file/d/1CaPoVMrZUEuvsFhXLLI9D1wUXevqSwkT/view?usp=drive_link)

## Project History
ZKP2P was convceived at [ZK Hack Lisbon](https://www.zklisbon.com/) 2023 and was the 2nd place winner of the hackathon. You can find our original video showcasing the hack at the [ZK Hack closing ceremony](https://www.youtube.com/watch?v=GjxNsZ-Gg-Q) and our submission demo in [Devfolio](https://devfolio.co/projects/zkpp-23ef)

ZKP2P is powered by ZK proofs of DKIM signatures in payment confirmation emails and was inspired by 0xParc / PSE's [ZK Email](https://github.com/zkemail/zk-email-verify/) who provided libraries to prove the SHA256, email regex and RSA without revealing sensitive contents in the email. Upon successful proof generation, a user will be able to trustlessly unlock escrowed assets on-chain. In future explorations, we plan to integrate additional web2 payment rails (e.g. Paypal, Transferwise) and can do so without permission from the payment network itself.

### Problem

- New retail users face huge barriers to onboard funds onto web3
- Users must register for a centralized exchange (e.g. Coinbase) or use centralized fiat onramps which charge high fees (e.g. 5%)
- Crypto natives are unable to offboard funds into the real world
- Only institutional accounts have direct access to convert USDC or USDT to USD
- Existing P2P solutions either require meeting in person (e.g., LocalBitcoins) or rely on a centralized intermediary (e.g., OTC desks)

### High Level Flow

There are 2 actors in the system: 1) off-rampers and 2) on-rampers:

1. Off-rampers are users who intend to trade their USDC on-chain to USD on Venmo
2. On-rampers are users who intend to trade their USD on Venmo to USDC on-chain

<img src="./images/P2P_Venmo_Onramp_v1.png">

Following table contains information about our main circuit:
|Metric|Value|
|------|------|
|constraints| 6618823|
|public inputs| 18|
|public outputs| 4|
|private inputs| 7478|
|wires| 6400562|
|labels| 30385320|


### Future Work
Previous points of future work have been completed and the app is remote hosted on [https://zkp2p.xyz](https://zkp2p.xyz/). Follow along with our V2 development in our new repo [here](https://github.com/zkp2p/zk-p2p).
