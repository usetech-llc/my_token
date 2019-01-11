const BigNumber = web3.BigNumber;
const txRevertRegExp = /VM Exception while processing transaction: revert|invalid opcode/;

class TokenTestHelper {

  constructor() {
  }

  /*
   ERC20 Allowance test
   @token - token contract instance
   @address1 - who allows
   @address2 - allowed
  */
  checkCurrentTimeBeforeGeneralSale(generalSaleDate) {
    var currentTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
    assert.isTrue(currentTime < generalSaleDate, 'Restart TestRPC or update ICO date');
  }

  /*
   ERC20 Allowance test
   @token - token contract instance
   @address1 - who allows
   @address2 - allowed
  */
  async checkAccountForZeroTokenBalance(token, address) {
    new BigNumber(await token.balanceOf(address)).should.be.bignumber.equal(0, 'The owner balance was non-zero');
  }

  /**
   *  Check right minted accounts distribution
   *  Vested balance for every wallet expect to be equals balance
   *  ! shoud be called after contract creation, before transfers
   *
   * @param token - contract
   * @param accounts - accounts list to check
   * @param amounts - expected balances of accounts
   */
  async checkMintedAccounts(token, accounts, amounts) {
    const balances = [];
    for (let i = 0; i < accounts.length; i += 1) {
      let balance = await token.balanceOf(accounts[i]);
      new BigNumber(balance).should.be.bignumber.equal(await token.vestedBalanceOf(accounts[i]), 'Wallet' + accounts[i] + ' vested balance is wrong');
      balances.push(balance);
    }
    for (let i = 0; i < accounts.length; i += 1) {
      web3.toBigNumber(balances[i]).should.be.bignumber.equal(amounts[i], 'Wallet' + accounts[i] + ' balance is wrong')
    }
  }

  /*
  Checking opportunity to send tokens to token wallets
  @token - token contract instance
  @donor - who is the donor of first funds
  @senders - senders wallets
  @recipients - recipients wallets
   */
  async prepareTransfer(token, senders, recipients, amounts) {

    const transfers = [];
    senders.forEach((sender, index) => {
      const newTransfer = {
        to: recipients[index],
        value: amounts[index],
      };
      transfers.push(newTransfer);
    });

    const initialSenderBalances = [];
    const initialRecipientBalances = [];
    const finalSenderBalances = [];
    const finalRecipientBalances = [];

    const senderDiff = [];
    const recipientsDiff = [];

    for (let i = 0; i < senders.length; i += 1) {
      initialSenderBalances.push(new BigNumber(await token.balanceOf(senders[i])));
      initialRecipientBalances.push(new BigNumber(await token.balanceOf(recipients[i])));
      await token.transfer(...Object.values(transfers[i]), {from: senders[i]});
    }

    for (let i = 0; i < senders.length; i += 1) {
      finalSenderBalances.push(new BigNumber(await token.balanceOf(senders[i])));
      finalRecipientBalances.push(new BigNumber(await token.balanceOf(recipients[i])));
      senderDiff.push(initialSenderBalances[i].sub(finalSenderBalances[i]));
      recipientsDiff.push(finalRecipientBalances[i].sub(initialRecipientBalances[i]));
    }

    for (let i = 0; i < senders.length; i += 1) {
      senderDiff[i].should.be.bignumber.equal(transfers[i].value, 'Wallet' +  i + ' balance decreased by transfer value');
      recipientsDiff[i].should.be.bignumber.equal(transfers[i].value, 'Wallet' +  i + ' balance decreased by transfer value');
    }
  }

