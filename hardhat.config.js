require("dotenv").config();

const { INFURA_PROJECT_ID, PRIVATE_KEY } = process.env;

require("@nomiclabs/hardhat-ethers");

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
  solidity: "0.8.12",
};
