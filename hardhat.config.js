require("dotenv").config();

const { INFURA_PROJECT_ID, PRIVATE_KEY, ETHERSCAN_GOERLI_API_KEY } = process.env;

require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");

module.exports = {
  networks: {
    goerli: {
      url: `https://goerli.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: [`0x${PRIVATE_KEY}`]
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      timeout: 200000,
      gas: 12000000,
      blockGasLimit: 12000000
    },
  },
  // Etherscan verification doesn't work, was able to do it manually
  etherscan: {      
    apiKey: {
      goerli: ETHERSCAN_GOERLI_API_KEY,
    }
  },
  paths: {
    artifacts: "./artifacts",
  },
  solidity: "0.8.12",
};
