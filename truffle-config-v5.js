var HDWalletProvider = require("truffle-hdwallet-provider");
const MNEMONIC = 'b361b586cfeb49f955de49015008c8fa128b261ade84cfc102785ce55e35271e';

module.exports = {
  networks: {
    development: {
     host: "127.0.0.1",     // Localhost (default: none)
     port: 8545,            // Standard Ethereum port (default: none)
     network_id: "*",       // Any network (default: none)
     gas: 85000000,           // Gas sent with each transaction (default: ~6700000)
     gasPrice: 500000000000,  // 20 gwei (in wei) (default: 100 gwei)
    },
    kovan: {
      provider: function() {
        return new HDWalletProvider(MNEMONIC, "https://kovan.infura.io/v3/1e113e98ea1642a2883131d72ef4ad46")
      },
      network_id: 42,
      gas: 7500000,        // Ropsten has a lower block limit than mainnet
      gasPrice: 10000000000,
      confirmations: 2,    // # of confs to wait between deployments. (default: 0)
      timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
      networkCheckTimeout: 100000,
      skipDryRun: true     // Skip dry run before migrations? (default: false for public nets )
    }
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    enableTimeouts: false
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.5.16",    // Fetch exact version from solc-bin (default: truffle's version)
      // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
      settings: {          // See the solidity docs for advice about optimization and evmVersion
       optimizer: {
         enabled: true,
         runs: 200
       },
       evmVersion: "istanbul"
      }
    },
  },

  contracts_directory: "./governance",
};
