require("dotenv").config();

const { INFURA_PROJECT_ID, PRIVATE_KEY } = process.env;

module.exports = {
  networks: {
    goerli: {
      url: `https://goerli.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: [`0x${PRIVATE_KEY}`]
    }
  },
  solidity: "0.8.12",
};
