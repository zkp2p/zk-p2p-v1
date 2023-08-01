// @ts-ignore
import React, { useEffect, useState } from "react";
import { useMount } from "react-use";

// @ts-ignore
import styled from "styled-components";
import { Button } from "../components/Button";
import { ClaimOrderForm } from "../components/ClaimOrderForm";
import { Col, Header, SubHeader } from "../components/Layout";
import { StyledLink } from "../components/StyledLink";
import { NewOrderForm } from "../components/NewOrderForm";
import { NumberedStep } from "../components/NumberedStep";
import { OrderTable } from '../components/OrderTable';
import { SubmitOrderClaimsForm } from "../components/SubmitOrderClaimsForm";
import { SubmitOrderGenerateProofForm } from "../components/SubmitOrderGenerateProofForm";
import { SubmitOrderOnRampForm } from "../components/SubmitOrderOnRampForm";
import { TopBanner } from "../components/TopBanner";

import {
  Chain,
  useAccount, 
  useContractRead, 
  useNetwork, 
} from "wagmi";

import { abi } from "../helpers/ramp.abi";
import { contractAddresses } from "../helpers/deployed_addresses";
import { OnRampOrder, OnRampOrderClaim } from "../helpers/types";
import { formatAmountsForUSDC, getOrderStatusString } from '../helpers/tableFormatters';


enum FormState {
  DEFAULT = "DEFAULT",
  NEW = "NEW",
  CLAIM = "CLAIM",
  UPDATE = "UPDATE",
}

