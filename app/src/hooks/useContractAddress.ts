import {
  Chain
} from "wagmi";
import { optimism } from 'wagmi/chains'

import { contractAddresses } from '../helpers/deployed_addresses';


export function useRampContractAddress(chain: Chain = optimism) {
  return contractAddresses[chain.network].ramp;
}

export function useUSDCContractAddress(chain: Chain = optimism) {
  return contractAddresses[chain.network].usdc;
}