  /**
   *  Check that assets are freezing before vesting time - use Transfer method
   *
   * @param token - contract
   * @param addressWithVestingLimit - wallet with vesting time in future
   * @param receiverAddress - random receiver
   * @param amount - tokens to test transfer
   */
  async checkTokenTransferringBeforeVestingTime(token, addressWithVestingLimit, receiverAddress, amount){
    const initialReceiverBalance = await token.vestedBalanceOf(receiverAddress);
    await token.transfer(receiverAddress, amount, {from: addressWithVestingLimit});
    await this.checkVestedBalance(token, receiverAddress, new BigNumber(initialReceiverBalance));

    var transferCall = async() => {
      await token.transfer(addressWithVestingLimit, amount, {from: receiverAddress});
    }
    await this.assertThrowsAsync(transferCall, txRevertRegExp);
  }

  /**
   *  Check that assets are freezing before vesting time - use TransferFrom method
   *
   * @param token - contract
   * @param addressWithVestingLimit - wallet with vesting time in future (token owner)
   * @param receiverAddress - random receiver
   * @param amount - tokens to test transfer
   * @param spenderAddress - address that will send transferFrom command
   */
  async checkTokenTransferFromBeforeVestingTime(token, addressWithVestingLimit, receiverAddress, amount, spenderAddress){
    const initialReceiverBalance = await token.vestedBalanceOf(receiverAddress);

    // Approve parameters
    const approve = {
      spender: spenderAddress,
      value: amount
    };

    // TransferFrom parameters
    const transfer = {
      from: addressWithVestingLimit,
      to: receiverAddress,
      value: amount
    };

    await token.approve(...Object.values(approve), {from: addressWithVestingLimit});
    await token.transferFrom(...Object.values(transfer), {from: spenderAddress});
    await this.checkVestedBalance(token, receiverAddress, new BigNumber(initialReceiverBalance));

    var transferCall = async() => {
      await token.transfer(addressWithVestingLimit, amount, {from: receiverAddress});
    }
    await this.assertThrowsAsync(transferCall, txRevertRegExp);
  }

  /**
   *  Check that assets are not freezing after vesting time - use Transfer method
   *
   * @param token - contract
   * @param addressWithVestingLimit - wallet with vesting time in the past
   * @param receiverAddress - random receiver
   * @param amount - tokens to test transfer
   */
  async checkTokenTransferringAfterVestingTime(token, addressWithVestingLimit, receiverAddress, amount){
    const initialReceiverBalance = await token.vestedBalanceOf(receiverAddress);
    await token.transfer(receiverAddress, amount, {from: addressWithVestingLimit});
    await this.checkVestedBalance(token, receiverAddress, new BigNumber(amount).plus(initialReceiverBalance));
    await token.transfer(addressWithVestingLimit, amount, {from: receiverAddress});
  }

  /**
   *  Check that assets are not freezing after vesting time - use TransferFrom method
   *
   * @param token - contract
   * @param addressWithVestingLimit - wallet with vesting time in the past
   * @param receiverAddress - random receiver
   * @param amount - tokens to test transfer
   * @param spenderAddress - address that will send transferFrom command
   */
  async checkTokenTransferFromAfterVestingTime(token, addressWithVestingLimit, receiverAddress, amount, spenderAddress){
    const initialReceiverBalance = await token.vestedBalanceOf(receiverAddress);

    // Approve parameters
    const approve = {
      spender: spenderAddress,
      value: amount
    };

    // TransferFrom parameters
    const transfer = {
      from: addressWithVestingLimit,
      to: receiverAddress,
      value: amount
    };

    await token.approve(...Object.values(approve), {from: addressWithVestingLimit});
    await token.transferFrom(...Object.values(transfer), {from: spenderAddress});
    await this.checkVestedBalance(token, receiverAddress, new BigNumber(amount).plus(initialReceiverBalance));
    await token.transfer(addressWithVestingLimit, amount, {from: receiverAddress});
  }

  /**
   *  Check if vested balance equal to amount
   */
  async checkVestedBalance(token, address, amount){
    new BigNumber(await token.vestedBalanceOf(address)).should.be.bignumber.equal(amount);
  }

