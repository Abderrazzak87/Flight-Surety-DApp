var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic = "crunch space proud author rare sample foil they awake twice fetch brick";

module.exports = {
  networks: {
    development: {
      provider: function() {
        return new HDWalletProvider(mnemonic, "http://127.0.0.1:7545/", 0, 50);
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

