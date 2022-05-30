const DexfToken = artifacts.require('DEXF');
const LpFarm = artifacts.require('LPFarming');
const LPFarmingUpgradeableProxy = artifacts.require('LPFarmingUpgradeableProxy');
const PancakeSwapV2Router = artifacts.require('PancakeSwapV2Router');
const Erc20Mock = artifacts.require('ERC20Mock');
const GovernorAlpha = artifacts.require('GovernorAlpha');
const Timelock = artifacts.require('Timelock');
const dexfTokenABI = require('./abis/DEXF.json');
const lpFarmABI = require('./abis/lpFarm.json');
const pancakeSwapV2RouterABI = require('./abis/PancakeSwapV2Router.json');
const pairABI = require('./abis/V2Pair.json');
const erc20MockABI = require('./abis/erc20.json');
const timeLockABI = require('../build/contracts/Timelock.json');
const governorAlphaABI = require('../build/contracts/GovernorAlpha.json'); 
const truffleAssert = require('truffle-assertions');
const BigNumber = require('bignumber.js');

const {
  callMethod,
  moveAtEpoch,
  passTime,
  encodeParameters
}  =  require('./utils');

const pancakeSwapV2RouterAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

contract("Governance", async (accounts) => {
  const deployer = accounts[0];
  const Alice = accounts[1];
  const Bob = accounts[2];
  const Christian = accounts[3];
  const ProxyAdmin = accounts[9];

  let dexfTokenInstance;
  let lpFarmInstance; 
  let pancakeSwapV2RouterInstance;
  let erc20MockInstance;
  let governorAlphaInstance;
  let timelockInstance;
  let dexfToken;
  let lpFarm;
  let pairToken;
  let timelock;
  let governorAlpha;
  let epoch1Start;
  let epochDuration;

  before(async () => {
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
    // lpFarmInstance = await LpFarm.at(lpFarmABI.address);
    const lpFarmImplementation = await LpFarm.new({ from: deployer });
    const proxyInstance = await LPFarmingUpgradeableProxy.new(lpFarmImplementation.address, ProxyAdmin, abiEncodeData, { from: deployer });
    lpFarmInstance = await LpFarm.at(proxyInstance.address);
    pancakeSwapV2RouterInstance = await PancakeSwapV2Router.at(pancakeSwapV2RouterABI.address);
    erc20MockInstance = await Erc20Mock.at(erc20MockABI.address);

    // Create Contracts
    dexfToken = await new web3.eth.Contract(dexfTokenABI.abi, dexfTokenInstance.address);
    lpFarm = await new web3.eth.Contract(lpFarmABI.abi, lpFarmInstance.address);
    pancakeSwapV2Router = await new web3.eth.Contract(pancakeSwapV2RouterABI.abi, pancakeSwapV2RouterAddress);

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

    await dexfTokenInstance.setEpoch1Start(
      lastTimestamp + 1000,
      { from: deployer }
    );
    await lpFarmInstance.setEpoch1Start(
      lastTimestamp + 1000,
      { from: deployer }
    );

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
    it("Saves users stake in state", async function () {
      // Epoch 0

      // stake 1 Eth for 4 weeks
      await lpFarmInstance.stake(
        '4',
        { from: Alice, value: new BigNumber(1E18).toString(10), gasLimit: 4000000 }
      );

      const stakes = await callMethod(
        lpFarm.methods.getStakes,
        [Alice]
      );

      expect(stakes.length).to.be.equal(1);
      assert.isAbove(Number(stakes[0]["amount"]), 0, 'Stake amount is greater than 0');
    });
  });

  describe("Governance", async function () {
    it("Deploy GovernorAlpa, Timelock contract", async function () {
      // Create Instances
      timelockInstance = await Timelock.new(deployer, 3600 * 24 * 3, { from: deployer });
      governorAlphaInstance = await GovernorAlpha.new(timelockInstance.address, lpFarmInstance.address, deployer, { from: deployer });

      timelock = await new web3.eth.Contract(timeLockABI.abi, timelockInstance.address);
      governorAlpha = await new web3.eth.Contract(governorAlphaABI.abi, governorAlphaInstance.address);
    })

    it("Change timelock admin to governorAlpha", async function () {
      const currentBlockNumber = await new web3.eth.getBlockNumber();
      const currentBlock = await new web3.eth.getBlock(currentBlockNumber);
      const lastTimestamp = currentBlock.timestamp;

      let signature = "setPendingAdmin(address)";
      let data = encodeParameters(['address'], [governorAlphaInstance.address]);
      let eta = lastTimestamp + 3600 * 24 * 3 + 1000;

      await timelockInstance.queueTransaction(
        timelockInstance.address,
        "0",
        signature,
        data,
        eta,
        { from: deployer }
      );

      await truffleAssert.reverts(timelockInstance.executeTransaction(
        timelockInstance.address,
        "0",
        signature,
        data,
        eta,
        { from: deployer }
      ), "Timelock::executeTransaction: Transaction hasn't surpassed time lock.");

      // pass time
      await passTime(3600 * 24 * 4);
      await timelockInstance.executeTransaction(
        timelockInstance.address,
        "0",
        signature,
        data,
        eta,
        { from: deployer }
      );
      await governorAlphaInstance.__acceptAdmin(
        { from: deployer }
      );

      let timelockAdmin = await callMethod(
        timelock.methods.admin,
        []
      );
      expect(timelockAdmin).to.be.equal(governorAlphaInstance.address);
    })

    it("Transfer dexf contract ownership to timelock", async function () {
      await dexfTokenInstance.transferOwnership(
        timelockInstance.address,
        { from: deployer }
      );
    })

    it("Make proposal", async function () {
      const currentEpoch = await callMethod(
        lpFarm.methods.getCurrentEpoch,
        []
      );
      await lpFarmInstance.manualEpochInit(
        currentEpoch,
        { from: deployer }
      );

      let signature = "setDailyReleaseAmountTreasury(uint256)";
      let data = encodeParameters(['uint256'], [new BigNumber(1000E18).toString(10)]);

      await truffleAssert.reverts(governorAlphaInstance.propose(
        [dexfTokenInstance.address],
        ["0"],
        [signature],
        [data],
        "Change dailyReleaseAmount for treasury",
        { from: Christian }
      ), "GovernorAlpha::propose: proposer votes below proposal threshold");

      await governorAlphaInstance.propose(
        [dexfTokenInstance.address],
        ["0"],
        [signature],
        [data],
        "Change dailyReleaseAmount for treasury",
        { from: Alice }
      );
    })

    it("Cast vote", async function () {
      await governorAlphaInstance.castVote(
        1,
        true,
        { from: Alice }
      )
      const proposal = await callMethod(
        governorAlpha.methods.proposals,
        [1]
      );
      console.log("Log: proposal => ", proposal);

      const state = await callMethod(
        governorAlpha.methods.state,
        [1]
      );
      console.log("Log: state => ", state);
    });

    it("Queue proposal", async function () {
      await passTime(3600 * 24 * 5);
      const currentEpoch = await callMethod(
        lpFarm.methods.getCurrentEpoch,
        []
      );
      await lpFarmInstance.manualEpochInit(
        currentEpoch,
        { from: deployer }
      );

      await governorAlphaInstance.queue(
        1,
        { from: Alice }
      )
    });

    it("Execute proposal", async function () {
      await passTime(3600 * 24 * 4);
      const currentEpoch = await callMethod(
        lpFarm.methods.getCurrentEpoch,
        []
      );
      await lpFarmInstance.manualEpochInit(
        currentEpoch,
        { from: deployer }
      );

      await governorAlphaInstance.execute(
        1,
        { from: Alice }
      );

      const releaseAmount = await callMethod(
        dexfToken.methods.DAILY_RELEASE_AMOUNT_TREASURY,
        []
      );
      expect(releaseAmount).to.be.equal(new BigNumber(1000E18).toString(10));
    });
  })
});