  /*
   Increases ether network time while mining new blocks

   @time - new network time
   */
  async increaseTime(time) {
    return new Promise((resolve, reject) => {
      web3.currentProvider.sendAsync({
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [time], // 86400 is num seconds in day
        id: new Date().getTime()
      }, (err, result) => {
        if (err) {
          return reject(err)
        }
        return resolve(result)
      });
    })
  };

  async mineNewBlock() {
    return new Promise((resolve, reject) => {
      web3.currentProvider.sendAsync({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0},
        (err, result) => {
          if (err) {
            return reject(err)
          }
          return resolve(result)
        });
    })
  };

  // Only sets future time, can't go back
  async setTestRPCTime(newtime) {
    const currentTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
    if (newtime > currentTime + 3600) {
      const timeDiff = newtime - currentTime;
      await this.increaseTime(timeDiff);
      await this.mineNewBlock();
    }
  };

    /**
     *  Assert throw error for async functions
     *
     * @param fn - async function
     * @param regExp - error.message pattern
     * @returns {Promise.<void>}
     */
    async assertThrowsAsync(fn, regExp) {
        let f = () => {};
        try {
            await fn();
        } catch(e) {
            f = () => {throw e};
        } finally {
            assert.throws(f, regExp);
        }
    }

  /****************** for Crowdsale ******************/

    /*
     Close main sale ICO from address and return tx block timestamp
     */
    async closeMainSaleICO(crowdsale, address){
        var tt = await crowdsale.closeMainSaleICO({ from: address });
        return web3.eth.getBlock(tt.receipt.blockNumber).timestamp;
    }

    /*
     Check if ICO cannot be closed
     */
    async checkICOClosingDenied(token, crowdsale, address, generalSaleAddress, saleAmountInWei) {
        const initialICOStatus = await crowdsale.isICOActive();

        var closingCall = async() => {
            await this.closeMainSaleICO(crowdsale, address);
        }
        await this.assertThrowsAsync(closingCall, txRevertRegExp);

        // check if tokens not transferred
        (await token.balanceOf(generalSaleAddress)).should.be.bignumber.equal(saleAmountInWei);
        // check ICO status not changed
        await this.checkIcoActive(crowdsale, initialICOStatus);
    }

    /*
     Check if ICO can be closed
     */
    async checkICOClosingAllowed(token, crowdsale, address, generalSaleAddress, playersReserveAddress, restTokenAmountInWei) {
        var closingCall = async() => {
            return (await this.closeMainSaleICO(crowdsale, address));
        }
        (await closingCall()).should.be.bignumber.equal(await crowdsale.generalSaleEndDate());
        // check tokens were transferred
        (await token.balanceOf(generalSaleAddress)).should.be.bignumber.equal(new BigNumber(0));
        (await token.balanceOf(playersReserveAddress)).should.be.bignumber.equal(restTokenAmountInWei);
        // check ICO status is not active
        await this.checkIcoActive(crowdsale, false);
    }

    /*
     Buy all tokens - the goal will be reached after that
     */
    async buyAllTokens(customerAddress, crowdsale, saleGoalInWei) {
        await crowdsale.sendTransaction({ from: customerAddress, to: crowdsale.address, value: saleGoalInWei, gasLimit: 20e9, gasPrice: 100000 });
    }

    /*
     get latest block size
    * @gasPrice
    */

  getLatestBlockCost(gasPrice) {
    return web3.eth.getBlock('latest').gasUsed * gasPrice;
  }

  /*
    Check totalCollected
    @expectedAmount
  */

  async checkTotalCollected(crowdsale, expectedAmount) {
    const totalCollected = await crowdsale.totalCollected();
    assert.equal(totalCollected, expectedAmount, 'Total collected amount should be zero on opening');
  }

  /*
    Has owner test
    @owner - owner address
  */
  async hasOwner(owner, address) {
    assert.isTrue(owner === address);
  }

