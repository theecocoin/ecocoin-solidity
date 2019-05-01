const truffleAssert = require('truffle-assertions');
const utils = require('./utils.js');

const { BN, constants, expectEvent, shouldFail } = require('openzeppelin-test-helpers');
const { ZERO_ADDRESS } = constants;

const SECONDS_IN_DAY = 86400;
const ONE = new BN('1000000000000000000');
const ONE_RATE = new BN('10000000000000000000000000');

const ERC20DemurrageableMock = artifacts.require('ERC20DemurrageableMock');

var chai = require("chai");
chai.should();
chai.use(require('chai-as-promised'));

contract('ERC20Demurrageable', (accounts) => {
    const initialSupply = ONE.mul(new BN(10000));
    const periodDuration = 30 * SECONDS_IN_DAY;
    const demurrageRate = new BN('9985000000000000000000000'); // 0.15% demurrage rate
    const changedDemurrageRate = new BN('9900000000000000000000000'); // 1% demurrage rate
    const tolerance = new BN(100); // error tolerance due to rounding errors

    before('deploy ERC20Demurrageable contract', async () => {
        startTime = Math.floor(Date.now() / 1000);
        accountOne = accounts[0];
        accountTwo = accounts[1];
        demurrageToken = await ERC20DemurrageableMock.new(demurrageRate, 25, startTime, periodDuration);
        await demurrageToken.mint(accountOne, initialSupply);
    });
    beforeEach(async () => {
        snapShot = await utils.takeSnapshot();
        snapshotId = snapShot['result'];
    });
    afterEach(async () => {
        await utils.revertToSnapShot(snapshotId);
    });

    describe('total supply', function () {
        describe('when in the 1st demurrage period', function () {
            it('matches initial supply', async () => {
                (await demurrageToken.totalSupply()).should.be.bignumber.equal(initialSupply);
            });
        });

        describe('when in the 2nd demurrage period', function () {
            it('total supply is reduced by demurrage rate', async () => {
                utils.advanceTimeAndBlock(periodDuration);
                (await demurrageToken.totalSupply()).should.be.bignumber.equal(initialSupply.mul(demurrageRate).div(ONE_RATE));
            });
        });
    });

    describe('balanceOf', function () {
        describe('when in the beginning of the 1st demurrage period', function () {
            it('no demurrage taken from account\'s balance', async () => {
                (await demurrageToken.balanceOf(accountOne)).should.be.bignumber.equal(initialSupply);
            });
        });

        describe('when in the middle of the 1st demurrage period', function () {
            it('no demurrage taken from account\'s balance', async () => {
                utils.advanceTimeAndBlock(periodDuration / 2);
                (await demurrageToken.balanceOf(accountOne)).should.be.bignumber.equal(initialSupply);
            });
        });

        describe('when in the 2nd demurrage period', function () {
            it('balance of account is reduced by demurrage rate', async () => {
                utils.advanceTimeAndBlock(periodDuration);
                (await demurrageToken.balanceOf(accountOne)).should.be.bignumber.equal(initialSupply.mul(demurrageRate).div(ONE_RATE));
            });
        });

        describe('when in the 13th demurrage period (after one year)', function () {
            it('balance of account is reduced by demurrage 12 times', async () => {
                utils.advanceTimeAndBlock(periodDuration * 12);
                let expectedBalance = initialSupply;
                for(let i=0; i<12; i++) {
                    expectedBalance = expectedBalance.mul(demurrageRate).div(ONE_RATE);
                }
                assertWithinTolerance((await demurrageToken.balanceOf(accountOne)), expectedBalance);
            });
        });

        describe('when in the 120th period (after ten years)', function () {
            it('balance of account is reduced by demurrage 120 times', async () => {
                utils.advanceTimeAndBlock(periodDuration * 12 * 10);
                let expectedBalance = initialSupply;
                for(let i=0; i<120; i++) {
                    expectedBalance = expectedBalance.mul(demurrageRate).div(ONE_RATE);
                }
                assertWithinTolerance((await demurrageToken.balanceOf(accountOne)), expectedBalance);
            });
        })

        describe('when there is a change to the demurrage rate scheduled', function () {
            describe('when the change has activated / is in the past', function () {
                it('balance is demurraged by the changed rate', async () => {
                    await truffleAssert.passes(demurrageToken.scheduleDemurrageChange(1, changedDemurrageRate));
                    utils.advanceTimeAndBlock(periodDuration * 2);
                    let expectedBalance = initialSupply;
                    expectedBalance = expectedBalance.mul(demurrageRate).div(ONE_RATE);
                    expectedBalance = expectedBalance.mul(changedDemurrageRate).div(ONE_RATE);
                    (await demurrageToken.balanceOf(accountOne)).should.be.bignumber.equal(expectedBalance);
                });
            });

            describe('when the change is in the future / is not activated', function () {
                it('future demurrage change is not taken into account', async () => {
                    await truffleAssert.passes(demurrageToken.scheduleDemurrageChange(1, changedDemurrageRate));
                    utils.advanceTimeAndBlock(periodDuration * 1);
                    let expectedBalance = initialSupply.mul(demurrageRate).div(ONE_RATE);
                    (await demurrageToken.balanceOf(accountOne)).should.be.bignumber.equal(expectedBalance);
                });
            });
        })
    });

    describe('transfer', function () {
        describe('when in the 1st demurrage period', function () {
            it('sends tokens correctly', async () => {
                await transferAndAssert();
            });
        });
        
        describe('when in the 2nd demurrage perdiod', function () {
            it('sends tokens correctly when sender has tokens that need to be demurraged and receiver has no tokens', async () => {
                utils.advanceTimeAndBlock(periodDuration);
                await transferAndAssert();
            });

            it('sends tokens correctly when sender and receiver have tokens that need to be demurraged', async () => {
                await demurrageToken.mint(accountTwo, initialSupply);
                utils.advanceTimeAndBlock(periodDuration);
                await transferAndAssert();
            });
        });
    });

    describe('transfer from', function () {
        describe('when in the 1st demurrage period', function () {
            it('sends tokens correctly', async () => {
                await approveAndTransferFromAndAssert();
            });
        });
        
        describe('when in the 2nd demurrage perdiod', function () {
            it('sends tokens correctly when sender has tokens that need to be demurraged and receiver has no tokens', async () => {
                utils.advanceTimeAndBlock(periodDuration);
                await approveAndTransferFromAndAssert();
            });

            it('sends tokens correctly when sender and receiver have tokens that need to be demurraged', async () => {
                await demurrageToken.mint(accountTwo, initialSupply);
                utils.advanceTimeAndBlock(periodDuration);
                await approveAndTransferFromAndAssert();
            });
        });
    });

    describe('mint', function () {
        describe('when in the 1st demurrage period', function () {
            it('mints the correct number of tokens', async () => {
                await mintAndAssert();
            });
        });

        describe('when in the 2nd demurrage perdiod', function () {
            it('mints the correct number of tokens after demurrage', async () => {
                utils.advanceTimeAndBlock(periodDuration);
                await mintAndAssert();
            });
        });
    });

    describe('burn', function () {
        describe('when in the 1st demurrage period', function () {
            it('burns the correct number of tokens', async () => {
                await burnAndAssert();
            });
        });

        describe('when in the 2nd demurrage perdiod', function () {
            it('burns the correct number of tokens afetr demurrage', async () => {
                utils.advanceTimeAndBlock(periodDuration);
                await burnAndAssert();
            });
        });
    });

    describe('rpow', function () {
        it('calculates 99% by the power of 3 correctly', async () => {
            const ONE = new BN(100000);
            const NINETYNINE_PERCENT = new BN(99000);
            (await demurrageToken.rpow(NINETYNINE_PERCENT, 3, ONE)).should.be.bignumber.equal(new BN(97030));
        });
    });

    describe('schedule demurrage change', function () {
        it('accepts change for the next period', async () => {
            await truffleAssert.passes(demurrageToken.scheduleDemurrageChange(1, changedDemurrageRate));
        });

        it('emits a ScheduleDemurrageChange event', async () => {
            let changePeriod = 1;
            let tx = await demurrageToken.scheduleDemurrageChange(changePeriod, changedDemurrageRate);
            truffleAssert.eventEmitted(tx, 'ScheduleDemurrageChange', (ev) => {
                return ev.timestamp.toNumber() === startTime + periodDuration && ev.period.toNumber() === changePeriod && ev.rate.toString() === changedDemurrageRate.toString();
            });
        });

        it('rejects change for ongoing period', async () => {
            await truffleAssert.reverts(demurrageToken.scheduleDemurrageChange(0, changedDemurrageRate));
        });

        it('rejects change for past period', async () => {
            utils.advanceTimeAndBlock(periodDuration * 2);
            await truffleAssert.reverts(demurrageToken.scheduleDemurrageChange(1, changedDemurrageRate));
        });

        it('rejects change for a future period that already has a change', async () => {
            await truffleAssert.passes(demurrageToken.scheduleDemurrageChange(1, changedDemurrageRate));
            await truffleAssert.reverts(demurrageToken.scheduleDemurrageChange(1, demurrageRate));
        });
    });

    // TODO: add limits to permitted demurrageChanges

    // TODO: permissions check (owner) on scheduleDemurrageChange

    describe('persist balance demurrage', function () {
        it('does not change the balance', async () => {
            utils.advanceTimeAndBlock(periodDuration);
            await truffleAssert.passes(demurrageToken.persistBalanceDemurrage(accountOne));
            let expectedBalance = initialSupply.mul(demurrageRate).div(ONE_RATE);
            (await demurrageToken.balanceOf(accountOne)).should.be.bignumber.equal(expectedBalance);
        });
    });

    describe('persist total supply demurrage', function () {
        it('does not change the total supply', async () => {
            utils.advanceTimeAndBlock(periodDuration);
            await truffleAssert.passes(demurrageToken.persistTotalSupplyDemurrage());
            let expected = initialSupply.mul(demurrageRate).div(ONE_RATE);
            (await demurrageToken.totalSupply()).should.be.bignumber.equal(expected);
        });
    });

    async function transferAndAssert() {
        // Get initial balances of first and second account.
        const accountOneStartingBalance = (await demurrageToken.balanceOf.call(accountOne)).valueOf();
        const accountTwoStartingBalance = (await demurrageToken.balanceOf.call(accountTwo)).valueOf();

        // Make transaction from first account to second.
        const amount = ONE.mul(new BN(100));
        let tx = await demurrageToken.transfer(accountTwo, amount, {from: accountOne});

        // Get balances of first and second account after the transactions.
        const accountOneEndingBalance = (await demurrageToken.balanceOf.call(accountOne)).valueOf();
        const accountTwoEndingBalance = (await demurrageToken.balanceOf.call(accountTwo)).valueOf();

        assert.equal(accountOneEndingBalance.toString(), accountOneStartingBalance.sub(amount).toString(), "Amount wasn't correctly taken from the sender");
        assert.equal(accountTwoEndingBalance.toString(), accountTwoStartingBalance.add(amount).toString(), "Amount wasn't correctly sent to the receiver");

        truffleAssert.eventEmitted(tx, 'Transfer', (ev) => {
            return ev.value.toString() === amount.toString() && ev.from === accountOne && ev.to === accountTwo;
        });
    }

    async function approveAndTransferFromAndAssert() {
        // Get initial balances of first and second account.
        const accountOneStartingBalance = (await demurrageToken.balanceOf.call(accountOne)).valueOf();
        const accountTwoStartingBalance = (await demurrageToken.balanceOf.call(accountTwo)).valueOf();

        // Make transaction from first account to second.
        const amount = ONE.mul(new BN(100));
        await demurrageToken.approve(accountTwo, amount, {from: accountOne});
        let tx = await demurrageToken.transferFrom(accountOne, accountTwo, amount, {from: accountTwo});

        // Get balances of first and second account after the transactions.
        const accountOneEndingBalance = (await demurrageToken.balanceOf.call(accountOne)).valueOf();
        const accountTwoEndingBalance = (await demurrageToken.balanceOf.call(accountTwo)).valueOf();

        assert.equal(accountOneEndingBalance.toString(), accountOneStartingBalance.sub(amount).toString(), "Amount wasn't correctly taken from the sender");
        assert.equal(accountTwoEndingBalance.toString(), accountTwoStartingBalance.add(amount).toString(), "Amount wasn't correctly sent to the receiver");

        truffleAssert.eventEmitted(tx, 'Transfer', (ev) => {
            return ev.value.toString() === amount.toString() && ev.from === accountOne && ev.to === accountTwo;
        });
    }

    async function mintAndAssert() {
        const accountOneStartingBalance = (await demurrageToken.balanceOf.call(accountOne)).valueOf();
        const totalSupplyStartingBalance = (await demurrageToken.totalSupply.call()).valueOf();

        const amount = ONE.mul(new BN(100));
        let tx = await demurrageToken.mint(accountOne, amount);

        const accountOneEndingBalance = (await demurrageToken.balanceOf.call(accountOne)).valueOf();
        const totalSupplyEndingBalance = (await demurrageToken.totalSupply.call()).valueOf();

        assert.equal(accountOneEndingBalance.toString(), accountOneStartingBalance.add(amount).toString(), "Amount wasn't correctly added to account");
        assert.equal(totalSupplyEndingBalance.toString(), totalSupplyStartingBalance.add(amount).toString(), "Amount wasn't correctly added to totalSupply");

        truffleAssert.eventEmitted(tx, 'Transfer', (ev) => {
           return ev.from.toString() === "0x0000000000000000000000000000000000000000" && ev.value.toString() === amount.toString() && ev.to === accountOne;
        });
    }

    async function burnAndAssert() {
        const accountOneStartingBalance = (await demurrageToken.balanceOf.call(accountOne)).valueOf();
        const totalSupplyStartingBalance = (await demurrageToken.totalSupply.call()).valueOf();

        const amount = ONE.mul(new BN(100));
        await demurrageToken.burn(amount);

        const accountOneEndingBalance = (await demurrageToken.balanceOf.call(accountOne)).valueOf();
        const totalSupplyEndingBalance = (await demurrageToken.totalSupply.call()).valueOf();

        assert.equal(accountOneEndingBalance.toString(), accountOneStartingBalance.sub(amount).toString(), "Amount wasn't correctly taken from account");
        assert.equal(totalSupplyEndingBalance.toString(), totalSupplyStartingBalance.sub(amount).toString(), "Amount wasn't correctly taken from totalSupply");
    }

    function assertWithinTolerance(actual, expected) {
        actual.should.be.bignumber.lessThan(expected.add(tolerance));
        actual.should.be.bignumber.greaterThan(expected.sub(tolerance));
    }
});
