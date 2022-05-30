const DexfToken = artifacts.require('DEXF');
const PancakeSwapV2Router = artifacts.require('PancakeSwapV2Router');
const dexfTokenABI = require('./abis/DEXF.json');
const pancakeSwapV2RouterABI = require('./abis/PancakeSwapV2Router.json');
const truffleAssert = require('truffle-assertions');
const BigNumber = require('bignumber.js');

const {
  callMethod,
  moveAtEpoch
}  =  require('./utils');

contract("DEXF", async (accounts) => {
  const deployer = accounts[0];
  const Alice = accounts[1];
  const Bob = accounts[2];
  const Christian = accounts[3];

  let dexfTokenInstance;
  let pancakeSwapV2RouterInstance;
  let dexfToken;
  let pancakeSwapV2Router;

  let _treasury;
  let _team;
  let _stakingPool;

  let WETHAddr;

  before(async () => {
    dexfTokenInstance = await DexfToken.at(dexfTokenABI.address);
    pancakeSwapV2RouterInstance = await PancakeSwapV2Router.at(pancakeSwapV2RouterABI.address);
    dexfToken = await new web3.eth.Contract(dexfTokenABI.abi, dexfTokenInstance.address);
    pancakeSwapV2Router = await new web3.eth.Contract(pancakeSwapV2RouterABI.abi, pancakeSwapV2RouterABI.address);

    _treasury = await callMethod(
      dexfToken.methods._treasury,
      []
    );
    _team = await callMethod(
      dexfToken.methods._team,
      []
    );
    _stakingPool = await callMethod(
      dexfToken.methods._stakingPool,
      []
    );

    WETHAddr = await callMethod(
      pancakeSwapV2Router.methods.WETH,
      []
    );
  });

  it("Create liquidity", async function () {
    const currentBlockNumber = await new web3.eth.getBlockNumber();
    const currentBlock = await new web3.eth.getBlock(currentBlockNumber);
    const lastTimestamp = currentBlock.timestamp;
    time1 = lastTimestamp;

    // approve dexf for pancakeSwapV2Router
    const tokenAmount = new BigNumber(10000000E18).toString(10);
    const bnbAmount = new BigNumber(1000E18).toString(10);
    await dexfTokenInstance.approve(
      pancakeSwapV2RouterABI.address,
      tokenAmount,
      { from: deployer, gasLimit: 4000000 }
    );

    // add the liquidity
    await pancakeSwapV2RouterInstance.addLiquidityETH(
      dexfTokenInstance.address,
      tokenAmount,
      0, // slippage is unavoidable
      0, // slippage is unavoidable
      deployer,
      lastTimestamp + 1000,
      { from: deployer, value: bnbAmount }
    );
  })

  describe("Owner setting", async function () {
    it('Change allocation is accessible only by owner', async() => {
      await truffleAssert.reverts(
        dexfTokenInstance.changeAllocation(
          new BigNumber(10000000E18).toString(10),
          0,
          1,
          { from: Alice }
        ),
        "Ownable: caller is not the owner"
      );
    });

    it('Change allocation from treasury to team', async() => {
      await truffleAssert.reverts(
        dexfTokenInstance.changeAllocation(
          new BigNumber(10000000E18).toString(10),
          0,
          1,
          { from: deployer }
        ),
        "Dexf: Invalid allocation"
      );
    });

    it('Change allocation from treasury to staking pool', async() => {
      await dexfTokenInstance.changeAllocation(
          new BigNumber(10000000E18).toString(10),
          0,
          2,
          { from: deployer }
      );

      let balanceOfTreasury = await callMethod(
        dexfToken.methods.balanceOf,
        [_treasury]
      );
      let balanceOfStakingPool = await callMethod(
        dexfToken.methods.balanceOf,
        [_stakingPool]
      );

      expect(new BigNumber(balanceOfTreasury).eq(new BigNumber(62000000E18))).to.be.equal(true);
      expect(new BigNumber(balanceOfStakingPool).eq(new BigNumber(78000000E18))).to.be.equal(true);

      const stakingRewardRemaining = await callMethod(
        dexfToken.methods.stakingRewardRemaining,
        []
      );
      expect(new BigNumber(stakingRewardRemaining).eq(new BigNumber(78000000E18))).to.be.equal(true);
    });

    it('Change allocation from team to staking pool', async() => {
      await dexfTokenInstance.changeAllocation(
          new BigNumber(10000000E18).toString(10),
          1,
          2,
          { from: deployer }
      );

      balanceOfTeam = await callMethod(
        dexfToken.methods.balanceOf,
        [_team]
      );
      balanceOfStakingPool = await callMethod(
        dexfToken.methods.balanceOf,
        [_stakingPool]
      );

      expect(new BigNumber(balanceOfTeam).eq(new BigNumber(10000000E18))).to.be.equal(true);
      expect(new BigNumber(balanceOfStakingPool).eq(new BigNumber(88000000E18))).to.be.equal(true);

      const stakingRewardRemaining = await callMethod(
        dexfToken.methods.stakingRewardRemaining,
        []
      );
      expect(new BigNumber(stakingRewardRemaining).eq(new BigNumber(88000000E18))).to.be.equal(true);
    });

    it('Revert Set treasury1 from Alice', async function () {
      await truffleAssert.reverts(
        dexfTokenInstance.setTreasury1(
          "0xA629E14908F5cE17F3AFA3BAF5F7318d06091362",
          { from: Alice }
        ),
        "Ownable: caller is not the owner"
      );
    });

    it('Set treasury1 and allocate dexf', async function () {
      await dexfTokenInstance.setTreasury1(
        "0xA629E14908F5cE17F3AFA3BAF5F7318d06091362",
        { from: deployer }
      );

      await dexfTokenInstance.changeAllocation(
        new BigNumber(1000),
        1,
        3,
        { from: deployer }
      );

      const balance = await callMethod(
        dexfToken.methods.balanceOf,
        ["0xA629E14908F5cE17F3AFA3BAF5F7318d06091362"]
      );

      expect(new BigNumber(balance).eq(1000)).to.be.equal(true);
    });
  });

  describe("Buy Sell from PancakeSwap", async function () {
    it('Limit setting and blocklist setting should be done by only owner', async() => {
      await truffleAssert.reverts(
        dexfTokenInstance.updateBuyLimit(
          new BigNumber(100000E18).toString(10),
          { from: Alice }
        ),
        "Ownable: caller is not the owner"
      );

      await truffleAssert.reverts(
        dexfTokenInstance.addToBlacklist(
          Bob,
          { from: Alice }
        ),
        "Ownable: caller is not the owner"
      );

      await dexfTokenInstance.updateBuyLimit(
        new BigNumber(100000E18).toString(10),
        { from: deployer }
      );
      await dexfTokenInstance.updateSellLimit(
        new BigNumber(100000E18).toString(10),
        { from: deployer }
      );
      await dexfTokenInstance.addToBlacklist(
        Bob,
        { from: deployer }
      );
    });

    it('Buy limit', async() => {
      const currentBlockNumber = await new web3.eth.getBlockNumber();
      const currentBlock = await new web3.eth.getBlock(currentBlockNumber);
      const lastTimestamp = currentBlock.timestamp;

      const path = [WETHAddr, dexfTokenABI.address];

      await truffleAssert.reverts(
        pancakeSwapV2RouterInstance.swapETHForExactTokens(
          new BigNumber(100001E18).toString(10),
          path,
          Christian,
          lastTimestamp + 1000,
          { from: Christian, value: new BigNumber(12E18).toString(10) }
        ),
        "UniswapV2: TRANSFER_FAILED"
      );

      await pancakeSwapV2RouterInstance.swapETHForExactTokens(
        new BigNumber(100000E18).toString(10),
        path,
        Christian,
        lastTimestamp + 1000,
        { from: Christian, value: new BigNumber(12E18).toString(10) }
      );

      // balance of Christian
      const balanceOfChristian = await callMethod(
        dexfToken.methods.balanceOf,
        [Christian]
      );
      console.log("Log: Token balance of Christian => ", balanceOfChristian);
    })

    it('Sell limit', async() => {
      const currentBlockNumber = await new web3.eth.getBlockNumber();
      const currentBlock = await new web3.eth.getBlock(currentBlockNumber);
      const lastTimestamp = currentBlock.timestamp;

      await dexfTokenInstance.transfer(
        Christian,
        new BigNumber(200000E18).toString(10),
        { from: deployer }
      );

      await dexfTokenInstance.approve(
        pancakeSwapV2RouterABI.address,
        new BigNumber(500000E18).toString(10),
        { from: Christian }
      );

      const path = [dexfTokenABI.address, WETHAddr];

      await truffleAssert.reverts(
        pancakeSwapV2RouterInstance.swapExactTokensForETH(
          new BigNumber(100001E18).toString(10),
          0,
          path,
          Christian,
          lastTimestamp + 1000,
          { from: Christian }
        ),
        "TransferHelper: TRANSFER_FROM_FAILED"
      );

      await pancakeSwapV2RouterInstance.swapExactTokensForETHSupportingFeeOnTransferTokens(
        new BigNumber(1000E18).toString(10),
        0,
        path,
        Christian,
        lastTimestamp + 1000,
        { from: Christian }
      );
    })

    it('Black list', async() => {
      await truffleAssert.reverts(
        dexfTokenInstance.transfer(
          Bob,
          new BigNumber(1000000E18).toString(10),
          { from: deployer }
        ),
        "Blacklisted account"
      );

      await dexfTokenInstance.removeFromBlacklist(
        Bob,
        { from: deployer }
      );

      await dexfTokenInstance.transfer(
        Bob,
        new BigNumber(1000000E18).toString(10),
        { from: deployer }
      )
    })
  })
});