  /*
   Transfer ownership test
   @crowdsale - crowdsale address,
   @oldOwner - old owner address of crowdsale contract
   @newOwner - new owner address of crowdsale contract
   */
  async checkTransferOwnership(crowdsale, oldOwner, newOwner) {
    await crowdsale.changeOwner(newOwner);
    let owner = await crowdsale.owner();
    assert.isTrue(oldOwner !== owner);
  }

  /*
   Check ico active test
   @crowdsale - crowdsale address,
   @active - ico status for checking
   */
  async checkIcoActive(crowdsale, active) {
    const status = await crowdsale.isICOActive();
    status.should.be.equal(active);
  }

  /*
   Check crowdsale conditions test
   @token - token address
   @crowdsale - crowdsale address,
   @pools - pools of addresses with conditions
   @goal - ico goal amount
   */
  async checkCrowdsaleConditions(token, crowdsale, pools, goal) {
    const tokenDecimals = await token.decimals();
    for (let i = 0; i < pools.length; i +=1) {
      const addressBalance = (await token.balanceOf(pools[i].address)).toNumber();
      assert.equal(pools[i].allocationAmount * 10 ** tokenDecimals, addressBalance, pools[i].name + ' pool tokens should be allocated accordingly to crowdsale conditions');
    }
    // Check ICO goal
    const crowdsaleGoal = (await crowdsale.saleGoal()).toNumber();
    assert.equal(goal, crowdsaleGoal, 'ICO Goal should match crowdsale conditions');
  }

  /*
   Check crowdsale dates test
   @crowdsale - crowdsale address,
   @preSaleStartDate - pre sale start date
   @preSaleEndDate ***
   @generalSaleStartDate ***
   @generalSaleEndDate ***
   */
  async checkIcoStageDates(crowdsale, preSaleStartDate, preSaleEndDate, generalSaleStartDate, generalSaleEndDate) {
    if (preSaleStartDate && preSaleEndDate) {
      assert.equal(preSaleStartDate, (await crowdsale.preSaleStartDate()).toNumber(), 'Pre-sale start date should be set accordingly to crowdsale conditions');
      assert.equal(preSaleEndDate, (await crowdsale.preSaleEndDate()).toNumber(), 'Pre-sale end date should be set accordingly to crowdsale conditions');
    }
    assert.equal(generalSaleStartDate, (await crowdsale.generalSaleStartDate()).toNumber(), 'General sale start date should be set accordingly to crowdsale conditions');
    assert.equal(generalSaleEndDate, (await crowdsale.generalSaleEndDate()).toNumber(), 'General sale end date should be set accordingly to crowdsale conditions');
  }

  /*
   Check receiving ether from crowdsale address test - negative scenario
   @crowdsale - crowdsale address,
   @amount - amount to sale
   */
  async receivingEtherNegative(crowdsale, amount) {
    // conditions:
    // * Current block number (or date if periods set by exact dates) doesn't fall in any of periods.
    // * Receiving a payment with positive amount of Ether attached.

    var sendCall = async() => {
      await crowdsale.send(amount);
    }
    await this.assertThrowsAsync(sendCall, txRevertRegExp);
  }


