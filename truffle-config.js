require('dotenv').config()

var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic = process.env.ETH_MNEMONIC;
var accessToken = process.env.INFURA_ACCESS_TOKEN;


module.exports = {

  compilers: {
    solc: {
      version: "0.5.7"
    }
  },

  networks: {

    ganache: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*"
    },

    rinkeby: {
      provider: function() {
              return new HDWalletProvider(mnemonic, 'https://rinkeby.infura.io/v3/' + accessToken);
            },
      network_id: 4,
      gas: 4712388
    }
  }

}
