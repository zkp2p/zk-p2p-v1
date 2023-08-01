type Contracts = {
  [network: string]: {
    [contract: string]: string;
  };
};


export const contractAddresses: Contracts = {
  "optimism": {
    "ramp": '0xa8B1e2A1235E2B30B32233b9176867A05B48dc3e',
    "usdc": '0x7F5c764cBc14f9669B88837ca1490cCa17c31607'
  },
  "goerli": {
    "ramp": '0xC77CF422dF9A02c10D361D7D45581AC6ee73b97c',
    "usdc": '0xf6426A1fdE02c3d6f10b4af107cDd7669574E74C', // Key is a misnomer, this is fakeUSDC deployed on testnet
  }
};

// Legacy Goerli Deployment
// "goerli": {
//   "ramp": '0x945D14a5c63769f4cf008a2994810940cc0DFd5C',
//   "fusdc": '0xf6426A1fdE02c3d6f10b4af107cDd7669574E74C',
// }