  /**
   *  Method to check if tokens sale is valid
   *
   * @param crowdsale - contract
   * @param token - contract
   * @param sender - buyer
   * @param generalSaleWalletAddress - sale wallet
   * @param amountInWei - amount to buy (in WEI)
   * @param expectedSpentWei - expected amount of wei to spent (equals to amountInWei except case when crowdsale returns change)
   * @param expectedTokensAmount - expected amount of tokens to receive
   * @param expectedGoalReached - expected value of "goalReached" after tokens buing
   */
  async checkBuyTokens(crowdsale, token, sender, generalSaleWalletAddress, amountInWei, expectedSpentWei, expectedTokensAmount, expectedGoalReached)  {
    const gasPrice = 100000;
    const gasLimit = 20e9;

    const senderBalanceETH = await web3.eth.getBalance(sender);
    const senderBalanceTokens = await token.balanceOf(sender);

    const contractBalanceETH = await web3.eth.getBalance(crowdsale.address);
    const contractBalanceTokens = await token.balanceOf(generalSaleWalletAddress);

    const totalCollected = await crowdsale.totalCollected();

    await crowdsale.sendTransaction({ from: sender, to: crowdsale.address, value: amountInWei, gasLimit: gasLimit, gasPrice: gasPrice });

    const senderETHDiff = (await web3.eth.getBalance(sender)).minus(senderBalanceETH).plus(this.getLatestBlockCost(gasPrice));
    const senderTokensDiff = (await token.balanceOf(sender)).minus(senderBalanceTokens);
    const contractETHDiff = (await web3.eth.getBalance(crowdsale.address)).minus(contractBalanceETH);
    const contractTokensDiff = (await token.balanceOf(generalSaleWalletAddress)).minus(contractBalanceTokens);
    const totalCollectedDiff = (await crowdsale.totalCollected()).minus(totalCollected);

    senderETHDiff.should.be.bignumber.equal(new BigNumber(expectedSpentWei).negated());
    contractETHDiff.should.be.bignumber.equal(new BigNumber(expectedSpentWei));
    senderTokensDiff.should.be.bignumber.equal(new BigNumber(expectedTokensAmount));
    contractTokensDiff.should.be.bignumber.equal(new BigNumber(expectedTokensAmount).negated());
    totalCollectedDiff.should.be.bignumber.equal(new BigNumber(expectedSpentWei));
    const goalReached = await crowdsale.goalReached();
    expectedGoalReached ? assert.isTrue(goalReached) : assert.isFalse(goalReached);
  }

  async checkBuy0Tokens(crowdsale, token, sender, generalSaleWalletAddress){
    var buyTokentCall = async() => {
      await this.checkBuyTokens(crowdsale, token, sender, generalSaleWalletAddress, new BigNumber(0), 0, 0, false);
    }
    this.assertThrowsAsync(buyTokentCall, txRevertRegExp);
  }

  async checkBuyPartOfTokens(crowdsale, token, sender, generalSaleWalletAddress, saleGoalInWei, tokenRate){
    const amountToBuyInWei = new BigNumber(saleGoalInWei).dividedBy(2);
    const amountToBuyInTokens = new BigNumber(amountToBuyInWei).times(tokenRate);

    await this.checkBuyTokens(crowdsale, token, sender, generalSaleWalletAddress, amountToBuyInWei, amountToBuyInWei, amountToBuyInTokens, false);
  }

  async checkBuyAllTokens(crowdsale, token, sender, generalSaleWalletAddress, saleGoalInWei, tokenRate){
    const amountToBuyInTokens = new BigNumber(saleGoalInWei).times(tokenRate);

    await this.checkBuyTokens(crowdsale, token, sender, generalSaleWalletAddress, saleGoalInWei, saleGoalInWei, amountToBuyInTokens, true);
  }

  async checkBuyTokensWithChange(crowdsale, token, sender, generalSaleWalletAddress, saleGoalInWei, tokenRate){
    const gasPrice = 100000;
    const amountToBuyInWei = new BigNumber(saleGoalInWei).plus(web3.toWei(1.0, 'ether'));
    const amountToBuyInTokens = new BigNumber(saleGoalInWei).times(tokenRate);
    const senderBalanceETHBefore = new BigNumber(await web3.eth.getBalance(sender));

    await this.checkBuyTokens(crowdsale, token, sender, generalSaleWalletAddress, amountToBuyInWei, saleGoalInWei, amountToBuyInTokens, true);

    // Check that change was given
    const senderBalanceETHAfter = new BigNumber(await web3.eth.getBalance(sender));
    const senderETHDiff = senderBalanceETHBefore.minus(senderBalanceETHAfter).minus(this.getLatestBlockCost(gasPrice));
    senderETHDiff.should.be.bignumber.equal(saleGoalInWei);
  }

