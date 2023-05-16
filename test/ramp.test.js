const hre = require("hardhat");
const chai = require("chai");
const { solidity } = require("ethereum-waffle");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

chai.use(solidity);

const { expect } = chai;
const { BigNumber } = hre.ethers;

const venmoRsaKey = [
    "683441457792668103047675496834917209",
    "1011953822609495209329257792734700899",
    "1263501452160533074361275552572837806",
    "2083482795601873989011209904125056704",
    "642486996853901942772546774764252018",
    "1463330014555221455251438998802111943",
    "2411895850618892594706497264082911185",
    "520305634984671803945830034917965905",
    "47421696716332554",
    "0",
    "0",
    "0",
    "0",
    "0",
    "0",
    "0",
    "0"
];

const ZERO = BigNumber.from(0);

describe("Ramp", function () {
    let ramp;
    let fakeUSDC;
    let maxAmount;

    let deployer;
    let onRamper;
    let offRamper;

    beforeEach(async function () {
        [deployer, onRamper, offRamper] = await hre.ethers.getSigners();

        const FakeUSDC = await hre.ethers.getContractFactory("FakeUSDC");
        fakeUSDC = await FakeUSDC.deploy("Fake USDC", "fUSDC", 10000000000000);

        await fakeUSDC.connect(deployer).transfer(offRamper.address, 1000000000); // $1000

        const Ramp = await hre.ethers.getContractFactory("Ramp");
        maxAmount = BigNumber.from("10000000");
        ramp = await Ramp.deploy(venmoRsaKey, fakeUSDC.address, maxAmount);
    });

    describe("postOrder", function () {
        let amount = BigNumber.from(9000000); // $9
        let maxAmountToPay = BigNumber.from(10000000); // $10

        it("stores an order", async function () {
            const publicKey = "0xa19eb5cdd6b3fce15832521908e4f66817e9ea8728dde4469f517072616a590be610c8af6d616fa77806b4d3ac1176634f78cd29266b4bdae4110ac3cdeb9231";
            
            const orderId = await ramp.orderNonce();

            const unopenedOrder = await ramp.orders(orderId);

            expect(unopenedOrder.amountToReceive).to.equal(ZERO);
            expect(unopenedOrder.maxAmountToPay).to.equal(ZERO);
            expect(unopenedOrder.status).to.equal(0);

            await ramp.connect(onRamper).postOrder(amount, maxAmountToPay, publicKey);

            const openOrder = await ramp.orders(orderId);

            expect(openOrder.amountToReceive).to.equal(amount);
            expect(openOrder.maxAmountToPay).to.equal(maxAmountToPay);
            expect(openOrder.status).to.equal(1);
        });
    });

    describe.skip("claimOrder", function () {
        let amount = BigNumber.from(100000000); // $100
        let maxAmountToPay = BigNumber.from(101000000); // $101
        let onRamperVenmoId = BigNumber.from(1234567890);
        let offRamperVenmoId = BigNumber.from(0987654321);
        let orderId;

        beforeEach(async function () {
            await ramp.connect(onRamper).register(onRamperVenmoId);
            await ramp.connect(offRamper).register(offRamperVenmoId);
            orderId = await ramp.orderNonce();
            await ramp.connect(onRamper).postOrder(amount, maxAmountToPay);

            await fakeUSDC.connect(offRamper).approve(ramp.address, amount);
        });

        it("adds a claim on the order", async function () {
            const preOrderClaim = await ramp.orderClaims(orderId, offRamper.address);

            expect(preOrderClaim.venmoId).to.equal(ZERO);
            expect(preOrderClaim.claimExpirationTime).to.equal(ZERO);
            expect(preOrderClaim.status).to.equal(0);

            await ramp.connect(offRamper).claimOrder(orderId);

            const postOrderClaim = await ramp.orderClaims(orderId, offRamper.address);

            expect(postOrderClaim.venmoId).to.equal(offRamperVenmoId);
            // expect(postOrderClaim.claimExpirationTime).to.equal(ZERO);
            expect(postOrderClaim.status).to.equal(1);
        });

        it("updates order state to track the claim", async function () {
            const preOrderClaims = await ramp.getClaimsForOrder(orderId);

            expect(preOrderClaims.length).to.equal(0);

            await ramp.connect(offRamper).claimOrder(orderId);

            const postOrderClaims = await ramp.getClaimsForOrder(orderId);

            expect(postOrderClaims.length).to.equal(1);
            expect(postOrderClaims[0].venmoId).to.equal(offRamperVenmoId);
            expect(postOrderClaims[0].status).to.equal(1);
        });

        it("transfers USDC from the offRamper to the contract", async function () {
            const preOffRampBalance = await fakeUSDC.balanceOf(offRamper.address);
            const preRampBalance = await fakeUSDC.balanceOf(ramp.address);

            await ramp.connect(offRamper).claimOrder(orderId);

            const postOffRampBalance = await fakeUSDC.balanceOf(offRamper.address);
            const postRampBalance = await fakeUSDC.balanceOf(ramp.address);

            expect(postOffRampBalance).to.equal(preOffRampBalance.sub(amount));
            expect(postRampBalance).to.equal(preRampBalance.add(amount));
        });

        describe("when the order is in Unopened state", function () {
            it("reverts", async function () {
                await expect(ramp.connect(offRamper).claimOrder(orderId.add(1))).to.be.revertedWith("Order has already been filled, canceled, or doesn't exist");
            });
        });

        describe("when the caller has already submitted a claim (OrderClaim is Submitted status)", function () {
            beforeEach(async function () {
                await ramp.connect(offRamper).claimOrder(orderId);
            });

            it("reverts", async function () {
                await expect(ramp.connect(offRamper).claimOrder(orderId)).to.be.revertedWith("Order has already been claimed by caller");
            });
        });

        describe("when the caller tries to claim their own order", function () {
            it("reverts", async function () {
                await expect(ramp.connect(onRamper).claimOrder(orderId)).to.be.revertedWith("Can't claim your own order");
            });
        });
    });

    describe.skip("cancelOrder", function () {
        let amount = BigNumber.from(100000000); // $100
        let maxAmountToPay = BigNumber.from(101000000); // $101
        let onRamperVenmoId = BigNumber.from(1234567890);
        let offRamperVenmoId = BigNumber.from(0987654321);
        let orderId;

        beforeEach(async function () {
            await ramp.connect(onRamper).register(onRamperVenmoId);
            await ramp.connect(offRamper).register(offRamperVenmoId);
            orderId = await ramp.orderNonce();
            await ramp.connect(onRamper).postOrder(amount, maxAmountToPay);
        });

        it("sets the order to canceled", async function () {
            await ramp.connect(onRamper).cancelOrder(orderId);

            const order = await ramp.orders(orderId)

            expect(order.status).to.equal(3);
        });
    });

    describe("onRamp", function () {
        let amount = BigNumber.from(9000000); // $9 (on ramper's perspective)
        let maxAmountToPay = BigNumber.from(10000000); // $10 (from on-ramper's perspective)
        let minAmountToPay = BigNumber.from(10000000); // $10 (off-ramper's bidding)
        let claimId = BigNumber.from(0);
        let offRamperVenmoId = BigNumber.from("14286706241468003283295067045089601281912688124398815891602745783310727407967");
        let orderId=1;

        let a = ["0x030f041a5bb0e20c7e89129c0ce06b12ebb4dbc57e57687627ebaf487e053c19", "0x02621e3127810cc43c20cb722385f5fa9d4fe71d4c2343884397b714a881e41b"];
        let b = [["0x03c2010d7128f692ae23ae9e9404f6345c0e531b7c38b8e3f30f19774d96d098", "0x0864f75fd26a4a2904e0ffba27afd5b1f611e65fd16c16441cacb16c2775c6dd"],["0x0edcd5f61d09b7f75244ef367267258b000693f0d3fdd9f5deb07ce55ca663e8", "0x14ea0b0f58fe04ae99f9ee32096164ef97bf5ec990674968a4eb4f70f9cd40d8"]];
        let c = ["0x268de00f442b2c90f899709e7d6f056bd0e1551d28be2458eed119395cf8080d", "0x1a05b29d11ed1a498abb512ea561b381e7b7f328f81e5baf5e9a949878d6cf75"];
        let signals = ["0x1f95fd3aa3a0f764e2eae57d17816218da1f577ce7722e51249e2f28fa5a695f","0x0000000000000000000000000000000000000000000000000000000000003033","0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000e5ab9ad5b818c501704a57172b2b36","0x0000000000000000000000000000000001281aa2b013864aab62be89d24a4ddb","0x0000000000000000000000000000000000000000000000000000000000003a49","0x000000000000000000000000000000000083a043f3f512cb0e9efb506011e359","0x0000000000000000000000000000000000c2e52cefcd800a155366e0207f2563","0x0000000000000000000000000000000000f3576e6387ca2c770760edd72b0fae","0x00000000000000000000000000000000019143a1fc85a71614784b98ff4b16c0","0x00000000000000000000000000000000007bbd0dfb9ef73cf08f4036e24a6b72","0x000000000000000000000000000000000119d3bd704f04dc4f74482cdc239dc7","0x0000000000000000000000000000000001d083a581190a93434412d791fa7fd1","0x000000000000000000000000000000000064350c632569b077ed7b300d3a4051","0x00000000000000000000000000000000000000000000000000a879c82b6c5e0a","0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000000000000000000000000001","0x0000000000000000000000000000000000000000000000000000000000000000"];

        beforeEach(async function () {
            await ramp.connect(onRamper).postOrder(amount, maxAmountToPay, onRamper.address);
            await fakeUSDC.connect(offRamper).approve(ramp.address, amount);
            await ramp.connect(offRamper).claimOrder(offRamperVenmoId, orderId, "0x69", minAmountToPay);
        });

        it("sets the order to filled", async function () {
            await ramp.connect(onRamper).onRamp(a, b, c, signals);

            const order = await ramp.orders(orderId)

            expect(order.status).to.equal(2);
        });

        it("transfers funds to the on ramper", async function () {
            const preOnRampBalance = await fakeUSDC.balanceOf(onRamper.address);
            const preRampBalance = await fakeUSDC.balanceOf(ramp.address);

            await ramp.connect(onRamper).onRamp(a, b, c, signals);

            const postOnRampBalance = await fakeUSDC.balanceOf(onRamper.address);
            const postRampBalance = await fakeUSDC.balanceOf(ramp.address);

            expect(postOnRampBalance).to.equal(preOnRampBalance.add(amount));
            expect(postRampBalance).to.equal(preRampBalance.sub(amount));
        });

        it("sets the nullifier", async function () {
            const nullifier = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    ["uint256", "uint256", "uint256"], 
                    [signals[4], signals[5], signals[6]]
                )
            );
            const nullifiedBefore = await ramp.nullified(nullifier);
            
            await ramp.connect(onRamper).onRamp(a, b, c, signals);
            
            const nullifiedAfter = await ramp.nullified(nullifier);
            expect(nullifiedBefore).to.equal(false);
            expect(nullifiedAfter).to.equal(true);
        });
    });

    describe.skip("clawback", function () {
        let amount = BigNumber.from(100000000); // $100
        let maxAmountToPay = BigNumber.from(101000000); // $101
        let onRamperVenmoId = BigNumber.from(1234567890);
        let offRamperVenmoId = BigNumber.from(0987654321);
        let orderId;

        let timeSkip = 60 * 60 * 24 * 2; // 2 days

        beforeEach(async function () {
            await ramp.connect(onRamper).register(onRamperVenmoId);
            await ramp.connect(offRamper).register(offRamperVenmoId);
            orderId = await ramp.orderNonce();
            await ramp.connect(onRamper).postOrder(amount, maxAmountToPay);

            await fakeUSDC.connect(offRamper).approve(ramp.address, amount);
            await ramp.connect(offRamper).claimOrder(orderId);

            await time.increase(timeSkip);
        });

        it("set order claim status to clawback", async function () {
            await ramp.connect(offRamper).clawback(orderId);

            const orderClaim = await ramp.orderClaims(orderId, offRamper.address);

            expect(orderClaim.status).to.equal(3);
        });

        it("transfers USDC from the contract to the offRamper", async function () {
            const preOffRampBalance = await fakeUSDC.balanceOf(offRamper.address);
            const preRampBalance = await fakeUSDC.balanceOf(ramp.address);

            await ramp.connect(offRamper).clawback(orderId);

            const postOffRampBalance = await fakeUSDC.balanceOf(offRamper.address);
            const postRampBalance = await fakeUSDC.balanceOf(ramp.address);

            expect(postOffRampBalance).to.equal(preOffRampBalance.add(amount));
            expect(postRampBalance).to.equal(preRampBalance.sub(amount));
        });
    });
});
