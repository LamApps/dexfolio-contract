const fs = require('fs');
const dexfToken = artifacts.require('DEXF');
const lpFarm = artifacts.require('LPFarming');
const lpFarmProxy = artifacts.require('LPFarmingUpgradeableProxy');
const erc20 = artifacts.require('ERC20Mock');

function expertContractJSON(contractName, instance) {
  const path = './test/abis/' + contractName + '.json';
  const data = {
    contractName,
    address: instance.address,
    abi: instance.abi
  }

  fs.writeFile(path, JSON.stringify(data), (err) => {
    if (err) throw err;
    console.log('Contract data written to file');
  });
};

module.exports = async function (deployer) {
  console.log('Contract deploy started.');

  await deployer.deploy(dexfToken);
  await deployer.deploy(lpFarm);
  await deployer.deploy(erc20);

  console.log('Contract deploy finished.');

  expertContractJSON('DEXF', dexfToken);
  expertContractJSON('lpFarm', lpFarm);
  expertContractJSON('erc20', erc20);
};