  async checkWithdrawalIsDenied(crowdsale, address, amount){
    const gasPrice = 100000;
    const gasLimit = 20e9;

    const contractBalance = await web3.eth.getBalance(crowdsale.address);
    const senderBalance = await web3.eth.getBalance(address);

    var withdrawalCall = async() => {
      await crowdsale.safeWithdrawal(amount, {from: address, gasLimit: gasLimit, gasPrice: gasPrice});
    }
    this.assertThrowsAsync(withdrawalCall, txRevertRegExp);
    contractBalance.should.be.bignumber.equal(await web3.eth.getBalance(crowdsale.address));
  }

  async checkWithdrawalIsAllowed(crowdsale, address, amount){
    const gasPrice = 100000;
    const gasLimit = 20e9;

    const contractBalance = await web3.eth.getBalance(crowdsale.address);
    const senderBalance = await web3.eth.getBalance(address);

    await crowdsale.safeWithdrawal(amount, {from: address, gasLimit: gasLimit, gasPrice: gasPrice});

    new BigNumber(contractBalance).should.be.bignumber.equal(new BigNumber(await web3.eth.getBalance(crowdsale.address)).plus(amount));
    senderBalance.should.be.bignumber.equal((await web3.eth.getBalance(address)).minus(amount).plus(this.getLatestBlockCost(gasPrice)));
  }

  async killCrowdsalePositive(crowdsale) {
    // save initial owner and contract balances (ETH)
    const owner = await crowdsale.owner();
    const initialOwnerBalance = await web3.eth.getBalance(owner);
    const contractBalance =  await web3.eth.getBalance(crowdsale.address);

    const gasPrice = 1;
    await this.checkIcoActive(crowdsale, false);
    const tx = await crowdsale.kill({gasLimit: 9000000000000000000000000, gasPrice: gasPrice});
    // owner balance (ETH) must be equal: initial balance + killed contract balance - price for gas
    new BigNumber(initialOwnerBalance).plus(contractBalance).minus(tx.receipt.gasUsed).should.be.bignumber.equal((await web3.eth.getBalance(owner)));
  }

  async killCrowdsaleNegative(crowdsale, address) {
    if(typeof address == 'undefined'){
      address = await crowdsale.owner()
    }

    const gasPrice = 1;
    var killCall = async() => {
      await crowdsale.kill({gasLimit: 9000000000000000000000000, gasPrice: gasPrice, from: address});
    }
    await this.assertThrowsAsync(killCall, txRevertRegExp);
    await crowdsale.isICOActive() // check if contract is alive
  }

  /***************************************************/

  /*
   ERC20 transfer test
   @token - token contract instance
   @sender - sender of tokens
   #recipient - recipient of tokens
  */
  async ERC20Transfer(token, sender, recipient) {
  // Set watcher to Transfer event that we are looking for
    const watcher = token.Transfer();
    const transfer1 = {
      to: recipient,
      value: 1
    };

    await token.transfer(...Object.values(transfer1), {from: sender});
    const output = watcher.get();

    const eventArguments = output[0].args;
    const argCount = Object.keys(eventArguments).length;
    const arg1Name = Object.keys(eventArguments)[0];
    const arg1Value = eventArguments[arg1Name];
    const arg2Name = Object.keys(eventArguments)[1];
    const arg2Value = eventArguments[arg2Name];
    const arg3Name = Object.keys(eventArguments)[2];
    const arg3Value = eventArguments[arg3Name];

    argCount.should.be.equal(3, 'Transfer event number of arguments');
    arg1Name.should.be.equal('from', 'Transfer event first argument name');
    arg1Value.should.be.equal(sender, 'Transfer event from address');
    arg2Name.should.be.equal('to', 'Transfer event second argument name');
    arg2Value.should.be.equal(recipient, 'Transfer event to address');
    arg3Name.should.be.equal('tokens', 'Transfer event third argument name');
    arg3Value.should.be.bignumber.equal(transfer1.value, 'Transfer event value');
  }

