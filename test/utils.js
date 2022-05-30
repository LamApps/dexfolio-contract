const BigNumber = require('bignumber.js');
const ethers = require('ethers');

function UInt256Max() {
  return ethers.constants.MaxUint256;
}

function address(n) {
  return `0x${n.toString(16).padStart(40, '0')}`;
}

function encodeParameters(types, values) {
  const abi = new ethers.utils.AbiCoder();
  return abi.encode(types, values);
}

const divByDecimal = (v, d = 18) => {
  return new BigNumber(v).div(new BigNumber(10).pow(d)).toString(10);
}

const callMethod = async (method, args = []) => {
  const result = await method(...args).call();
  return result;
};

const bnToString = (v, d = 18) => {
  return new BigNumber(v).toString(10);
}

const moveAtEpoch = async (start, duration, epoch) => {
  const currentBlockNumber = await new web3.eth.getBlockNumber();
  const currentBlock = await new web3.eth.getBlock(currentBlockNumber);
  const lastTimestamp = currentBlock.timestamp;

  const id = Date.now();
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [Number(start) + Number(duration) * Number(epoch-1) - lastTimestamp],
        id: id,
      },
      (err1) => {
        if (err1) return reject(err1);
        web3.currentProvider.send(
          {
            jsonrpc: "2.0",
            method: "evm_mine",
            id: id + 1,
          },
          (err2, res) => {
            return err2 ? reject(err2) : resolve(res);
          }
        );
      }
    );
  });
}

const passTime = async (duration) => {
  const id = Date.now();
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [Number(duration)],
        id: id,
      },
      (err1) => {
        if (err1) return reject(err1);
        web3.currentProvider.send(
          {
            jsonrpc: "2.0",
            method: "evm_mine",
            id: id + 1,
          },
          (err2, res) => {
            return err2 ? reject(err2) : resolve(res);
          }
        );
      }
    );
  });
}

module.exports = {
  divByDecimal,
  bnToString,
  callMethod,
  moveAtEpoch,
  passTime,
  UInt256Max,
  address,
  encodeParameters
}