export const MainPage: React.FC<{}> = (props) => {
  /*
    App State
  */

  const { address } = useAccount();
  const [ethereumAddress, setEthereumAddress] = useState<string>(address ?? "");
  const [showBrowserWarning, setShowBrowserWarning] = useState<boolean>(false);
  
  // ----- application state -----
  const [actionState, setActionState] = useState<FormState>(FormState.DEFAULT);
  const [selectedOrder, setSelectedOrder] = useState<OnRampOrder>({} as OnRampOrder);
  const [selectedOrderClaim, setSelectedOrderClaim] = useState<OnRampOrderClaim >({} as OnRampOrderClaim);
  
  const [rampContractAddress, setRampContractAddress] = useState<string>(contractAddresses['goerli'].ramp);
  const [fUSDCContractAddress, setFUSDCContractAddress] = useState<string>(contractAddresses['goerli'].fusdc);
  const [blockExplorer, setBlockExplorer] = useState<string>('https://goerli.etherscan.io/address/');

  // ----- transaction state -----
  const [submitOrderPublicSignals, setSubmitOrderPublicSignals] = useState<string>('');
  const [submitOrderProof, setSubmitOrderProof] = useState<string>('');
  
  // fetched on-chain state
  const [fetchedOrders, setFetchedOrders] = useState<OnRampOrder[]>([]);

  const { chain } = useNetwork();

  // order table state
  const orderTableHeaders = ['Creator', 'Requested USDC Amount', 'Status'];
  const orderTableData = fetchedOrders.map((order) => [
    formatAddressForTable(order.onRamper),
    formatAmountsForUSDC(order.amountToReceive),
    getOrderStatusString(order),
  ]);

  /*
    Misc Helpers
  */

  function formatAddressForTable(addressToFormat: string) {
    if (addressToFormat === address) {
      return "You";
    } else {
      const prefix = addressToFormat.substring(0, 4);
      const suffix = addressToFormat.substring(addressToFormat.length - 4);
      return `${prefix}...${suffix}`;
    }
  }

  /*
    Contract Reads
  */

  // getAllOrders() external view returns (Order[] memory) {
  const {
    data: allOrders,
    isLoading: isReadAllOrdersLoading,
    isError: isReadAllOrdersError,
    refetch: refetchAllOrders,
  } = useContractRead({
    addressOrName: rampContractAddress,
    contractInterface: abi,
    functionName: 'getAllOrders',
  });

  /*
    Hooks
  */

  useEffect(() => {
    if (address) {
      setEthereumAddress(address);
    } else {
      setEthereumAddress("");
    }
  }, [address]);

  useEffect(() => {
    const fetchRampContractAddress = (chain: Chain) => {
      if (contractAddresses[chain.network]) {
        return contractAddresses[chain.network].ramp;
      }
      return '';
    };

    const fetchFUSDCContractAddress = (chain: Chain) => {
      if (contractAddresses[chain.network]) {
        return contractAddresses[chain.network].fusdc;
      }
      return '';
    };

    if (chain) {
      const rampAddress = fetchRampContractAddress(chain);
      const fusdcAddress = fetchFUSDCContractAddress(chain);

      let explorer;
      switch (chain.network) {
        case "goerli":
          explorer = 'https://goerli.etherscan.io/address/';
          break;

        case "mantle":
          explorer = 'https://explorer.testnet.mantle.xyz/address/';
          break;

        default:
          explorer = '';
          break;
      }

      setRampContractAddress(rampAddress);
      setFUSDCContractAddress(fusdcAddress);
      setBlockExplorer(explorer);
    }
  }, [chain]);

  // Fetch Orders
  useEffect(() => {
    if (!isReadAllOrdersLoading && !isReadAllOrdersError && allOrders) {

      const sanitizedOrders: OnRampOrder[] = [];
      for (let i = allOrders.length - 1; i >= 0; i--) {
        const rawOrderData = allOrders[i];
        const orderData = rawOrderData.order;

        const orderId = rawOrderData.id.toString();
        const onRamper = orderData.onRamper;
        const onRamperEncryptPublicKey = orderData.onRamperEncryptPublicKey.substring(2);
        const amountToReceive = orderData.amountToReceive;
        const maxAmountToPay = orderData.maxAmountToPay;
        const status = orderData.status;

        const order: OnRampOrder = {
          orderId,
          onRamper,
          onRamperEncryptPublicKey,
          amountToReceive,
          maxAmountToPay,
          status,
        };

        sanitizedOrders.push(order);
      }

      setFetchedOrders(sanitizedOrders);
    }
  }, [allOrders, isReadAllOrdersLoading, isReadAllOrdersError]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      refetchAllOrders();
    }, 15000); // Refetch every 15 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, [refetchAllOrders]);

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const isChrome = userAgent.indexOf("Chrome") > -1;
    if (!isChrome) {
      setShowBrowserWarning(true);
    }
  }, []);

  /*
    Additional Listeners
  */

  useMount(() => {
    function handleKeyDown() {
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const handleOrderRowClick = (rowData: any[]) => {
    const [rowIndex] = rowData;
    const orderToSelect = fetchedOrders[rowIndex];

    if (orderToSelect.onRamper === address) {
      setActionState(FormState.UPDATE);
    } else {
      setActionState(FormState.CLAIM);
    }

    setSelectedOrderClaim({} as OnRampOrderClaim);
    setSelectedOrder(orderToSelect);
  };

  /*
    Container
  */

  return (
    <Container>
      {showBrowserWarning && <TopBanner message={"ZK P2P On-Ramp only works on Chrome or Chromium-based browsers."} />}
      <div className="title">
        <Header>ZK P2P On-Ramp From Venmo</Header>
        <NumberedInputContainer>
          <span style={{ color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.3'}}>
            This is an experimental application demonstrating zero knowledge proof technology. The ramp
            (<StyledLink
              urlHyperlink={blockExplorer + rampContractAddress}
              label={'smart contract'}/>),
            which performs proof verification and escrow functionality, and its associated fake USDC
            (<StyledLink
              urlHyperlink={blockExplorer + fUSDCContractAddress}
              label={'fUSDC'}/>)
            asset, both live on Goerli / Manta Testnets and will require Goerli ETH / Manta BIT to test.
            We are actively
            <StyledLink
              urlHyperlink={"https://github.com/0xSachinK/zk-p2p-onramp"}
              label={' developing '}/>
            and improving this.
          </span>
          <NumberedStep step={1}>
            On-rampers: the flow will require two transactions. First, you will post orders to the
            on-chain order book. Then, when claims for the order are submitted by off-rampers,
            you will choose a claim to complete on Venmo, generate a proof with the confirmation
            email, and then submit the proof on chain to unlock the fUSDC.
          </NumberedStep>
          <NumberedStep step={2}>
            Off-rampers: the flow will require your Venmo Id
            (<StyledLink
              urlHyperlink="https://github.com/0xSachinK/zk-p2p-onramp/blob/main/README.md#fetching-venmo-id-instructions"
              label={'instructions'}/>).
            Additionally, you will need to mint fUSDC from the contract directly. We have modified
            the generic ERC20 to include an externally accessible mint function. You will also need to approve allowance
            to the smart contract.
          </NumberedStep>
        </NumberedInputContainer>
      </div>
      <Main>
        <Column>
          <SubHeader>Orders</SubHeader>
          <OrderTable
            headers={orderTableHeaders}
            data={orderTableData}
            onRowClick={handleOrderRowClick}
            selectedRow={selectedOrder.orderId - 1} // Order ids start at 1
            rowsPerPage={10}
          />
          <Button
            onClick={async () => {
              setSelectedOrderClaim({} as OnRampOrderClaim);
              setSelectedOrder({} as OnRampOrder);
              setActionState(FormState.NEW);
            }}
          >
            New Order
          </Button>
        </Column>
        <Wrapper>
          {actionState === FormState.NEW && (
            <Column>
              <NewOrderForm loggedInWalletAddress={ethereumAddress}/>
            </Column>
          )}
          {actionState === FormState.CLAIM && (
            <Column>
              <ClaimOrderForm
                loggedInWalletAddress={ethereumAddress}
                selectedOrder={selectedOrder}
                senderRequestedAmountDisplay={formatAmountsForUSDC(selectedOrder.amountToReceive)}
                rampExplorerLink={blockExplorer + rampContractAddress}
                fusdcExplorerLink={blockExplorer + fUSDCContractAddress}
              />
            </Column>
          )}
          {actionState === FormState.UPDATE && (
            <ConditionalContainer>
              <Column>
                <SubmitOrderClaimsForm
                  loggedInWalletAddress={ethereumAddress}
                  selectedOrder={selectedOrder}
                  currentlySelectedOrderClaim={selectedOrderClaim}
                  setSelectedOrderClaim={setSelectedOrderClaim}
                />
              </Column>
              <Column>
                <SubmitOrderGenerateProofForm
                  loggedInWalletAddress={ethereumAddress}
                  selectedOrder={selectedOrder}
                  selectedOrderClaim={selectedOrderClaim}
                  setSubmitOrderProof={setSubmitOrderProof}
                  setSubmitOrderPublicSignals={setSubmitOrderPublicSignals}
                />
              </Column>
              <Column>
                <SubmitOrderOnRampForm
                  proof={submitOrderProof}
                  publicSignals={submitOrderPublicSignals}
                />
              </Column>
            </ConditionalContainer>
          )}
        </Wrapper>
      </Main>
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  margin: 0 auto;

  & .title {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  & .main {
    & .signaturePane {
      flex: 1;
      display: flex;
      flex-direction: column;
      & > :first-child {
        height: calc(30vh + 24px);
      }
    }
  }

  & .bottom {
    display: flex;
    flex-direction: column;
    align-items: center;
    & p {
      text-align: center;
    }
    & .labeledTextAreaContainer {
      align-self: center;
      max-width: 50vw;
      width: 500px;
    }
  }
`;

const Main = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
`;

const Wrapper = styled.div`
  gap: 1rem;
  align-self: flex-start;
`;

const ConditionalContainer = styled.div`
  display: grid;
  gap: 1rem;
  align-self: flex-start;
`;

const Column = styled.div`
  gap: 1rem;
  align-self: flex-start;
  background: rgba(255, 255, 255, 0.1);
  padding: 1.5rem;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
`;

const NumberedInputContainer = styled(Col)`
  gap: 1rem;
  width: 50%;
  margin-bottom: 2rem;
`;