  /*
   ERC20 transferFrom test
   @token - token contract instance
   @sender - who approved to send
   @owner - owner of approved tokens
   #recipient - recipient of tokens
  */
  async ERC20AllocateTransferFrom(token, sender, owner, recipient) {
// Set watcher to Transfer event that we are looking for
    const watcher = token.Transfer();
    const approvalWatcher = token.Approval();

    // Approve parameters
    const approve = {
      spender: sender,
      value: 100
    };

    // TransferFrom parameters
    const transfer = {
      from: owner,
      to: recipient,
      value: 100
    };

    await token.approve(...Object.values(approve), {from: owner});
    const approvalOutput = approvalWatcher.get();

    // Verify number of Approval event arguments, their names, and content
    let eventArguments = approvalOutput[0].args;
    const arg0Count = Object.keys(eventArguments).length;
    const arg01Name = Object.keys(eventArguments)[0];
    const arg01Value = eventArguments[arg01Name];
    const arg02Name = Object.keys(eventArguments)[1];
    const arg02Value = eventArguments[arg02Name];
    const arg03Name = Object.keys(eventArguments)[2];
    const arg03Value = eventArguments[arg03Name];

    arg0Count.should.be.equal(3, 'Approval event number of arguments');
    arg01Name.should.be.equal('tokenOwner', 'Transfer event first argument name');
    arg01Value.should.be.equal(owner, 'Transfer event from address');
    arg02Name.should.be.equal('spender', 'Transfer event second argument name');
    arg02Value.should.be.equal(sender, 'Transfer event to address');
    arg03Name.should.be.equal('tokens', 'Transfer event third argument name');
    arg03Value.should.be.bignumber.equal(transfer.value, 'Transfer event value');


    await token.transferFrom(...Object.values(transfer), {from: sender});
    const output = watcher.get();

    // Verify number of Transfer event arguments, their names, and content
    eventArguments = output[0].args;
    const argCount = Object.keys(eventArguments).length;
    const arg1Name = Object.keys(eventArguments)[0];
    const arg1Value = eventArguments[arg1Name];
    const arg2Name = Object.keys(eventArguments)[1];
    const arg2Value = eventArguments[arg2Name];
    const arg3Name = Object.keys(eventArguments)[2];
    const arg3Value = eventArguments[arg3Name];

    argCount.should.be.equal(3, 'Transfer event number of arguments');
    arg1Name.should.be.equal('from', 'Transfer event first argument name');
    arg1Value.should.be.equal(owner, 'Transfer event from address');
    arg2Name.should.be.equal('to', 'Transfer event second argument name');
    arg2Value.should.be.equal(recipient, 'Transfer event to address');
    arg3Name.should.be.equal('tokens', 'Transfer event third argument name');
    arg3Value.should.be.bignumber.equal(transfer.value, 'Transfer event value');
  }

  /*
   ERC20 totalSupply test
   @token - contract instance
   @totalS - totalSupply of tokens
  */
  async ERC20TotalSupply(token, totalS) {
    var totalSupply = new BigNumber(await token.totalSupply());
    totalSupply.should.be.bignumber.equal(totalS, 'Token total supply');
  }

  /*
   ERC20 balanceOf test
   @token - contract instance
   @walletAddress - wallet to check balance
  */
  async ERC20BalanceOf(token, walletAddress) {
    await token.balanceOf(walletAddress).should.be.fulfilled;
  }

  /*
   ERC20 Allowance test
   @token - token contract instance
   @address1 - who allows
   @address2 - allowed
  */
  async ERC20Allowance(token, address1, address2) {
    await token.allowance(address1, address2).should.be.fulfilled;
  }
}

module.exports = TokenTestHelper;
