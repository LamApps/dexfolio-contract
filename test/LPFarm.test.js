const DexfToken = artifacts.require('DEXF');
const LpFarm = artifacts.require('LPFarming');
const LPFarmingUpgradeableProxy = artifacts.require('LPFarmingUpgradeableProxy');
const PancakeSwapV2Router = artifacts.require('PancakeSwapV2Router');
const Erc20Mock = artifacts.require('ERC20Mock');
const dexfTokenABI = require('./abis/DEXF.json');
const lpFarmABI = require('./abis/lpFarm.json');
const pancakeSwapV2RouterABI = require('./abis/PancakeSwapV2Router.json');
const pairABI = require('./abis/V2Pair.json');
const erc20MockABI = require('./abis/erc20.json');
const truffleAssert = require('truffle-assertions');
const BigNumber = require('bignumber.js');

const {
  callMethod,
  moveAtEpoch
}  =  require('./utils');

const pancakeSwapV2RouterAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

contract("LPFarming", async (accounts) => {
  const deployer = accounts[0];
  const Alice = accounts[1];
  const Bob = accounts[2];
  const ProxyAdmin = accounts[9];

  let dexfTokenInstance;
  let lpFarmInstance; 
  let pancakeSwapV2RouterInstance;
  let erc20MockInstance;
  let proxyInstance;
  let dexfToken;
  let lpFarm;
  let pairToken;
  let erc20Token;
  let epoch1Start;
  let epochDuration;
  let time1, time2, time3;
  let totalMultiplier2, totalMultiplier3;

  before(async () => {
    // console.log("Deploying new contract");
    // Create Instances
    // dexfTokenInstance = await DexfToken.new({ from: deployer });
    // lpFarmInstance = await LpFarm.new(dexfTokenInstance.address, { from: deployer });

    const abiEncodeData = web3.eth.abi.encodeFunctionCall({
      "inputs": [
        {
          "internalType": "address",
          "name": "dexf",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "owner",
          "type": "address"
        }
      ],
      "name": "initialize",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }, [
      dexfTokenABI.address, deployer
    ]);

    // Get contract instance
    dexfTokenInstance = await DexfToken.at(dexfTokenABI.address);
    proxyInstance = await LPFarmingUpgradeableProxy.new(lpFarmABI.address, ProxyAdmin, abiEncodeData, { from: deployer });
    lpFarmInstance = await LpFarm.at(proxyInstance.address);
    // lpFarmInstance = await LpFarm.at(lpFarmABI.address);
    pancakeSwapV2RouterInstance = await PancakeSwapV2Router.at(pancakeSwapV2RouterABI.address);
    erc20MockInstance = await Erc20Mock.at(erc20MockABI.address);

    // Create Contracts
    dexfToken = await new web3.eth.Contract(dexfTokenABI.abi, dexfTokenInstance.address);
    lpFarm = await new web3.eth.Contract(lpFarmABI.abi, lpFarmInstance.address);
    pancakeSwapV2Router = await new web3.eth.Contract(pancakeSwapV2RouterABI.abi, pancakeSwapV2RouterAddress);
    erc20Token = await new web3.eth.Contract(erc20MockABI.abi, erc20MockInstance.address);

    // set staking contract address for dexf
    await dexfTokenInstance.setStakingContract(
      lpFarmInstance.address,
      { from: deployer, gasLimit: 4000000 }
    );

    const pairAddress = await callMethod(
      lpFarm.methods.dexfBNBV2Pair,
      []
    );
    pairToken = await new web3.eth.Contract(pairABI, pairAddress);

    // set multipliers
    await lpFarmInstance.setMultipliers(
        [
          100, 104, 108, 112, 115, 119, 122, 125, 128, 131,
          134, 136, 139, 142, 144, 147, 149, 152, 154, 157,
          159, 161, 164, 166, 168, 170, 173, 175, 177, 179,
          181, 183, 185, 187, 189, 191, 193, 195, 197, 199,
          201, 203, 205, 207, 209, 211, 213, 214, 216, 218,
          220, 222, 223, 225, 227, 229, 230, 232, 234, 236,
          237, 239, 241, 242, 244, 246, 247, 249, 251, 252,
          254, 255, 257, 259, 260, 262, 263, 265, 267, 268,
          270, 271, 273, 274, 276, 277, 279, 280, 282, 283,
          285, 286, 288, 289, 291, 292, 294, 295, 297, 298
      ],
      { from: deployer }
    );
  });

  it("Create liquidity, set epoch1 start", async function () {
    const currentBlockNumber = await new web3.eth.getBlockNumber();
    const currentBlock = await new web3.eth.getBlock(currentBlockNumber);
    const lastTimestamp = currentBlock.timestamp;
    time1 = lastTimestamp;

    // approve dexf for pancakeSwapV2Router
    const tokenAmount = new BigNumber(10000000E18).toString(10);
    const bnbAmount = new BigNumber(1000E18).toString(10);
    await dexfTokenInstance.approve(
      pancakeSwapV2RouterAddress,
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

    // add the erc20, BNB liquidity
    await erc20MockInstance.approve(
      pancakeSwapV2RouterAddress,
      new BigNumber(1000E18).toString(10),
      { from: deployer, gasLimit: 4000000 }
    );
    await pancakeSwapV2RouterInstance.addLiquidityETH(
      erc20MockInstance.address,
      new BigNumber(1000E18).toString(10),
      0, // slippage is unavoidable
      0, // slippage is unavoidable
      deployer,
      lastTimestamp + 1000,
      { from: deployer, value: bnbAmount }
    );

    await dexfTokenInstance.setEpoch1Start(
      lastTimestamp + 1000,
      { from: deployer }
    );
    await lpFarmInstance.setEpoch1Start(
      lastTimestamp + 1000,
      { from: deployer }
    );

    await truffleAssert.reverts(lpFarmInstance.setEpoch1Start(
      lastTimestamp + 1000,
      { from: Alice }
    ), "Ownable: caller is not the owner");

    // Get epoch start, duration
    epoch1Start = await callMethod(
      lpFarm.methods._epoch1Start,
      []
    );
    epochDuration = await callMethod(
      lpFarm.methods._epochDuration,
      []
    );
  })

  describe("Stake, unstake, claim", async function () {
    it('Check LP Balance of owner', async() => {
      // Get Balance
      const lpBalanceOfOwner = await callMethod(
        pairToken.methods.balanceOf,
        [deployer]
      );

      // Check Balance
      console.log("Log: Lp balance of owner => ", lpBalanceOfOwner);
      assert.isAbove(Number(lpBalanceOfOwner), 0, 'Lp balance is greater than 0');
    });

    it('Stake duration should be bigger than 3', async() => {
      // stake 1 Eth for 3 weeks
      await truffleAssert.reverts(lpFarmInstance.stake(
        '3',
        { from: Alice, value: new BigNumber(1E18).toString(10) }
      ), "Farming: Invalid lock duration");
    });

    it("Saves users stake in state", async function () {
      // Epoch 0

      const bnbBalance = await new web3.eth.getBalance(lpFarmInstance.address);
      const dexBalance = await callMethod(
        dexfToken.methods.balanceOf,
        [lpFarmInstance.address]
      );

      console.log("Log: Bnb balance of farming contract => ", bnbBalance);
      console.log("Log: Dexf balance of farming contract => ", dexBalance);

      // stake 1 Eth for 4 weeks
      await lpFarmInstance.stake(
        '4',
        { from: Alice, value: new BigNumber(1E18).toString(10), gasLimit: 4000000 }
      );

      const bnbBalance1 = await new web3.eth.getBalance(lpFarmInstance.address);
      const dexBalance1 = await callMethod(
        dexfToken.methods.balanceOf,
        [lpFarmInstance.address]
      );

      console.log("Log: Bnb balance of farming contract after stake => ", bnbBalance1);
      console.log("Log: Dexf balance of farming contract after stake => ", dexBalance1);

      // stake 2 Eth for 5 weeks
      await lpFarmInstance.stake(
        '5',
        { from: Alice, value: new BigNumber(2E18).toString(10), gasLimit: 4000000 }
      );

      const stakes = await callMethod(
        lpFarm.methods.getStakes,
        [Alice]
      );

      expect(stakes.length).to.be.equal(2);
      assert.isAbove(Number(stakes[0]["amount"]), 0, 'Stake amount is greater than 0');
    });

    it("Unstake is available after lock duration", async function () {
      // move to epoch 2
      await moveAtEpoch(epoch1Start, epochDuration, 4);

      // Unstake
      await truffleAssert.reverts(lpFarmInstance.unstake(
        0,
        { from: Alice, gasLimit: 4000000 }
      ), "Farming: Lock is not finished.");
    });

    it("Emergency withdraw", async function () {
      await lpFarmInstance.emergencyWithdraw(
        1,
        { from: Alice, gasLimit: 4000000 }
      );

      const stakes = await callMethod(
        lpFarm.methods.getStakes,
        [Alice]
      );

      expect(stakes.length).to.be.equal(2);
      assert.isAbove(Number(stakes[1]["endTimestamp"]), 0, 'End timestamp is not 0');
    });

    it("Stake Erc20 token", async function () {
      // Epoch 2

      // stake 2 Eth for 11 weeks in epoch 3
      await lpFarmInstance.stake(
        '11',
        { from: Bob, value: new BigNumber(2E18).toString(10), gasLimit: 4000000 }
      );

      // move to epoch 4
      await moveAtEpoch(epoch1Start, epochDuration, 4);

      // transfer Erc20 to Bob
      await erc20MockInstance.transfer(
        Bob,
        new BigNumber(100E18).toString(10),
        { from: deployer }
      );

      // approve Erc20 to LP Farming contract
      await erc20MockInstance.approve(
        lpFarmInstance.address,
        new BigNumber(1E18).toString(10),
        { from: Bob }
      );

      const bnbBalance = await new web3.eth.getBalance(lpFarmInstance.address);
      const dexBalance = await callMethod(
        dexfToken.methods.balanceOf,
        [lpFarmInstance.address]
      );
      const erc20Balance = await callMethod(
        erc20Token.methods.balanceOf,
        [lpFarmInstance.address]
      );

      console.log("Log: Bnb balance of farming contract => ", bnbBalance);
      console.log("Log: Dexf balance of farming contract => ", dexBalance);
      console.log("Log: Erc20 balance of farming contract => ", erc20Balance);

      // stake Erc20 from Bob
      await lpFarmInstance.stakeToken(
        erc20MockInstance.address,
        new BigNumber(1E18).toString(10),
        '4',
        { from: Bob }
      );

      const bnbBalance1 = await new web3.eth.getBalance(lpFarmInstance.address);
      const dexBalance1 = await callMethod(
        dexfToken.methods.balanceOf,
        [lpFarmInstance.address]
      );
      const erc20Balance1 = await callMethod(
        erc20Token.methods.balanceOf,
        [lpFarmInstance.address]
      );

      console.log("Log: Bnb balance of farming contract after stake => ", bnbBalance1);
      console.log("Log: Dexf balance of farming contract after stake => ", dexBalance1);
      console.log("Log: Erc20 balance of farming contract after stake => ", erc20Balance1);

      const stakes = await callMethod(
        lpFarm.methods.getStakes,
        [Bob]
      );

      expect(new BigNumber(stakes[1]["amount"]).gt(0)).to.equal(true);
      expect(new BigNumber(stakes[1]["claimedAmount"]).eq(0)).to.equal(true);

      totalMultiplier2 = await callMethod(
        lpFarm.methods.totalMultipliers,
        [4]
      );

      const currentBlockNumber = await new web3.eth.getBlockNumber();
      const currentBlock = await new web3.eth.getBlock(currentBlockNumber);
      const lastTimestamp = currentBlock.timestamp;
      time2 = lastTimestamp;
    });

    it("Unstake", async function () {
      await moveAtEpoch(epoch1Start, epochDuration, 28);

      await truffleAssert.reverts(lpFarmInstance.unstake(
        0,
        { from: Alice, gasLimit: 4000000 }
      ), "Farming: Lock is not finished.");

      await moveAtEpoch(epoch1Start, epochDuration, 29);

      let dexfBalance = await callMethod(
        dexfToken.methods.balanceOf,
        [Alice]
      );
      console.log("Log: Dexf balance before unstake => ", dexfBalance);

      const stakes = await callMethod(
        lpFarm.methods.getStakes,
        [Alice]
      );

      await lpFarmInstance.unstake(
        0,
        { from: Alice, gasLimit: 4000000 }
      );

      dexfBalance = await callMethod(
        dexfToken.methods.balanceOf,
        [Alice]
      );
      console.log("Log: Dexf balance after unstake => ", dexfBalance);

      // Get lp Balance
      const lpBalance = await callMethod(
        pairToken.methods.balanceOf,
        [Alice]
      );
      console.log("Log: Lp balance of Bob => ", lpBalance);

      const lpAmount = new BigNumber(stakes[0]["amount"]).plus(new BigNumber(stakes[1]["amount"]));
      expect(lpAmount.toString(10)).to.equal(lpBalance);

      const stakes1 = await callMethod(
        lpFarm.methods.getStakes,
        [Alice]
      );

      expect(stakes[0]["endEpochId"]).to.equal('0');
      expect(stakes1[0]["endEpochId"]).to.equal('28');
      expect(stakes[0]["lastClaimEpochId"]).to.not.equal('28');
      expect(stakes1[0]["lastClaimEpochId"]).to.equal('28');

      totalMultiplier3 = await callMethod(
        lpFarm.methods.totalMultipliers,
        [29]
      );

      const currentBlockNumber = await new web3.eth.getBlockNumber();
      const currentBlock = await new web3.eth.getBlock(currentBlockNumber);
      const lastTimestamp = currentBlock.timestamp;
      time3 = lastTimestamp;
    });

    it("Prior multipliers", async function () {
      const multiplier1 = await callMethod(
        lpFarm.methods.getPriorTotalMultiplier,
        [time1]
      );
      const multiplier2 = await callMethod(
        lpFarm.methods.getPriorTotalMultiplier,
        [time2]
      );
      const multiplier3 = await callMethod(
        lpFarm.methods.getPriorTotalMultiplier,
        [time3]
      );

      console.log("Log: Multiplier checkpoint1 => ", multiplier1);
      console.log("Log: Multiplier checkpoint2 => ", multiplier2);
      console.log("Log: Multiplier checkpoint3 => ", multiplier3);

      expect(multiplier2).to.equal(totalMultiplier2);
      expect(multiplier3).to.equal(totalMultiplier3);
    })

    it("Unstake for closed stake", async function () {
      await truffleAssert.reverts(lpFarmInstance.unstake(
        0,
        { from: Alice, gasLimit: 4000000 }
      ), "Farming: Already unstaked.");

      await truffleAssert.reverts(lpFarmInstance.unstake(
        1,
        { from: Alice, gasLimit: 4000000 }
      ), "Farming: Already unstaked.");

      await truffleAssert.reverts(lpFarmInstance.emergencyWithdraw(
        1,
        { from: Alice, gasLimit: 4000000 }
      ), "Farming: Already unstaked.");
    })

    it("Change implementation", async function () {
      const newImplementationInstance = await LpFarm.new({ from: deployer });
      await proxyInstance.upgradeTo(newImplementationInstance.address, { from: ProxyAdmin });
      await lpFarmInstance.stake(
        '4',
        { from: Alice, value: new BigNumber(1E18).toString(10), gasLimit: 4000000 }
      );      
    })

  });
});
