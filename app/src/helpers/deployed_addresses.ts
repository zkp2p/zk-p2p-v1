type Contracts = {
  [network: string]: {
    [contract: string]: string;
  };
};


export const contractAddresses: Contracts = {
  "goerli": {
    "ramp": '0xC77CF422dF9A02c10D361D7D45581AC6ee73b97c',
    "fusdc": '0xf6426A1fdE02c3d6f10b4af107cDd7669574E74C',
  },
  // Legacy
  // "goerli": {
  //   "ramp": '0x945D14a5c63769f4cf008a2994810940cc0DFd5C',
  //   "fusdc": '0xf6426A1fdE02c3d6f10b4af107cDd7669574E74C',
  // },
  "mantle": {
    "ramp": '0xa8B1e2A1235E2B30B32233b9176867A05B48dc3e',
    "fusdc": '0xA6E289496d6479a5c7cAD48745990ef534FD3314',
  },
};
