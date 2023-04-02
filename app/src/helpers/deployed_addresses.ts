type Contracts = {
  [network: string]: {
    [contract: string]: string;
  };
};

export const contractAddresses: Contracts = {
  "goerli": {
    "ramp": '0x805a3Ae6495Be653dE460685D5FFDD5A538550f1',
    "fusdc": '0xb685Bdc019DEE17D073746a88bF6a6cDDED8Ae70',
  },
  "scrollalpha": {
    "ramp": '0x5c589c9De8d77ce24c2828B37e920A71074dae1a',
    "fusdc": '0x405bD6dBD2B9A392f4D600Be8571d40C516f94F0',
  },
};
