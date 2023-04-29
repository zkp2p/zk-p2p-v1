// @ts-ignore
import React, { useEffect, useState } from "react";
import { useMount } from "react-use";

// @ts-ignore
import styled from "styled-components";
import { NewOrderForm } from "../components/NewOrderForm";
import { ClaimOrderForm } from "../components/ClaimOrderForm";
import { SubmitOrderClaimsForm } from "../components/SubmitOrderClaimsForm";
import { SubmitOrderGenerateProofForm } from "../components/SubmitOrderGenerateProofForm";
import { SubmitOrderOnRampForm } from "../components/SubmitOrderOnRampForm";
import { Button } from "../components/Button";
import { Header, SubHeader } from "../components/Layout";
import { TopBanner } from "../components/TopBanner";
import { CustomTable } from '../components/CustomTable';
import {
  useAccount, 
  useContractWrite, 
  useContractRead, 
  useNetwork, 
  usePrepareContractWrite,
} from "wagmi";
import { abi } from "../helpers/ramp.abi";
import { contractAddresses } from "../helpers/deployed_addresses";
import { OnRampOrder, OnRampOrderClaim } from "../helpers/types";


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
  
  // ----- transaction state -----
  const [newOrderAmount, setNewOrderAmount] = useState<number>(0);
  const [newOrderVenmoIdEncryptingKey, setNewOrderVenmoIdEncryptingKey] = useState<string>('');

  const [claimOrderEncryptedVenmoHandle, setClaimOrderEncryptedVenmoHandle] = useState<string>('');
  const [claimOrderHashedVenmoHandle, setClaimOrderHashedVenmoHandle] = useState<string>('');
  const [claimOrderRequestedAmount, setClaimOrderRequestedAmount] = useState<number>(0);

  const [submitOrderPublicSignals, setSubmitOrderPublicSignals] = useState<string>('');
  const [submitOrderProof, setSubmitOrderProof] = useState<string>('');
  
  // fetched on-chain state
  const [fetchedOrders, setFetchedOrders] = useState<OnRampOrder[]>([]);
  const [fetchedOrderClaims, setFetchedOrderClaims] = useState<OnRampOrderClaim[]>([]);


  const { chain } = useNetwork()
  console.log("Chain: ", chain);

  const getOrderStatusString = (order: OnRampOrder) => {
    switch (Number(order.status)) {
      case 1:
        return "Open";
      case 2:
        return "Filled";
      case 3:
        return "Cancelled";
      default:
        return "The order has an invalid status.";
    }
  }

  const formatAmountsForUSDC = (tokenAmount: number) => {
    const adjustedAmount = tokenAmount / (10 ** 6);
    return adjustedAmount;
  };

  const formatAmountsForTransactionParameter = (tokenAmount: number) => {
    const adjustedAmount = tokenAmount * (10 ** 6);
    return adjustedAmount;
  };

  // order table state
  const orderTableHeaders = ['Sender', 'Token Amount', 'Max', 'Status'];
  const orderTableData = fetchedOrders.map((order) => [
    formatAddressForTable(order.sender),
    formatAmountsForUSDC(order.amount),
    formatAmountsForUSDC(order.maxAmount),
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
    addressOrName: contractAddresses["goerli"]["ramp"],
    contractInterface: abi,
    functionName: 'getAllOrders',
  });

  // getClaimsForOrder(uint256 _orderId) external view returns (OrderClaim[] memory) {
  const {
    data: orderClaimsData,
    isLoading: isReadOrderClaimsLoading,
    isError: isReadOrderClaimsError,
    refetch: refetchClaimedOrders,
  } = useContractRead({
    addressOrName: contractAddresses["goerli"]["ramp"],
    contractInterface: abi,
    functionName: 'getClaimsForOrder',
    args: [selectedOrder.orderId],
  });

  /*
    Contract Writes
  */

  // postOrder(uint256 _amount, uint256 _maxAmountToPay) external onlyRegisteredUser() 
  const { config: writeCreateOrderConfig } = usePrepareContractWrite({
    addressOrName: contractAddresses["goerli"]["ramp"],
    contractInterface: abi,
    functionName: 'postOrder',
    args: [
      formatAmountsForTransactionParameter(newOrderAmount),
      formatAmountsForTransactionParameter(newOrderAmount)  // TODO: Replace when new contract is deployed
      // newOrderVenmoIdEncryptingKey                       // TODO: Update when new contract is deployed
    ],
    onError: (error: { message: any }) => {
      console.error(error.message);
    },
  });

  const {
    isLoading: isWriteNewOrderLoading,
    write: writeNewOrder
  } = useContractWrite(writeCreateOrderConfig);

  //
  // claimOrder(uint256 _orderNonce) external  onlyRegisteredUser()
  //
  const { config: writeClaimOrderConfig } = usePrepareContractWrite({
    addressOrName: contractAddresses["goerli"]["ramp"],
    contractInterface: abi,
    functionName: 'claimOrder',
    args: [
      selectedOrder.orderId
      // formatAmountsForTransactionParameter(claimOrderRequestedAmount)  // TODO: Update when new contract is deployed
      // claimOrderEncryptedVenmoHandle,                                  // TODO: Update when new contract is deployed
      // claimOrderHashedVenmoHandle                                      // TODO: Update when new contract is deployed

    ],
    onError: (error: { message: any }) => {
      console.error(error.message);
    },
  });

  const {
    isLoading: isWriteClaimOrderLoading,
    write: writeClaimOrder
  } = useContractWrite(writeClaimOrderConfig);


  //
  // onRamp( uint256 _orderId, uint256 _offRamper, VenmoId, bytes calldata _proof) external onlyRegisteredUser()
  //
  const reformatProofForChain = (proof: string) => {
    return [
      proof ? JSON.parse(proof)["pi_a"].slice(0, 2) : null,
      proof
        ? JSON.parse(proof)
            ["pi_b"].slice(0, 2)
            .map((g2point: any[]) => g2point.reverse())
        : null,
      proof ? JSON.parse(proof)["pi_c"].slice(0, 2) : null,
    ];
  };

  const { config: writeCompleteOrderConfig } = usePrepareContractWrite({
    addressOrName: contractAddresses["goerli"]["ramp"],
    contractInterface: abi,
    functionName: 'onRamp',
    args: [
      ...reformatProofForChain(submitOrderProof),
      submitOrderPublicSignals ? JSON.parse(submitOrderPublicSignals) : null
      // selectedOrder.id                                                 // TODO: Update when new contract is deployed
    ],
    onError: (error: { message: any }) => {
      console.error(error.message);
    },
  });

  const {
    isLoading: isWriteCompleteOrderLoading,
    write: writeCompleteOrder
  } = useContractWrite(writeCompleteOrderConfig);

  /*
    Hooks
  */

  // Fetch Orders
  useEffect(() => {
    if (!isReadAllOrdersLoading && !isReadAllOrdersError && allOrders) {
      const sanitizedOrders: OnRampOrder[] = [];
      for (let i = 0; i < allOrders.length; i++) {
        const orderContractData = allOrders[i];

        const orderId = orderContractData[0];
        const sender = orderContractData[1];
        const amount = orderContractData[2].toString();
        const maxAmount = orderContractData[3].toString();
        const status = orderContractData[4];
        const encryptingKey = 'a19eb5cdd6b3fce15832521908e4f66817e9ea8728dde4469f517072616a590be610c8af6d616fa77806b4d3ac1176634f78cd29266b4bdae4110ac3cdeb9231';

        const order: OnRampOrder = {
          orderId,
          sender,
          amount,
          maxAmount,
          status,
          encryptingKey
        };

        sanitizedOrders.push(order);
      }

      setFetchedOrders(sanitizedOrders);
    }
  }, [allOrders, isReadAllOrdersLoading, isReadAllOrdersError]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      refetchAllOrders();
    }, 1000000); // Refetch every 1000 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, [refetchAllOrders]);

  // Fetch Order Claims
  useEffect(() => {
    if (!isReadOrderClaimsLoading && !isReadOrderClaimsError && orderClaimsData) {
      const sanitizedOrderClaims: OnRampOrderClaim[] = [];
      for (let i = 0; i < orderClaimsData.length; i++) {
        const claimsData = orderClaimsData[i];

        const venmoId = claimsData[0].toString();
        const status = claimsData[1];
        const expirationTimestamp = claimsData[2].toString();

        const requestedAmount = 10;
        const encryptedVenmoHandle = "ffbe561f64308242b6a9ba573c3cdf5e02de60494c23a4b56668ab40db4bf1ba82d49c6d1af289abfb58eaaeb1826096c2ba1025fbce9c14fda51789d01e0c9c393d5e9b0bcb75fd530434b3c963ff8466a811c686cdd7531bf2c551b8fcab3af34b839f95d500abe83879abf42f9d4918";
        const hashedVenmoHandle = "0x24506DC1918183960Ac04dB859EB293B115952af";
        
        const orderClaim: OnRampOrderClaim = {
          venmoId,
          status,
          expirationTimestamp,
          requestedAmount,
          encryptedVenmoHandle,
          hashedVenmoHandle
        };

        sanitizedOrderClaims.push(orderClaim);
      }

      setFetchedOrderClaims(sanitizedOrderClaims);
    }
  }, [orderClaimsData, isReadOrderClaimsLoading, isReadOrderClaimsError]);

  useEffect(() => {
    if (selectedOrder) {
      const intervalId = setInterval(() => {
        refetchClaimedOrders();
      }, 1000000); // Refetch every 1000 seconds
  
      return () => {
        clearInterval(intervalId);
      };
    }
  }, [selectedOrder, refetchClaimedOrders]);

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const isChrome = userAgent.indexOf("Chrome") > -1;
    if (!isChrome) {
      setShowBrowserWarning(true);
    }
  }, []);

  useEffect(() => {
    if (address) {
      setEthereumAddress(address);
    } else {
      setEthereumAddress("");
    }
  }, [address]);

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

    if (orderToSelect.sender === address) {
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
      </div>
      <Main>
        <Column>
          <SubHeader>Orders</SubHeader>
          <CustomTable
            headers={orderTableHeaders}
            data={orderTableData}
            onRowClick={handleOrderRowClick}
            selectedRow={selectedOrder.orderId - 1}
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
              <NewOrderForm
                loggedInWalletAddress={ethereumAddress}
                newOrderAmount={newOrderAmount}
                setNewOrderAmount={setNewOrderAmount}
                setVenmoIdEncryptingKey={setNewOrderVenmoIdEncryptingKey}
                writeNewOrder={writeNewOrder}
                isWriteNewOrderLoading={isWriteNewOrderLoading}
              />
            </Column>
          )}
          {actionState === FormState.CLAIM && (
            <Column>
              <ClaimOrderForm
                senderEncryptingKey={selectedOrder.encryptingKey}
                senderAddressDisplay={selectedOrder.sender}
                senderRequestedAmountDisplay={formatAmountsForUSDC(selectedOrder.amount)}
                setRequestedUSDAmount={setClaimOrderRequestedAmount}
                setEncryptedVenmoHandle={setClaimOrderEncryptedVenmoHandle}
                setHashedVenmoHandle={setClaimOrderHashedVenmoHandle}
                writeClaimOrder={writeClaimOrder}
                isWriteClaimOrderLoading={isWriteClaimOrderLoading}
              />
            </Column>
          )}
          {actionState === FormState.UPDATE && (
            <ConditionalContainer>
              <Column>
                <SubmitOrderClaimsForm
                  loggedInWalletAddress={ethereumAddress}
                  orderClaims={fetchedOrderClaims}
                  currentlySelectedOrderClaim={selectedOrderClaim}
                  setSelectedOrderClaim={setSelectedOrderClaim}
                />
              </Column>
              <Column>
                <SubmitOrderGenerateProofForm
                  loggedInWalletAddress={ethereumAddress}
                  setSubmitOrderProof={setSubmitOrderProof}
                  setSubmitOrderPublicSignals={setSubmitOrderPublicSignals}
                />
              </Column>
              <Column>
                <SubmitOrderOnRampForm
                  proof={submitOrderProof}
                  publicSignals={submitOrderPublicSignals}
                  setSubmitOrderProof={setSubmitOrderProof}
                  setSubmitOrderPublicSignals={setSubmitOrderPublicSignals}
                  writeCompleteOrder={writeCompleteOrder}
                  isWriteCompleteOrderLoading={isWriteCompleteOrderLoading}
                />
              </Column>
            </ConditionalContainer>
          )}
        </Wrapper>
      </Main>
    </Container>
  );
};

const ConditionalContainer = styled.div`
  display: grid;
  gap: 1rem;
  align-self: flex-start;
`;

const Main = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
`;

const Column = styled.div`
  gap: 1rem;
  align-self: flex-start;
  background: rgba(255, 255, 255, 0.1);
  padding: 1.5rem;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
`;

const Wrapper = styled.div`
  gap: 1rem;
  align-self: flex-start;
`;

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
