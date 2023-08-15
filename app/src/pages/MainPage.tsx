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
  useAccount, 
  useContractRead, 
  useNetwork, 
} from "wagmi";

import { abi } from "../helpers/ramp.abi";
import { useRampContractAddress, useUSDCContractAddress } from '../hooks/useContractAddress';
import { OnRampOrder, OnRampOrderClaim } from "../helpers/types";
import { formatAmountsForUSDC, getOrderStatusString } from '../helpers/tableFormatters';


enum FormState {
  DEFAULT = "DEFAULT",
  NEW = "NEW",
  CLAIM = "CLAIM",
  UPDATE = "UPDATE",
}

export const MainPage: React.FC<{}> = (props) => {
  // fetch account and network
  const { address } = useAccount();
  const { chain } = useNetwork();

  const rampAddress = useRampContractAddress(chain);
  const usdcAddress = useUSDCContractAddress(chain);

  /*
    App State
  */

  const [ethereumAddress, setEthereumAddress] = useState<string>(address ?? "");
  const [showBrowserWarning, setShowBrowserWarning] = useState<boolean>(false);

  // ----- application state -----
  const [actionState, setActionState] = useState<FormState>(FormState.DEFAULT);

  const [selectedOrder, setSelectedOrder] = useState<OnRampOrder>({} as OnRampOrder);
  const [selectedOrderClaim, setSelectedOrderClaim] = useState<OnRampOrderClaim >({} as OnRampOrderClaim);

  const [rampContractAddress, setRampContractAddress] = useState<string>(useRampContractAddress(chain));
  const [usdcContractAddress, setUSDCContractAddress] = useState<string>(useUSDCContractAddress(chain));

  const [blockExplorer, setBlockExplorer] = useState<string>('https://optimistic.etherscan.io/address/');

  // ----- transaction state -----
  const [submitOrderPublicSignals, setSubmitOrderPublicSignals] = useState<string>('');
  const [submitOrderProof, setSubmitOrderProof] = useState<string>('');

  // fetched on-chain state
  const [fetchedOrders, setFetchedOrders] = useState<OnRampOrder[]>([]);

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
    addressOrName: useRampContractAddress(chain),
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

  // TODO: Move block explorer into hook as well
  useEffect(() => {
    if (chain) {
      let explorer;
      switch (chain.network) {
        case "optimism":
          explorer = 'https://optimistic.etherscan.io/address/';
          break;
        
        case "goerli":
          explorer = 'https://goerli.etherscan.io/address/';
          break;

        default:
          explorer = '';
          break;
      }

      setRampContractAddress(rampAddress);
      setUSDCContractAddress(usdcAddress);
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
        <Header>Fiat to Crypto On-Ramp From Venmo</Header>
        <NumberedInputContainer>
          <span style={{ color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.3'}}>
            This is an experimental app demonstrating zero knowledge proof technology using a ramp <StyledLink
            urlHyperlink={blockExplorer + rampContractAddress}
            label={'smart contract'}/> to verify proof of payment made on Venmo, a popular P2P payment service,
            and then exchange for USDC. See our <StyledLink 
            urlHyperlink={"https://drive.google.com/file/d/1BmTyeAfsi4K9iuZQ-G6YBGv5SqysUHj5/view?usp=sharing"}
            label={"demo video"}/> for a quick walkthrough. This project is supported by the <StyledLink
            urlHyperlink={"https://www.appliedzkp.org/projects/zkp2p"}
            label={'PSE Group'}/> within the Ethereum Foundation and we are actively <StyledLink
            urlHyperlink={"https://github.com/0xSachinK/zk-p2p-onramp"}
            label={'developing'}/> the next version with improvements.
          </span>
          <NumberedStep step={1}>
            On-rampers: post an order to the order book for the desired USDC amount (max 20). Wait for a claim to be
            submitted by an off-ramper, and then send the requested fiat amount on Venmo. After receiving a confirmation email
            from Venmo, you will generate and then submit the proof to receive the USDC.
          </NumberedStep>
          <NumberedStep step={2}>
            Off-rampers: the flow will require your numeric <StyledLink
            urlHyperlink="https://github.com/0xSachinK/zk-p2p-onramp/blob/main/README.md#fetching-venmo-id-instructions"
            label={'Venmo ID'}/> and some USDC. You will also need to approve allowance to the ramp smart contract above.
            Submitting a claim escrows the USDC amount which can be clawed back if the claim is not completed by the on-ramper.
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
                usdcExplorerLink={blockExplorer + usdcContractAddress}
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
