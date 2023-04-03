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

    describe("register", function () {
        const venmoId = BigNumber.from(1234567890);

        it("registers a user and their venmo id", async function () {
            await ramp.connect(onRamper).register(venmoId);

            const storedVenmoId = await ramp.userToVenmoId(onRamper.address);
            const storedUser = await ramp.venmoIdToUser(venmoId);
            expect(storedVenmoId).to.equal(venmoId);
            expect(storedUser).to.equal(onRamper.address);
        });
    });

    describe("postOrder", function () {
        let amount = BigNumber.from(100000000); // $100
        let maxAmountToPay = BigNumber.from(101000000); // $101

        beforeEach(async function () {
            await ramp.connect(onRamper).register(BigNumber.from(1234567890));
        });

        it("stores an order", async function () {
            const orderId = await ramp.orderNonce();

            const unopenedOrder = await ramp.orders(orderId);

            expect(unopenedOrder.amountToReceive).to.equal(ZERO);
            expect(unopenedOrder.maxAmountToPay).to.equal(ZERO);
            expect(unopenedOrder.status).to.equal(0);

            await ramp.connect(onRamper).postOrder(amount, maxAmountToPay);

            const openOrder = await ramp.orders(orderId);

            expect(openOrder.amountToReceive).to.equal(amount);
            expect(openOrder.maxAmountToPay).to.equal(maxAmountToPay);
            expect(openOrder.status).to.equal(1);
        });
    });

    describe("claimOrder", function () {
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

    describe("cancelOrder", function () {
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

    describe.only("onRamp", function () {
        let amount = BigNumber.from(100000000); // $100
        let maxAmountToPay = BigNumber.from(101000000); // $101
        let onRamperVenmoId = BigNumber.from("1168869611798528966");
        let offRamperVenmoId = BigNumber.from("645716473020416186");
        let orderId=42;

        let a = ["0x2103407ea4cf27ed53d91f0496b8f9d8a90cae070b37699c99ea9eff7a4bd273", "0x256fbf5b06f498069a1aa3cc2fefee0c4bbed862a9bfea0637ca6fb2eefb35e1"];
        let b = [["0x293d3d189f7f3d116871b6c1e0edaa130c4b6dc23743a1eb42a130bfa180979e", "0x1e07a640032553efc0c26e21f6edaa5b6690b1c47a1e65253a95cbb4db909d1a"],["0x221107159e98eb4636f23846381a9501b53569bcbc67f8e5f90268271b3913aa", "0x235482db81b1e217d105d9535588e1de82923de69f0383dc9bed4cf6f66e356b"]];
        let c = ["0x2675b250073123a3f820ceb634c3f1c680de66b11aa1c9506d2cff1b7170d718", "0x2e564c8158265f8a7202592c454eccd0eecc9afd0ce37a8ad63f9067424c2406"];
        let signals = ["0x0000000000000000000000000000000000000000000000000039363838363131","0x0000000000000000000000000000000000000000000000000035383937313136","0x0000000000000000000000000000000000000000000000000000003636393832","0x0000000000000000000000000000000000000000000000000034363137353436","0x0000000000000000000000000000000000000000000000000031343032303337","0x0000000000000000000000000000000000000000000000000000000036383136","0x0000000000000000000000000000000000000000000000000000000000003234","0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000000000000000000000000000","0x000000000000000000000000000000000083a043f3f512cb0e9efb506011e359","0x0000000000000000000000000000000000c2e52cefcd800a155366e0207f2563","0x0000000000000000000000000000000000f3576e6387ca2c770760edd72b0fae","0x00000000000000000000000000000000019143a1fc85a71614784b98ff4b16c0","0x00000000000000000000000000000000007bbd0dfb9ef73cf08f4036e24a6b72","0x000000000000000000000000000000000119d3bd704f04dc4f74482cdc239dc7","0x0000000000000000000000000000000001d083a581190a93434412d791fa7fd1","0x000000000000000000000000000000000064350c632569b077ed7b300d3a4051","0x00000000000000000000000000000000000000000000000000a879c82b6c5e0a","0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000000000000000000000000000"];

        beforeEach(async function () {
            await ramp.connect(onRamper).register(onRamperVenmoId);
            await ramp.connect(offRamper).register(offRamperVenmoId);

            for (let i = 0; i < 44; i++) {
                await ramp.connect(onRamper).postOrder(amount, maxAmountToPay);
            }

            await fakeUSDC.connect(offRamper).approve(ramp.address, amount);
            await ramp.connect(offRamper).claimOrder(orderId);
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
    });

    describe("clawback", function () {
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
