const BigNumber = web3.BigNumber;
BigNumber.config({ DECIMAL_PLACES: 18, ROUNDING_MODE: BigNumber.ROUND_DOWN });
const TokenTestHelper = require('./tokenTestHelper');
const VMException = "VM Exception";

const tokenTestHelper = new TokenTestHelper();
require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

async function expectToRevert(errorText, func) {
  try {
    await func();
    throw(Error("Call did not revert"));
  } catch (error) {
    if (!error.toString().includes(errorText))
      throw(error);
  }
}

contract('MyToken', function (accounts) {
  const TokenFactory = artifacts.require('./../contracts/MyToken.sol');
  let token;

  /* accounts */
  let tokenOwnerAddress = accounts[1];
  let userAddress = accounts[2];
  let spenderAddress = accounts[3];
  let admin = accounts[4];
  let permissionlessUser = accounts[5];
  let tokenSymbol = "XXX";
  let totalSupply = web3.toBigNumber('1000000000000000000000000000');

  /* constants */
  const ONE = web3.toBigNumber("1000000000000000000");

  async function successfulMultitransfer(fromAddr, addresses, amounts) {
    var initialBalance = [];
    var finalBalance = [];
    var senderBalanceBefore = new BigNumber(0);
    var senderBalanceAfter = new BigNumber(0);
    var totalAmount = new BigNumber(0);

    // Check initial balances of addresses
    for (var i=0; i<addresses.length; i++) {
      initialBalance[i] = await token.balanceOf(addresses[i]);
      totalAmount = totalAmount.add(amounts[i]);
    }
    senderBalanceBefore = await token.balanceOf(fromAddr);

    // Make the transfer
    await token.multiTransfer(addresses, amounts, {from: fromAddr});

    // Check final balances of addresses
    for (var i=0; i<addresses.length; i++) {
      finalBalance[i] = await token.balanceOf(addresses[i]);
    }
    senderBalanceAfter = await token.balanceOf(fromAddr);

    // Verify that all recipients received correct amounts
    for (var i=0; i<addresses.length; i++) {
      finalBalance[i].minus(initialBalance[i])
        .should.be.bignumber.equal(amounts[i]);
    }
    senderBalanceBefore.minus(senderBalanceAfter)
      .should.be.bignumber.equal(totalAmount);
  }

  describe('MyToken tests', async () => {
    before(async function () {
      token = await TokenFactory.new({gas: 3000000});
    });

    describe('Common token tests', async() => {
      //#### 1. Contract default parameters.
      it('Should put 0 in the owners account', async () => {
        const balance = await token.balanceOf(accounts[0]);
        balance.should.be.bignumber.equal(0);
      });

      it('Token symbol', async () => {
        const actualTokenSymbol = await token.symbol();
        actualTokenSymbol.should.be.equal(tokenSymbol);
      });

      it('Owner can set admin', async () => {
        await token.setAdmin(admin);
      });

      it('Non-owner cannot set admin', async () => {
        await expectToRevert(VMException, async () => {
          await token.setAdmin(admin, {from: accounts[4]});
        });
      });

      it('Should put full total supply amount in tokenOwnerAddress', async () => {
        const balance = await token.balanceOf(tokenOwnerAddress);
        balance.should.be.bignumber.equal(totalSupply);
      });

      it('Tokens should be immediately transferrable', async () => {
        // let's transfer some tokens to test addresses senders
        const amount = web3.toBigNumber(1);
        const senderBalanceBefore = await token.balanceOf(tokenOwnerAddress);
        const receiverBalanceBefore = await token.balanceOf(userAddress);
        await token.transfer(userAddress, amount, {from: tokenOwnerAddress});
        const senderBalanceAfter = await token.balanceOf(tokenOwnerAddress);
        const receiverBalanceAfter = await token.balanceOf(userAddress);

        receiverBalanceAfter.minus(receiverBalanceBefore)
          .should.be.bignumber.equal(amount);
        senderBalanceBefore.minus(senderBalanceAfter)
          .should.be.bignumber.equal(amount);
      });
    });

    describe('ERC20 Comliance Tests', async() => {
      it('Transfer generates correct Transfer event', async () => {
        await tokenTestHelper.ERC20Transfer(token, tokenOwnerAddress, userAddress)
      });

      it('Repeated Transfer', async () => {
        await tokenTestHelper.ERC20Transfer(token, tokenOwnerAddress, userAddress)
      });

      it('Allocate + TransferFrom generates correct Approval and Transfer event', async () => {
        await tokenTestHelper.ERC20AllocateTransferFrom(token, spenderAddress, tokenOwnerAddress, userAddress)
      });

      it('Repeated TransferFrom', async () => {
        await tokenTestHelper.ERC20AllocateTransferFrom(token, spenderAddress, tokenOwnerAddress, userAddress)
      });

      it('totalSupply', async () => {
        await tokenTestHelper.ERC20TotalSupply(token, totalSupply);
      });

      it('balanceOf', async () => {
        await tokenTestHelper.ERC20BalanceOf(token, accounts[0]);
      });

      it('allowance', async () => {
        await tokenTestHelper.ERC20Allowance(token, accounts[1], accounts[0]);
      });
    })


    describe('Burning Tokens', async() => {
      before(async function () {
        // Transfer 1000 tokens to each user in test
        const amount = web3.toBigNumber(1000);
        await token.transfer(accounts[0], amount, {from: tokenOwnerAddress});
        await token.transfer(admin, amount, {from: tokenOwnerAddress});
        await token.transfer(permissionlessUser, amount, {from: tokenOwnerAddress});
      });

      it('Contract owner should be able to burn tokens', async () => {
        const amount = web3.toBigNumber(1);
        const balanceBefore = await token.balanceOf(accounts[0]);
        await token.destroy(amount, {from: accounts[0]});
        const balanceAfter = await token.balanceOf(accounts[0]);

        balanceBefore.minus(balanceAfter)
          .should.be.bignumber.equal(amount);
      });

      it('Admin should be able to burn tokens', async () => {
        const amount = web3.toBigNumber(1);
        const balanceBefore = await token.balanceOf(admin);
        await token.destroy(amount, {from: admin});
        const balanceAfter = await token.balanceOf(admin);

        balanceBefore.minus(balanceAfter)
          .should.be.bignumber.equal(amount);
      });

      it('Contract owner should NOT be able to burn more tokens than they have', async () => {
        const amount = web3.toBigNumber(2000);
        const balanceBefore = await token.balanceOf(accounts[0]);
        await expectToRevert(VMException, async () => {
          await token.destroy(amount, {from: accounts[0]});
        });
        const balanceAfter = await token.balanceOf(accounts[0]);

        balanceBefore.should.be.bignumber.equal(balanceAfter);
      });

      it('Admin should NOT be able to burn more tokens than they have', async () => {
        const amount = web3.toBigNumber(2000);
        const balanceBefore = await token.balanceOf(admin);
        await expectToRevert(VMException, async () => {
          await token.destroy(amount, {from: admin});
        });
        const balanceAfter = await token.balanceOf(admin);

        balanceBefore.should.be.bignumber.equal(balanceAfter);
      });

      it('Other addresses should NOT be able to burn', async () => {
        const amount = web3.toBigNumber(1);
        const balanceBefore = await token.balanceOf(permissionlessUser);
        await expectToRevert(VMException, async () => {
          await token.destroy(amount, {from: permissionlessUser});
        });
        const balanceAfter = await token.balanceOf(permissionlessUser);

        balanceBefore.should.be.bignumber.equal(balanceAfter);
      });

    }); // Burning Tokens

    describe('Massive transfer', async() => {
      before(async function () {
        // Setup: Transfer 10000 tokens to admin
        const amount = ONE.mul(10000);
        await token.transfer(admin, amount, {from: tokenOwnerAddress});
      });

      it('Transfer tokens to 3 addresses', async () => {
        var amounts = [ONE, ONE.div(2), ONE.mul(2)];
        var recipients = [accounts[5], accounts[6], accounts[7]];
        await successfulMultitransfer(admin, recipients, amounts);
      });

      it('Stress test: Transfer tokens to 700 addresses', async () => {
        var amount = web3.toBigNumber(1);
        var amounts = []
        var recipients = [];
        var addressCount = 700;
        for (var i=0; i<addressCount; i++) {
          amounts.push(amount);
          recipients.push(accounts[5]);
        }

        var tx = await token.multiTransfer(recipients, amounts, {from: admin});
        console.log(`Gas used: ${tx.receipt.gasUsed}`);
      });

    }); // Massive transfer

  });

});
