var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic = "caught grain define giggle blush trip exchange fancy guess salute host rely";

module.exports = {
  networks: {
    development: {
      provider: function() {
        return new HDWalletProvider(mnemonic, "http://127.0.0.1:8545/", 0, 50);
      },
      network_id: '*',
      gas: 9999999
    }
  },
  compilers: {
    solc: {
      //version: "0.4.24"
    }
  }
};

