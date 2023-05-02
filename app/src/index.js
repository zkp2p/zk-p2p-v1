import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { WagmiConfig, createClient, configureChains, chain } from "wagmi";
import { alchemyProvider } from 'wagmi/providers/alchemy'
import { publicProvider } from "wagmi/providers/public";
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc';
import {
  getDefaultWallets,
  RainbowKitProvider,
  darkTheme,
} from "@rainbow-me/rainbowkit";

import "./index.css";
import "@rainbow-me/rainbowkit/styles.css";


export const mantleTestnet = {
  id: 5001,
  name: 'Mantle Testnet',
  network: 'mantle',
  // iconUrl: '',
  // iconBackground: '#fff',
  nativeCurrency: {
    decimals: 18,
    name: 'BitDAO',
    symbol: 'BIT',
  },
  // rpcUrls: {
  //   public: {
  //     http: ["https://rpc.testnet.mantle.xyz"]
  //   },
  //   default: {
  //     http: ["https://rpc.testnet.mantle.xyz"]
  //   },
  // },
  rpcUrls: [
    "https://rpc.testnet.mantle.xyz"
  ],
  blockExplorers: {
    default: {
      http: ["https://explorer.testnet.mantlenetwork.io"]
    },
  },
  testnet: true
}

const { chains, provider, webSocketProvider } = configureChains(
  [chain.goerli, mantleTestnet],
  [
    alchemyProvider(
      { apiKey: '7OLNUah9mWjItVi7QiJWrlc6xVVdSGn3' }
    ),
    jsonRpcProvider({
      rpc: chain => ({ http: 'https://rpc.testnet.mantle.xyz' }),
    }),
    publicProvider()
  ]
);

const { connectors } = getDefaultWallets({
  appName: "ZK P2P On-Ramp",
  chains,
});

const client = createClient({
  autoConnect: true,
  connectors,
  provider,
  webSocketProvider,
});

ReactDOM.render(
  <React.StrictMode>
    <WagmiConfig client={client}>
      <RainbowKitProvider chains={chains} theme={darkTheme()}>
        <App />
      </RainbowKitProvider>
    </WagmiConfig>
  </React.StrictMode>,
  document.getElementById("root")
);
