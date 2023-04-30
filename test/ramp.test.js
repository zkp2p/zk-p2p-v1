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

    let deployer;
    let onRamper;
    let offRamper;

    beforeEach(async function () {
        [deployer, onRamper, offRamper] = await hre.ethers.getSigners();

        const FakeUSDC = await hre.ethers.getContractFactory("FakeUSDC");
        fakeUSDC = await FakeUSDC.deploy("Fake USDC", "fUSDC", 10000000000000);

        await fakeUSDC.connect(deployer).transfer(offRamper.address, 1000000000); // $1000

        const Ramp = await hre.ethers.getContractFactory("Ramp");
        ramp = await Ramp.deploy(venmoRsaKey, fakeUSDC.address);
    });

    describe("postOrder", function () {
        let amount = BigNumber.from(100000000); // $100
        let maxAmountToPay = BigNumber.from(110000000); // $110

        it("stores an order", async function () {
            const publicKey = "a19eb5cdd6b3fce15832521908e4f66817e9ea8728dde4469f517072616a590be610c8af6d616fa77806b4d3ac1176634f78cd29266b4bdae4110ac3cdeb9231";

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
        let amount = BigNumber.from(29000000); // $29 (on ramper's perspective)
        let maxAmountToPay = BigNumber.from(32000000); // $20 (from on-ramper's perspective)
        let minAmountToPay = BigNumber.from(30000000); // $30 (off-ramper's bidding)
        let claimId = BigNumber.from(0);
        let offRamperVenmoId = BigNumber.from("14286706241468003283295067045089601281912688124398815891602745783310727407967");
        let orderId=1;

        let a = ["0x05f34ff4b36a95c3edd17bb02fb39a2560b282459cd91cd00a0fca2ceed8d9e2", "0x09dec8e8a3b5fc5d32496fa2b412ebe53ed2bda8046f1c47a2ad80abb7c0c70a"];
        let b = [["0x0d7de7a45604b118248f16c79a5c78d11d30898898a428cf07b9d7bdf722baba", "0x07a3e20a8861b3fda2c4525b6b484cee4b40822451dc8db2324f1bb515d41df5"],["0x1e92254eccc0f5c3e95f8645557204302341d454c9a8d17f7f0a5bfc05e02808", "0x17c3d119796e3d9b04165ac8823f774d4855a462bfef52456ae28c2b5231f2e7"]];
        let c = ["0x003e17fe3fe5e011c72c1e78a760e3b8b0baba5c55e296da5c0561e3a5c36586", "0x0732deb1229407fab505bc7b3313c88c0fb7cf67275267324d42f55fbde06cfa"];
        let signals = ["0x1f95fd3aa3a0f764e2eae57d17816218da1f577ce7722e51249e2f28fa5a695f","0x0000000000000000000000000000000000000000000000000000000000003033","0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000000000000000000000000000","0x000000000000000000000000000000000083a043f3f512cb0e9efb506011e359","0x0000000000000000000000000000000000c2e52cefcd800a155366e0207f2563","0x0000000000000000000000000000000000f3576e6387ca2c770760edd72b0fae","0x00000000000000000000000000000000019143a1fc85a71614784b98ff4b16c0","0x00000000000000000000000000000000007bbd0dfb9ef73cf08f4036e24a6b72","0x000000000000000000000000000000000119d3bd704f04dc4f74482cdc239dc7","0x0000000000000000000000000000000001d083a581190a93434412d791fa7fd1","0x000000000000000000000000000000000064350c632569b077ed7b300d3a4051","0x00000000000000000000000000000000000000000000000000a879c82b6c5e0a","0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000000000000000000000000001"];


        beforeEach(async function () {
            await ramp.connect(onRamper).postOrder(amount, maxAmountToPay, onRamper.address);
            await fakeUSDC.connect(offRamper).approve(ramp.address, amount);
            await ramp.connect(offRamper).claimOrder(offRamperVenmoId, orderId, "69", minAmountToPay);
        });

        it("sets the order to filled", async function () {
            await ramp.connect(onRamper).onRamp(a, b, c, signals, claimId);

            const order = await ramp.orders(orderId)

            expect(order.status).to.equal(2);
        });

        it("transfers funds to the on ramper", async function () {
            const preOnRampBalance = await fakeUSDC.balanceOf(onRamper.address);
            const preRampBalance = await fakeUSDC.balanceOf(ramp.address);

            await ramp.connect(onRamper).onRamp(a, b, c, signals, claimId);

            const postOnRampBalance = await fakeUSDC.balanceOf(onRamper.address);
            const postRampBalance = await fakeUSDC.balanceOf(ramp.address);

            expect(postOnRampBalance).to.equal(preOnRampBalance.add(amount));
            expect(postRampBalance).to.equal(preRampBalance.sub(amount));
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
