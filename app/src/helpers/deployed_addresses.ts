type Contracts = {
  [network: string]: {
    [contract: string]: string;
  };
};

export const contractAddresses: Contracts = {
  "goerli_legacy": {
    "ramp": '0x805a3Ae6495Be653dE460685D5FFDD5A538550f1',
    "fusdc": '0xb685Bdc019DEE17D073746a88bF6a6cDDED8Ae70',
  },
  "goerli": {
    "ramp": '0x945D14a5c63769f4cf008a2994810940cc0DFd5C',
    "fusdc": '0xf6426A1fdE02c3d6f10b4af107cDd7669574E74C',
  },
  "scrollalpha": {
    "ramp": '0x5c589c9De8d77ce24c2828B37e920A71074dae1a',
    "fusdc": '0x405bD6dBD2B9A392f4D600Be8571d40C516f94F0',
  },
};
