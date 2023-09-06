import {
  Chain
} from "wagmi";
import { optimism } from 'wagmi/chains'

import { contractAddresses } from '../helpers/deployed_addresses';


export function useRampContractAddress(chain: Chain = optimism) {
  let contractsForNetwork = contractAddresses[chain.network];
  if (contractsForNetwork) {
    return contractsForNetwork.ramp;
  } else {
    return "";
  }
}

export function useUSDCContractAddress(chain: Chain = optimism) {
  let contractsForNetwork = contractAddresses[chain.network];
  if (contractsForNetwork) {
    return contractsForNetwork.usdc;
  } else {
    return "";
  }
}
