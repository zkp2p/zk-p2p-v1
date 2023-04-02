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
        let onRamperVenmoId = BigNumber.from(1234567890);
        let offRamperVenmoId = BigNumber.from(0987654321);
        let orderId;

        let a = ["11085549688134726611150668540316880174659412339988080564703955228381423383254","10764560936774569561507953473055258281269875641315110458189885027430599227931"];
        let b = [
            ["1652351732733835594290426025273481121922973119332515211203377506562979313179","3331499860590706998327509944446821922577464202175999797314203077137501408618"],
            ["5458914108714346890570069128843899252513570499415944280659595267796268262091","16984180778412929730507913588139847520925451119909239694733069369857547223112"]
        ];
        let c = ["10563739695688687522984101191441695778164716170984181738506960046076767863468","19062263244482863555090591167988832524860354662683990422026033566204064004079"];
        let signals = [
            "16103688761651505",
            "14979992155926838",
            "232837953586",
            "14696283796485174",
            "13849655463916343",
            "909652278",
            "12852",
            "0",
            "0",
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

        beforeEach(async function () {
            await ramp.connect(onRamper).register(onRamperVenmoId);
            await ramp.connect(offRamper).register(offRamperVenmoId);
            orderId = await ramp.orderNonce();
            await ramp.connect(onRamper).postOrder(amount, maxAmountToPay);

            await fakeUSDC.connect(offRamper).approve(ramp.address, amount);
            await ramp.connect(offRamper).claimOrder(orderId);
        });

        it("sets the order to filled", async function () {
            await ramp.connect(onRamper).onRamp(a, b, c, signals);

            // const order = await ramp.orders(orderId)

            // expect(order.status).to.equal(2);
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
