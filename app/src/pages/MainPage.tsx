// @ts-ignore
import React, { useEffect, useMemo, useState } from "react";
import { useAsync, useMount, useUpdateEffect } from "react-use";
// @ts-ignore
// @ts-ignore
import _, { add } from "lodash";
// @ts-ignore
import { generate_inputs, insert13Before10 } from "../scripts/generate_input";
import styled, { CSSProperties } from "styled-components";
import { sshSignatureToPubKey } from "../helpers/sshFormat";
import { getIdFromHandle, getHandleFromId } from "../helpers/handleToVId";
import { Link, useSearchParams } from "react-router-dom";
import { dkimVerify } from "../helpers/dkim";
import atob from "atob";
import { downloadProofFiles, generateProof, verifyProof } from "../helpers/zkp";
import { packedNBytesToString } from "../helpers/binaryFormat";
import { LabeledTextArea } from "../components/LabeledTextArea";
import { SingleLineInput } from "../components/SingleLineInput";
import { ReadOnlyInput } from "../components/ReadOnlyInput";
import { Button } from "../components/Button";
import { Col, Row } from "../components/Layout";
// import { NumberedStep } from "../components/NumberedStep";
import { TopBanner } from "../components/TopBanner";
import { CustomTable } from '../components/CustomTable';
import { useAccount, useContractWrite, useContractRead, usePrepareContractWrite } from "wagmi";
import { ProgressBar } from "../components/ProgressBar";
import { abi } from "../helpers/ramp.abi";
import { inputBuffer } from "../helpers/inputBuffer";
import { isSetIterator } from "util/types";
var Buffer = require("buffer/").Buffer; // note: the trailing slash is important!

const generate_input = require("../scripts/generate_input");

enum FormState {
  DEFAULT = "DEFAULT",
  NEW = "NEW",
  CLAIM = "CLAIM",
  UPDATE = "UPDATE",
}

enum OrderStatus {
  UNOPENED = "unopened",
  OPEN = "open",
  FILLED = "filled",
  CANCELLED = "cancelled",
}

interface OnRampOrder {
  orderId: number;
  sender: string;
  amount: number;
  maxAmount: number;
  status: OrderStatus;
}

enum OrderClaimStatus {
  UNSUBMITTED = "unsubmitted",
  SUBMITTED = "submitted",
  USED = "used",
  CLAWBACK = "clawback"
}

interface OnRampOrderClaim {
  venmoId: string;
  status: OrderClaimStatus;
  expirationTimestamp: number;
}

export const MainPage: React.FC<{}> = (props) => {
  // raw user inputs
  const filename = "email";

  /*
    App State
  */

  const [emailSignals, setEmailSignals] = useState<string>("");
  const [publicSignals, setPublicSignals] = useState<string>(localStorage.publicSignals || "");
  const [displayMessage, setDisplayMessage] = useState<string>("Generate Proof");
  const [emailHeader, setEmailHeader] = useState<string>("");
  const { address } = useAccount();
  const [ethereumAddress, setEthereumAddress] = useState<string>(address ?? "");
  
  const [verificationMessage, setVerificationMessage] = useState("");
  const [verificationPassed, setVerificationPassed] = useState(false);
  // const [lastAction, setLastAction] = useState<"" | "sign" | "verify" | "send">("");
  const [showBrowserWarning, setShowBrowserWarning] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  
  // ----- new state -----
  const [lastAction, setLastAction] = useState<"" | "new" | "create" | "claim" | "cancel" | "complete" | "sign">("");
  const [newOrderAmount, setNewOrderAmount] = useState<number>(0);
  const [newOrderMaxAmount, setNewOrderMaxAmount] = useState<number>(0);
  const [actionState, setActionState] = useState<FormState>(FormState.DEFAULT);
  const [selectedOrder, setSelectedOrder] = useState<OnRampOrder>({} as OnRampOrder);
  const [selectedOrderClaim, setSelectedOrderClaim] = useState<OnRampOrderClaim >({} as OnRampOrderClaim);
  const [emailFull, setEmailFull] = useState<string>(localStorage.emailFull || "");
  const [proof, setProof] = useState<string>(localStorage.proof || "");
  
  // fetched state
  const [orders, setOrders] = useState<OnRampOrder[]>([]);
  const [orderClaims, setOrderClaims] = useState<OnRampOrderClaim[]>([]);

  // computed state
  const { value, error } = useAsync(async () => {
    try {
      const circuitInputs = await generate_inputs(Buffer.from(atob(emailFull)));
      return circuitInputs;
    } catch (e) {
      return {};
    }
  }, [emailFull, ethereumAddress]);

  const circuitInputs = value || {};
  console.log("Circuit inputs:", circuitInputs);

  function formattedExpiration(unixTimestamp: number): string {
    const currentTimestamp = Math.floor(Date.now() / 1000);
  
    if (currentTimestamp > unixTimestamp) {
      return "Expired";
    } else {
      const date = new Date(unixTimestamp * 1000);
      const formattedDate = date.toLocaleString();
      return formattedDate;
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

  // table state
  const orderTableHeaders = ['Sender', 'Token Amount', 'Max', 'Status'];
  const orderTableData = orders.map((order) => [
    formatAddressForTable(order.sender),
    formatAmountsForUSDC(order.amount),
    formatAmountsForUSDC(order.maxAmount),
    order.status,
  ]);

  const orderClaimsTableHeaders = ['Taker', 'Venmo Handle', 'Expiration'];
  const orderClaimsTableData = orderClaims.map((orderClaim) => [
    formatAddressForTable('0xfC5D59a09397e4979812F0da631e0cE8cbAce6D3'), // TODO: should we return the claimer address?
    getHandleFromId(orderClaim.venmoId),
    formattedExpiration(orderClaim.expirationTimestamp),
  ]);

  /*
    Misc Helpers
  */

  let formHeaderText;
  switch (actionState) {
    case FormState.NEW: // Maker creates a new order
      formHeaderText = "New Order";
      break;
    case FormState.CLAIM: // Taker selects an order to claim it
      formHeaderText = "Claim Order";
      break;
    case FormState.UPDATE: // Maker selects their order to cancel or complete it
      formHeaderText = "Complete or Cancel Order";
      break;
    default: // Form loads with no order selected
      formHeaderText = "Create or Select an Order";
  }

  function formatAddressForTable(addressToFormat: string) {
    if (addressToFormat == address) {
      return "You";
    } else {
      const prefix = addressToFormat.substring(0, 4);
      const suffix = addressToFormat.substring(addressToFormat.length - 4);
      return `${prefix}...${suffix}`;
    }
  }

  function getIndexForSelectedClaim(claim: OnRampOrderClaim): number {
    return orderClaims.findIndex((orderClaim) => orderClaim.venmoId === claim.venmoId);
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
    addressOrName: '0xfC5D59a09397e4979812F0da631e0cE8cbAce6D3',
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
    addressOrName: '0xfC5D59a09397e4979812F0da631e0cE8cbAce6D3',
    contractInterface: abi,
    functionName: 'getClaimsForOrder',
    args: [selectedOrder.orderId],
  });

  /*
    Contract Writes
  */

  // postOrder(uint256 _amount, uint256 _maxAmountToPay) external onlyRegisteredUser() 
  const { config: writeCreateOrderConfig } = usePrepareContractWrite({
    addressOrName: '0xfC5D59a09397e4979812F0da631e0cE8cbAce6D3',
    contractInterface: abi,
    functionName: 'postOrder',
    args: [formatAmountsForTransactionParameter(newOrderAmount), formatAmountsForTransactionParameter(newOrderMaxAmount)],
    onError: (error: { message: any }) => {
      console.error(error.message);
    },
  });

  const {
    data: newOrderData,
    isLoading: isWriteNewOrderLoading,
    isSuccess: isWriteNewOrderSuccess,
    write: writeNewOrder
  } = useContractWrite(writeCreateOrderConfig);
  // console.log(
  //   "Create new order txn details:",
  //   writeNewOrder,
  //   newOrderData,
  //   isWriteNewOrderLoading,
  //   isWriteNewOrderSuccess,
  //   writeCreateOrderConfig
  // );

  // claimOrder(uint256 _orderNonce) external  onlyRegisteredUser()
  const { config: writeClaimOrderConfig } = usePrepareContractWrite({
    addressOrName: '0xfC5D59a09397e4979812F0da631e0cE8cbAce6D3',
    contractInterface: abi,
    functionName: 'claimOrder',
    args: [selectedOrder?.orderId],
    onError: (error: { message: any }) => {
      console.error(error.message);
    },
  });

  const {
    data: claimOrderData,
    isLoading: isWriteClaimOrderLoading,
    isSuccess: isWriteClaimOrderSuccess,
    write: writeClaimOrder
  } = useContractWrite(writeClaimOrderConfig);
  // console.log(
  //   "Create claim order txn details:",
  //   writeClaimOrder,
  //   claimOrderData,
  //   isWriteClaimOrderLoading,
  //   isWriteClaimOrderSuccess,
  //   writeClaimOrderConfig
  // );

  // onRamp( uint256 _orderId, uint256 _offRamper, VenmoId, bytes calldata _proof) external onlyRegisteredUser()
  const { config: writeCompleteOrderConfig } = usePrepareContractWrite({
    addressOrName: '0xfC5D59a09397e4979812F0da631e0cE8cbAce6D3',
    contractInterface: abi,
    functionName: 'onRamp',
    args: [selectedOrder?.orderId], // TODO: pass in the completed proof
    // args: [...reformatProofForChain(proof), publicSignals ? JSON.parse(publicSignals) : null],
    onError: (error: { message: any }) => {
      console.error(error.message);
    },
  });

  const {
    data: completeOrderData,
    isLoading: isWriteCompleteOrderLoading,
    isSuccess: isWriteCompleteOrderSuccess,
    write: writeCompleteOrder
  } = useContractWrite(writeCompleteOrderConfig);
  // console.log(
  //   "Create complete order txn details:",
  //   proof,
  //   publicSignals,
  //   writeCompleteOrder,
  //   completeOrderData,
  //   isWriteCompleteOrderLoading,
  //   isWriteCompleteOrderSuccess,
  //   writeCompleteOrderConfig
  // );

  // TODO: function cancelOrder(uint256 _orderId) external

  // TODO: function clawback(uint256 _orderId) external {

  /*
    Hooks
  */

  // Fetch Orders
  useEffect(() => {
    console.log('Attempting to set orders...');

    if (!isReadAllOrdersLoading && !isReadAllOrdersError && allOrders) {
      // console.log('Fetched orders...');
      
      const sanitizedOrders: OnRampOrder[] = [];
      for (let i = 0; i < allOrders.length; i++) {
        const orderContractData = allOrders[i];

        // console.log('Fetched order data:', orderContractData);

        const orderId = orderContractData[0];
        const sender = orderContractData[1];
        const amount = orderContractData[2].toString();
        const maxAmount = orderContractData[3].toString();
        const status = orderContractData[4];

        const order: OnRampOrder = {
          orderId,
          sender,
          amount,
          maxAmount,
          status,
        };

        // console.log('Adding order to sanitizedOrders:', order);

        sanitizedOrders.push(order);
      }

      // Update orders state
      setOrders(sanitizedOrders);
    }
  }, [allOrders, isReadAllOrdersLoading, isReadAllOrdersError]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      console.log('Refetching orders...');

      refetchAllOrders();
    }, 15000); // Refetch every 15 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, [refetchAllOrders]);

  // Fetch Order Claims
  useEffect(() => {
    if (!isReadOrderClaimsLoading && !isReadOrderClaimsError && orderClaimsData) {
      // console.log('Fetched order claims');
      
      const sanitizedOrderClaims: OnRampOrderClaim[] = [];
      for (let i = 0; i < orderClaimsData.length; i++) {
        const claimsData = orderClaimsData[i];

        // console.log('Fetched order claim data:', claimsData);

        const venmoId = claimsData[0].toString();
        console.log(venmoId);
        const status = claimsData[1];
        console.log(status);
        const expirationTimestamp = claimsData[2].toString();
        console.log(expirationTimestamp);
        
        const orderClaim: OnRampOrderClaim = {
          venmoId,
          status,
          expirationTimestamp
        };

        console.log('Adding order claims to sanitizedOrderClaims:', orderClaim);

        sanitizedOrderClaims.push(orderClaim);
      }

      // Update order claims state
      setOrderClaims(sanitizedOrderClaims);
    }
  }, [orderClaimsData, isReadOrderClaimsLoading, isReadOrderClaimsError]);

  useEffect(() => {
    if (selectedOrder) {
      const intervalId = setInterval(() => {
        // console.log('Refetching order claims...');

        refetchClaimedOrders();
      }, 15000); // Refetch every 15 seconds
  
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
  const [status, setStatus] = useState<
    | "not-started"
    | "generating-input"
    | "downloading-proof-files"
    | "generating-proof"
    | "error-bad-input"
    | "error-failed-to-download"
    | "error-failed-to-prove"
    | "done"
    | "sending-on-chain"
    | "sent"
  >("not-started");
  const [zkeyStatus, setzkeyStatus] = useState<Record<string, string>>({
    a: "not started",
    b: "not started",
    c: "not started",
    d: "not started",
    e: "not started",
    f: "not started",
    g: "not started",
    h: "not started",
    i: "not started",
    k: "not started",
  });
  const [stopwatch, setStopwatch] = useState<Record<string, number>>({
    startedDownloading: 0,
    finishedDownloading: 0,
    startedProving: 0,
    finishedProving: 0,
  });

  const recordTimeForActivity = (activity: string) => {
    setStopwatch((prev) => ({
      ...prev,
      [activity]: Date.now(),
    }));
  };

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

  /*
    Additional Listeners
  */

  useMount(() => {
    function handleKeyDown() {
      setLastAction("");
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // local storage stuff
  useUpdateEffect(() => {
    if (value) {
      if (localStorage.emailFull !== emailFull) {
        console.info("Wrote email to localStorage");
        localStorage.emailFull = emailFull;
      }
    }
    if (proof) {
      if (localStorage.proof !== proof) {
        console.info("Wrote proof to localStorage");
        localStorage.proof = proof;
      }
    }
    if (publicSignals) {
      if (localStorage.publicSignals !== publicSignals) {
        console.info("Wrote publicSignals to localStorage");
        localStorage.publicSignals = publicSignals;
      }
    }
  }, [value]);

  if (error) console.error(error);

  const handleOrderRowClick = (rowData: any[]) => {
    const [rowIndex] = rowData;
    const orderToSelect = orders[rowIndex];

    // console.log("Selected order: ", orderToSelect)
    // console.log(orders)

    if (orderToSelect.sender === address) {
      setActionState(FormState.UPDATE);
    } else {
      setActionState(FormState.CLAIM);
    }

    setSelectedOrderClaim({} as OnRampOrderClaim);
    setSelectedOrder(orderToSelect);
  };

  const handleOrderClaimRowClick = (rowData: any[]) => {
    const [rowIndex] = rowData;
    const orderClaimToSelect = orderClaims[rowIndex];

    // This does nothing for now, we are recording the selected row to pass the order id into proving
    console.log("Selected order claim: ", orderClaimToSelect)

    setSelectedOrderClaim(orderClaimToSelect);
  };

  /*
    Container
  */

  return (
    <Container>
      {showBrowserWarning && <TopBanner message={"ZK P2P On-Ramp only works on Chrome or Chromium-based browsers."} />}
      <div className="title">
        <Header>ZK P2P On-Ramp From Venmo Header</Header>
      </div>
      <Main>
        <Column>
          <SubHeader>Orders</SubHeader>
          <CustomTable headers={orderTableHeaders} data={orderTableData} onRowClick={handleOrderRowClick} selectedRow={selectedOrder.orderId - 1}/>
          <Button
            onClick={async () => {
              setLastAction("new");
              setSelectedOrderClaim({} as OnRampOrderClaim);
              setSelectedOrder({} as OnRampOrder);
              setActionState(FormState.NEW);
            }}
          >
            New Order
          </Button>
        </Column>
        <Column>
          <SubHeader>{formHeaderText}</SubHeader>
          {actionState === FormState.NEW && (
            <ConditionalContainer>
              <SingleLineInput
                label="Amount"
                value={newOrderAmount}
                onChange={(e) => {
                  setNewOrderAmount(e.currentTarget.value);
                }}
              />
              <SingleLineInput
                label="Max Amount"
                value={newOrderMaxAmount}
                onChange={(e) => {
                  setNewOrderMaxAmount(e.currentTarget.value);
                }}
              />
              <Button
                disabled={isWriteNewOrderLoading}
                onClick={async () => {
                  setLastAction("create");
                  setActionState(FormState.NEW);
                  writeNewOrder?.();
                }}
              >
                Create
              </Button>
            </ConditionalContainer>
          )}
          {actionState === FormState.CLAIM && (
            <ConditionalContainer>
              <ReadOnlyInput
                label="Sender"
                value={selectedOrder.sender}
              />
              <ReadOnlyInput
                label="Amount"
                value={formatAmountsForUSDC(selectedOrder.amount)}
              />
              <ReadOnlyInput
                label="Max Amount"
                value={formatAmountsForUSDC(selectedOrder.maxAmount)}
              />
              <ReadOnlyInput
                label="Venmo Handle (Send Request for Amount Here)"
                value={selectedOrder.sender}
              />
                <Button
                  disabled={isWriteClaimOrderLoading}
                  onClick={async () => {
                    setLastAction("claim");
                    // write txn
                  }}
                >
                  Claim Order
                </Button>
            </ConditionalContainer>
          )}
          {actionState === FormState.UPDATE && (
            <ConditionalContainer>
              <ReadOnlyInput
                label="Amount (USDC)"
                value={formatAmountsForUSDC(selectedOrder.amount)}
              />
              <H3>
                Select Claim and Complete
              </H3>
              <CustomTable headers={orderClaimsTableHeaders} data={orderClaimsTableData} onRowClick={handleOrderClaimRowClick} selectedRow={getIndexForSelectedClaim(selectedOrderClaim)}/>
              <LabeledTextArea
                label="Full Email with Headers"
                value={emailFull}
                onChange={(e) => {
                  setEmailFull(e.currentTarget.value);
                }}
              />
              <H3>
                Proof
              </H3>
              <LabeledTextArea
                label="Proof Output"
                value={proof}
                onChange={(e) => {
                  setProof(e.currentTarget.value);
                }}
                warning={verificationMessage}
                warningColor={verificationPassed ? "green" : "red"}
              />
              <LabeledTextArea
                label="..."
                value={publicSignals}
                secret
                onChange={(e) => {
                  setPublicSignals(e.currentTarget.value);
                }}
                // warning={
                // }
              />
              <ButtonContainer>
                <Button
                  // disabled={emailFull.length === 0 || !selectedOrderClaim}
                  onClick={async () => {
                    console.log("Generating proof...");
                    setDisplayMessage("Generating proof...");
                    setStatus("generating-input");

                    const formattedArray = await insert13Before10(Uint8Array.from(Buffer.from(emailFull)));
                    // Due to a quirk in carriage return parsing in JS, we need to manually edit carriage returns to match DKIM parsing
                    console.log("formattedArray", formattedArray);
                    console.log("buffFormArray", Buffer.from(formattedArray.buffer));
                    console.log("buffFormArray", formattedArray.toString());

                    let input = "";
                    try {
                      // input = await generate_input.generate_inputs(Buffer.from(formattedArray.buffer));
                      input = {"in_padded":["102","114","111","109","58","86","101","110","109","111","32","60","118","101","110","109","111","64","118","101","110","109","111","46","99","111","109","62","13","10","114","101","112","108","121","45","116","111","58","86","101","110","109","111","32","78","111","45","114","101","112","108","121","32","60","110","111","45","114","101","112","108","121","64","118","101","110","109","111","46","99","111","109","62","13","10","116","111","58","114","105","99","104","97","114","100","108","105","97","110","103","50","48","49","53","64","117","46","110","111","114","116","104","119","101","115","116","101","114","110","46","101","100","117","13","10","115","117","98","106","101","99","116","58","89","111","117","32","99","111","109","112","108","101","116","101","100","32","65","108","101","120","32","83","111","111","110","103","39","115","32","36","49","46","48","48","32","99","104","97","114","103","101","32","114","101","113","117","101","115","116","13","10","109","105","109","101","45","118","101","114","115","105","111","110","58","49","46","48","13","10","99","111","110","116","101","110","116","45","116","121","112","101","58","109","117","108","116","105","112","97","114","116","47","97","108","116","101","114","110","97","116","105","118","101","59","32","98","111","117","110","100","97","114","121","61","34","45","45","45","45","61","95","80","97","114","116","95","50","54","53","55","48","54","56","95","49","52","48","55","55","49","57","51","50","54","46","49","54","56","48","51","55","52","50","48","49","49","56","53","34","13","10","109","101","115","115","97","103","101","45","105","100","58","60","48","49","48","48","48","49","56","55","51","101","49","98","55","98","53","100","45","102","100","101","98","55","51","102","101","45","50","49","57","98","45","52","53","97","53","45","57","52","50","56","45","102","100","101","102","53","50","50","54","54","99","57","52","45","48","48","48","48","48","48","64","101","109","97","105","108","46","97","109","97","122","111","110","115","101","115","46","99","111","109","62","13","10","100","97","116","101","58","83","97","116","44","32","49","32","65","112","114","32","50","48","50","51","32","49","56","58","51","54","58","52","49","32","43","48","48","48","48","13","10","100","107","105","109","45","115","105","103","110","97","116","117","114","101","58","118","61","49","59","32","97","61","114","115","97","45","115","104","97","50","53","54","59","32","113","61","100","110","115","47","116","120","116","59","32","99","61","114","101","108","97","120","101","100","47","115","105","109","112","108","101","59","32","115","61","121","122","108","97","118","113","51","109","108","52","106","108","52","108","116","54","100","108","116","98","103","109","110","111","102","116","120","102","116","107","108","121","59","32","100","61","118","101","110","109","111","46","99","111","109","59","32","116","61","49","54","56","48","51","55","52","50","48","49","59","32","104","61","70","114","111","109","58","82","101","112","108","121","45","84","111","58","84","111","58","83","117","98","106","101","99","116","58","77","73","77","69","45","86","101","114","115","105","111","110","58","67","111","110","116","101","110","116","45","84","121","112","101","58","77","101","115","115","97","103","101","45","73","68","58","68","97","116","101","59","32","98","104","61","82","104","43","56","86","50","84","100","79","43","102","65","118","76","118","99","84","107","99","70","82","90","70","122","83","109","84","74","97","56","74","121","85","111","89","48","86","116","113","120","48","88","48","61","59","32","98","61","128","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","20","176","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],"modulus":["683441457792668103047675496834917209","1011953822609495209329257792734700899","1263501452160533074361275552572837806","2083482795601873989011209904125056704","642486996853901942772546774764252018","1463330014555221455251438998802111943","2411895850618892594706497264082911185","520305634984671803945830034917965905","47421696716332554","0","0","0","0","0","0","0","0"],"signature":["1267577788236740082217339412588774567","2437130502136956571482115812614274825","2498179615826250561207908571825152062","1210165745768524060318433895963473295","1747887311958608858936884743725752614","587087532306996456191055826982967480","765381988032181976452419558049935905","1506974244634433930383840670728497148","44501204514172246","0","0","0","0","0","0","0","0"],"in_len_padded_bytes":"704","precomputed_sha":["164","42","47","49","157","47","210","88","230","156","108","89","233","192","28","45","40","101","99","186","154","181","95","136","172","171","55","158","26","19","135","214"],"in_body_padded":["32","32","32","32","32","32","32","32","32","60","33","45","45","32","97","99","116","111","114","32","110","97","109","101","32","45","45","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","97","32","115","116","121","108","101","61","51","68","34","99","111","108","111","114","58","35","48","48","55","52","68","69","59","32","116","101","120","116","45","100","101","99","111","114","97","116","105","111","110","58","110","111","110","101","34","32","104","114","101","102","61","51","68","34","104","116","61","13","10","116","112","115","58","47","47","118","101","110","109","111","46","99","111","109","47","99","111","100","101","63","117","115","101","114","95","105","100","61","51","68","54","52","53","55","49","54","52","55","51","48","50","48","52","49","54","49","56","54","38","97","99","116","111","114","95","105","100","61","51","68","49","49","54","56","56","54","57","54","49","49","55","57","56","53","61","13","10","50","56","57","54","54","34","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","65","108","101","120","32","83","111","111","110","103","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","47","97","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","33","45","45","32","97","99","116","105","111","110","32","45","45","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","115","112","97","110","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","99","104","97","114","103","101","100","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","47","115","112","97","110","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","33","45","45","32","114","101","99","105","112","105","101","110","116","32","110","97","109","101","32","45","45","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","97","32","115","116","121","108","101","61","51","68","34","99","111","108","111","114","58","35","48","48","55","52","68","69","59","32","116","101","120","116","45","100","101","99","111","114","97","116","105","111","110","58","110","111","110","101","34","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","104","114","101","102","61","51","68","34","104","116","116","112","115","58","47","47","118","101","110","109","111","46","99","111","109","47","99","111","100","101","63","117","115","101","114","95","105","100","61","51","68","49","49","54","56","56","54","57","54","49","49","55","57","56","53","61","13","10","50","56","57","54","54","38","97","99","116","111","114","95","105","100","61","51","68","49","49","54","56","56","54","57","54","49","49","55","57","56","53","50","56","57","54","54","34","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","89","111","117","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","47","97","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","32","32","32","32","32","60","47","100","105","118","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","60","33","45","45","32","110","111","116","101","32","45","45","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","60","100","105","118","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","112","62","52","50","60","47","112","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","60","47","100","105","118","62","13","10","32","32","32","32","32","32","32","32","60","47","116","100","62","13","10","32","32","32","32","60","47","116","114","62","13","10","32","32","32","32","60","116","114","62","13","10","32","32","32","32","32","32","32","32","60","116","100","62","60","47","116","100","62","13","10","32","32","32","32","32","32","32","32","60","116","100","32","115","116","121","108","101","61","51","68","34","102","111","110","116","45","115","105","122","101","58","49","52","112","120","59","112","97","100","100","105","110","103","45","108","101","102","116","58","50","112","120","59","99","111","108","111","114","58","35","50","70","51","48","51","51","59","34","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","84","114","97","110","115","102","101","114","32","68","97","116","101","32","97","110","100","32","65","109","111","117","110","116","58","13","10","32","32","32","32","32","32","32","32","60","47","116","100","62","13","10","32","32","32","32","60","47","116","114","62","13","10","32","32","32","32","60","116","114","62","13","10","32","32","32","32","32","32","32","32","60","116","100","62","60","47","116","100","62","13","10","32","32","32","32","32","32","32","32","60","116","100","32","115","116","121","108","101","61","51","68","34","102","111","110","116","45","115","105","122","101","58","49","52","112","120","59","112","97","100","100","105","110","103","45","108","101","102","116","58","50","112","120","59","99","111","108","111","114","58","35","50","70","51","48","51","51","59","34","62","13","10","32","32","32","32","32","32","32","32","60","33","45","45","32","100","97","116","101","44","32","97","117","100","105","101","110","99","101","44","32","97","110","100","32","97","109","111","117","110","116","32","45","45","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","60","115","112","97","110","62","65","112","114","32","48","49","44","32","50","48","50","51","32","80","68","84","60","47","115","112","97","110","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","60","115","112","97","110","62","32","61","67","50","61","66","55","32","60","47","115","112","97","110","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","60","105","109","103","32","115","116","121","108","101","61","51","68","34","118","101","114","116","105","99","97","108","45","97","108","105","103","110","58","32","45","49","112","120","59","32","119","105","100","116","104","58","32","49","50","112","120","59","32","104","101","105","103","104","116","58","32","49","50","112","120","59","34","61","13","10","32","115","114","99","61","51","68","34","104","116","116","112","115","58","47","47","115","51","46","97","109","97","122","111","110","97","119","115","46","99","111","109","47","118","101","110","109","111","47","97","117","100","105","101","110","99","101","47","112","114","105","118","97","116","101","95","118","50","46","112","110","103","34","32","97","108","116","61","51","68","34","112","114","105","118","61","13","10","97","116","101","34","47","62","13","10","32","32","32","32","32","32","32","32","32","32","32","61","50","48","13","10","13","10","32","32","32","32","32","32","32","32","32","32","32","32","60","33","45","45","32","97","109","111","117","110","116","32","45","45","62","13","10","32","32","32","32","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","32","32","32","32","32","60","115","112","97","110","32","115","116","121","108","101","61","51","68","34","102","108","111","97","116","58","114","105","103","104","116","59","34","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","45","32","36","49","46","48","48","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","32","32","32","32","32","60","47","115","112","97","110","62","13","10","32","32","32","32","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","32","60","47","116","100","62","13","10","32","32","32","32","60","47","116","114","62","13","10","32","32","32","61","50","48","13","10","32","32","32","61","50","48","13","10","32","32","32","61","50","48","13","10","32","32","32","32","60","116","114","62","13","10","32","32","32","32","32","32","32","32","60","116","100","62","60","47","116","100","62","13","10","32","32","32","32","32","32","32","32","60","116","100","32","115","116","121","108","101","61","51","68","34","112","97","100","100","105","110","103","45","116","111","112","58","49","48","112","120","59","34","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","60","116","97","98","108","101","32","115","116","121","108","101","61","51","68","34","119","105","100","116","104","58","49","55","48","112","120","59","32","116","97","98","108","101","45","108","97","121","111","117","116","58","102","105","120","101","100","59","102","111","110","116","45","115","105","122","101","58","49","52","112","120","59","61","13","10","34","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","116","98","111","100","121","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","116","114","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","116","100","32","115","116","121","108","101","61","51","68","34","112","97","100","100","105","110","103","58","53","112","120","32","48","59","32","116","101","120","116","45","97","108","105","103","110","58","99","101","110","116","101","114","59","32","98","111","114","100","101","114","45","114","61","13","10","97","100","105","117","115","58","53","48","112","120","59","32","98","97","99","107","103","114","111","117","110","100","45","99","111","108","111","114","58","35","48","48","55","52","68","69","59","34","32","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","97","32","104","114","101","102","61","51","68","34","104","116","116","112","115","58","47","47","118","101","110","109","111","46","99","111","109","47","115","116","111","114","121","47","51","55","55","49","53","55","48","49","55","49","51","51","56","55","51","56","61","13","10","48","51","56","63","107","61","51","68","100","56","50","51","57","50","55","56","45","57","49","100","101","45","52","100","52","54","45","56","101","97","101","45","102","54","49","53","52","55","98","101","53","97","51","51","34","32","115","116","121","108","101","61","51","68","34","116","101","120","116","45","100","101","99","111","114","97","116","105","111","110","58","110","111","110","101","61","13","10","59","32","99","111","108","111","114","58","32","35","102","102","102","59","100","105","115","112","108","97","121","58","98","108","111","99","107","59","119","105","100","116","104","58","49","48","48","37","59","34","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","76","105","107","101","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","47","97","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","47","116","100","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","116","100","32","115","116","121","108","101","61","51","68","34","112","97","100","100","105","110","103","58","53","112","120","32","48","59","32","98","111","114","100","101","114","45","114","97","100","105","117","115","58","53","48","112","120","59","32","116","101","120","116","45","97","108","61","13","10","105","103","110","58","99","101","110","116","101","114","59","98","97","99","107","103","114","111","117","110","100","45","99","111","108","111","114","58","35","48","48","55","52","68","69","59","34","32","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","97","32","104","114","101","102","61","51","68","34","104","116","116","112","115","58","47","47","118","101","110","109","111","46","99","111","109","47","115","116","111","114","121","47","51","55","55","49","53","55","48","49","55","49","51","51","56","55","51","56","61","13","10","48","51","56","63","108","111","103","105","110","61","51","68","49","34","32","115","116","121","108","101","61","51","68","34","116","101","120","116","45","100","101","99","111","114","97","116","105","111","110","58","110","111","110","101","59","32","99","111","108","111","114","58","32","35","102","102","102","59","100","105","115","112","108","97","121","58","98","108","111","99","107","59","119","105","100","61","13","10","116","104","58","49","48","48","37","59","34","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","67","111","109","109","101","110","116","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","47","97","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","47","116","100","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","47","116","114","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","47","116","98","111","100","121","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","60","47","116","97","98","108","101","62","13","10","32","32","32","32","32","32","32","32","60","47","116","100","62","13","10","32","32","32","32","60","47","116","114","62","13","10","32","32","32","61","50","48","13","10","60","47","116","98","111","100","121","62","32","60","47","116","97","98","108","101","62","13","10","13","10","13","10","13","10","60","100","105","118","32","115","116","121","108","101","61","51","68","34","109","97","114","103","105","110","45","116","111","112","58","49","48","112","120","59","34","62","60","47","100","105","118","62","13","10","32","32","32","61","50","48","13","10","13","10","32","32","32","32","60","100","105","118","32","115","116","121","108","101","61","51","68","34","99","111","108","111","114","58","35","54","66","54","69","55","54","59","102","111","110","116","45","115","105","122","101","58","49","50","112","120","59","109","97","114","103","105","110","45","116","111","112","58","49","48","112","120","59","112","97","100","100","105","110","103","45","116","111","112","58","61","13","10","49","48","112","120","59","32","98","111","114","100","101","114","45","116","111","112","58","32","49","112","120","32","100","111","116","116","101","100","32","35","99","99","99","34","62","13","10","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","67","111","109","112","108","101","116","101","100","32","118","105","97","32","121","111","117","114","32","86","101","110","109","111","32","98","97","108","97","110","99","101","46","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","32","60","98","114","32","47","62","60","98","114","32","47","62","13","10","32","32","32","32","32","32","32","32","80","97","121","109","101","110","116","32","73","68","58","32","51","55","55","49","53","55","48","49","55","48","53","51","51","49","56","55","55","52","54","13","10","32","32","32","32","32","32","32","61","50","48","13","10","60","47","100","105","118","62","13","10","13","10","32","32","32","61","50","48","13","10","60","100","105","118","32","115","116","121","108","101","61","51","68","34","99","111","108","111","114","58","35","54","66","54","69","55","54","59","102","111","110","116","45","115","105","122","101","58","49","50","112","120","59","109","97","114","103","105","110","45","116","111","112","58","49","48","112","120","59","112","97","100","100","105","110","103","45","116","111","112","58","49","48","112","120","61","13","10","59","32","98","111","114","100","101","114","45","116","111","112","58","32","49","112","120","32","100","111","116","116","101","100","32","35","99","99","99","34","62","13","10","32","32","32","32","60","100","105","118","32","115","116","121","108","101","61","51","68","34","119","105","100","116","104","58","53","48","37","59","32","112","97","100","100","105","110","103","58","53","112","120","59","32","116","101","120","116","45","97","108","105","103","110","58","99","101","110","116","101","114","59","32","98","111","114","100","101","114","45","114","97","100","105","117","115","58","61","13","10","53","48","112","120","59","32","98","97","99","107","103","114","111","117","110","100","45","99","111","108","111","114","58","35","48","48","55","52","68","69","59","34","62","13","10","32","32","32","32","32","32","32","32","60","97","32","104","114","101","102","61","51","68","34","104","116","116","112","115","58","47","47","118","101","110","109","111","46","99","111","109","47","114","101","102","101","114","114","97","108","47","105","110","118","105","116","101","63","99","97","109","112","97","105","103","110","95","115","101","114","118","105","99","101","61","51","68","101","109","97","61","13","10","105","108","38","99","97","109","112","97","105","103","110","95","116","101","109","112","108","97","116","101","61","51","68","112","97","121","109","101","110","116","46","115","101","110","116","34","32","115","116","121","108","101","61","51","68","34","116","101","120","116","45","100","101","99","111","114","97","116","105","111","110","58","110","111","110","101","59","32","99","111","108","111","114","58","32","61","13","10","35","48","48","48","59","32","100","105","115","112","108","97","121","58","98","108","111","99","107","59","32","119","105","100","116","104","58","49","48","48","37","59","32","102","111","110","116","45","115","105","122","101","58","49","50","112","120","59","34","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","60","100","105","118","32","115","116","121","108","101","61","51","68","34","102","111","110","116","45","115","105","122","101","58","49","52","112","120","59","32","99","111","108","111","114","58","35","102","102","102","59","34","62","73","110","118","105","116","101","32","70","114","105","101","110","100","115","33","60","47","100","105","118","61","13","10","62","13","10","32","32","32","32","32","32","32","32","60","47","97","62","13","10","32","32","32","32","60","47","100","105","118","62","13","10","13","10","13","10","32","32","32","32","60","100","105","118","32","115","116","121","108","101","61","51","68","34","109","97","114","103","105","110","45","98","111","116","116","111","109","58","49","48","112","120","59","34","62","60","47","100","105","118","62","13","10","13","10","60","47","100","105","118","62","13","10","13","10","32","32","32","32","60","100","105","118","32","105","100","61","51","68","34","95","114","101","99","101","105","112","116","95","100","105","115","99","108","111","115","117","114","101","115","34","32","115","116","121","108","101","61","51","68","34","102","111","110","116","45","115","105","122","101","58","49","49","112","120","59","109","97","114","103","105","110","45","116","111","112","58","49","48","112","61","13","10","120","59","112","97","100","100","105","110","103","45","116","111","112","58","49","48","112","120","59","32","98","111","114","100","101","114","45","116","111","112","58","32","49","112","120","32","100","111","116","116","101","100","32","35","99","99","99","34","62","13","10","13","10","32","32","32","32","60","100","105","118","62","13","10","32","32","32","32","32","32","32","32","70","111","114","32","97","110","121","32","105","115","115","117","101","115","44","32","105","110","99","108","117","100","105","110","103","32","116","104","101","32","114","101","99","105","112","105","101","110","116","32","110","111","116","32","114","101","99","101","105","118","105","110","103","32","102","117","110","100","115","44","32","112","108","101","97","115","101","61","13","10","32","99","111","110","116","97","99","116","32","117","115","32","97","116","32","115","117","112","112","111","114","116","64","118","101","110","109","111","46","99","111","109","32","111","114","32","99","97","108","108","32","49","45","56","53","53","45","56","49","50","45","52","52","51","48","46","13","10","32","32","32","32","60","47","100","105","118","62","13","10","13","10","13","10","32","32","32","32","60","100","105","118","32","115","116","121","108","101","61","51","68","34","109","97","114","103","105","110","45","116","111","112","58","49","48","112","120","59","34","62","13","10","32","32","32","32","32","32","32","32","83","101","101","32","111","117","114","32","60","97","32","115","116","121","108","101","61","51","68","34","116","101","120","116","45","100","101","99","111","114","97","116","105","111","110","58","110","111","110","101","59","99","111","108","111","114","58","35","48","48","55","52","68","69","34","32","104","114","101","102","61","51","68","34","104","116","116","61","13","10","112","115","58","47","47","118","101","110","109","111","46","99","111","109","47","108","101","103","97","108","47","114","101","103","117","108","97","116","111","114","121","45","97","103","101","110","99","121","45","99","97","108","105","102","111","114","110","105","97","34","62","100","105","115","99","108","111","115","117","114","101","115","60","47","97","62","32","102","111","114","32","109","111","114","101","61","13","10","32","105","110","102","111","114","109","97","116","105","111","110","46","60","100","105","118","32","115","116","121","108","101","61","51","68","34","109","97","114","103","105","110","45","116","111","112","58","49","48","112","120","59","34","62","80","108","101","97","115","101","32","100","111","32","110","111","116","32","114","101","112","108","121","32","100","105","114","101","99","116","108","121","32","116","61","13","10","111","32","116","104","105","115","32","101","109","97","105","108","46","32","70","111","114","32","109","111","114","101","32","97","115","115","105","115","116","97","110","99","101","44","32","118","105","115","105","116","32","111","117","114","32","72","101","108","112","32","67","101","110","116","101","114","32","97","116","32","60","97","32","115","116","121","108","101","61","51","68","34","116","101","120","61","13","10","116","45","100","101","99","111","114","97","116","105","111","110","58","110","111","110","101","59","99","111","108","111","114","58","35","48","48","55","52","68","69","34","32","104","114","101","102","61","51","68","34","104","116","116","112","115","58","47","47","104","101","108","112","46","118","101","110","109","111","46","99","111","109","34","62","104","101","108","112","46","118","101","110","109","111","61","13","10","46","99","111","109","60","47","97","62","46","60","47","100","105","118","62","60","100","105","118","32","115","116","121","108","101","61","51","68","34","109","97","114","103","105","110","45","116","111","112","58","49","48","112","120","59","34","62","84","104","105","115","32","112","97","121","109","101","110","116","32","119","105","108","108","32","98","101","32","114","101","118","105","101","119","101","61","13","10","100","32","102","111","114","32","99","111","109","112","108","105","97","110","99","101","32","119","105","116","104","32","111","117","114","32","85","115","101","114","32","65","103","114","101","101","109","101","110","116","32","97","110","100","32","105","102","32","119","101","32","100","101","116","101","114","109","105","110","101","32","116","104","97","116","32","116","104","101","114","101","32","105","115","32","61","13","10","97","32","118","105","111","108","97","116","105","111","110","32","98","121","32","101","105","116","104","101","114","32","112","97","114","116","121","44","32","105","116","32","109","97","121","32","98","101","32","114","101","118","101","114","115","101","100","32","111","114","32","121","111","117","114","32","97","98","105","108","105","116","121","32","116","111","32","116","114","97","110","115","102","101","114","61","13","10","32","116","111","32","121","111","117","114","32","98","97","110","107","32","97","99","99","111","117","110","116","32","109","97","121","32","98","101","32","114","101","115","116","114","105","99","116","101","100","46","60","47","100","105","118","62","13","10","32","32","32","32","60","47","100","105","118","62","13","10","13","10","60","47","100","105","118","62","13","10","13","10","60","47","100","105","118","62","13","10","13","10","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","47","100","105","118","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","100","105","118","32","115","116","121","108","101","61","51","68","34","112","97","100","100","105","110","103","58","49","48","112","120","32","49","53","112","120","59","32","99","111","108","111","114","58","32","35","54","66","54","69","55","54","59","32","116","101","120","116","45","97","61","13","10","108","105","103","110","58","32","99","101","110","116","101","114","59","34","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","100","105","118","32","115","116","121","108","101","61","51","68","34","99","111","108","111","114","58","32","35","54","66","54","69","55","54","59","32","109","97","114","103","105","110","45","116","111","112","58","32","53","112","120","59","34","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","86","101","110","109","111","32","105","115","32","97","32","115","101","114","118","105","99","101","32","111","102","32","80","97","121","80","97","108","44","32","73","110","99","46","44","32","97","32","108","105","99","101","110","115","101","100","32","61","13","10","112","114","111","118","105","100","101","114","32","111","102","32","109","111","110","101","121","32","116","114","97","110","115","102","101","114","32","115","101","114","118","105","99","101","115","46","32","65","108","108","32","109","111","110","101","121","32","116","114","97","110","115","109","105","115","115","105","111","110","32","105","115","32","112","114","111","118","105","100","101","100","32","98","121","32","61","13","10","80","97","121","80","97","108","44","32","73","110","99","46","32","112","117","114","115","117","97","110","116","32","116","111","32","60","97","32","104","114","101","102","61","51","68","34","104","116","116","112","115","58","47","47","118","101","110","109","111","46","99","111","109","47","108","101","103","97","108","47","117","115","45","108","105","99","101","110","115","101","115","47","34","32","115","61","13","10","116","121","108","101","61","51","68","34","99","111","108","111","114","58","35","48","48","55","52","68","69","59","32","116","101","120","116","45","100","101","99","111","114","97","116","105","111","110","58","110","111","110","101","34","62","80","97","121","80","97","108","44","32","73","110","99","46","61","69","50","61","56","48","61","57","57","115","32","108","105","99","101","110","115","101","61","13","10","115","60","47","97","62","46","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","47","100","105","118","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","112","32","115","116","121","108","101","61","51","68","34","99","111","108","111","114","58","32","35","54","66","54","69","55","54","59","32","109","97","114","103","105","110","45","116","111","112","58","32","49","52","112","120","59","34","62","80","97","121","80","97","108","61","13","10","32","105","115","32","108","111","99","97","116","101","100","32","97","116","32","60","47","112","62","60","112","32","115","116","121","108","101","61","51","68","34","99","111","108","111","114","58","32","35","54","66","54","69","55","54","59","34","62","50","50","49","49","32","78","111","114","116","104","32","70","105","114","115","116","32","83","116","114","101","101","116","44","32","83","97","61","13","10","110","32","74","111","115","101","44","32","67","65","32","57","53","49","51","49","60","47","112","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","100","105","118","32","115","116","121","108","101","61","51","68","34","109","97","114","103","105","110","45","116","111","112","58","32","53","112","120","59","34","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","100","105","118","32","115","116","121","108","101","61","51","68","34","102","111","110","116","45","115","105","122","101","58","32","115","109","97","108","108","101","114","59","32","109","97","114","103","105","110","45","116","111","61","13","10","112","58","32","50","48","112","120","59","34","62","70","111","114","32","115","101","99","117","114","105","116","121","32","114","101","97","115","111","110","115","44","32","121","111","117","32","99","97","110","110","111","116","32","117","110","115","117","98","115","99","114","105","98","101","32","102","114","111","109","32","112","97","121","109","101","110","116","32","101","109","97","105","108","115","46","61","13","10","60","47","100","105","118","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","47","100","105","118","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","47","100","105","118","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","60","47","100","105","118","62","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","32","32","32","32","32","32","32","32","61","50","48","13","10","32","32","32","32","32","32","32","32","32","32","32","32","60","47","100","105","118","62","13","10","32","32","32","32","32","32","32","32","60","47","100","105","118","62","13","10","32","32","32","32","60","47","98","111","100","121","62","13","10","60","47","104","116","109","108","62","13","10","13","10","45","45","45","45","45","45","61","95","80","97","114","116","95","50","54","53","55","48","54","56","95","49","52","48","55","55","49","57","51","50","54","46","49","54","56","48","51","55","52","50","48","49","49","56","53","45","45","13","10","128","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","1","6","48","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],"in_body_len_padded_bytes":"6400","venmo_user_id_idx":"605","venmo_mm_id_idx":"139","venmo_message_idx":"804","body_hash_idx":"614"}
                    } catch (e) {
                      console.log("Error generating input", e);
                      setDisplayMessage("Prove");
                      setStatus("error-bad-input");
                      return;
                    }
                    console.log("Generated input:", JSON.stringify(input));

                    // Insert input structuring code here
                    // const input = buildInput(pubkey, msghash, sig);
                    // console.log(JSON.stringify(input, (k, v) => (typeof v == "bigint" ? v.toString() : v), 2));

                    /*
                      Download proving files
                    */
                    // console.time("zk-dl");
                    // recordTimeForActivity("startedDownloading");
                    // setDisplayMessage("Downloading compressed proving files... (this may take a few minutes)");
                    // setStatus("downloading-proof-files");
                    // await downloadProofFiles(filename, () => {
                    //   setDownloadProgress((p) => p + 1);
                    // });
                    // console.timeEnd("zk-dl");
                    // recordTimeForActivity("finishedDownloading");

                    /*
                      Generate proof
                    */
                    console.time("zk-gen");
                    recordTimeForActivity("startedProving");
                    setDisplayMessage("Starting proof generation... (this will take 6-10 minutes and ~5GB RAM)");
                    setStatus("generating-proof");
                    console.log("Starting proof generation");
                    // alert("Generating proof, will fail due to input");
                    const { proof, publicSignals } = await generateProof(input, "circuit");
                    
                    console.log("Finished proof generation");
                    console.timeEnd("zk-gen");
                    recordTimeForActivity("finishedProving");

                    /*
                      Retrieve public signals
                    */

                    // alert("Done generating proof");
                    setProof(JSON.stringify(proof));
                    let kek = publicSignals.map((x: string) => BigInt(x));
                    let soln = packedNBytesToString(kek.slice(0, 12));
                    let soln2 = packedNBytesToString(kek.slice(12, 147));
                    let soln3 = packedNBytesToString(kek.slice(147, 150));
                    // setPublicSignals(`From: ${soln}\nTo: ${soln2}\nUsername: ${soln3}`);
                    setPublicSignals(JSON.stringify(publicSignals));

                    if (!circuitInputs) {
                      setStatus("error-failed-to-prove");
                      return;
                    }
                    setLastAction("sign");
                    setDisplayMessage("Finished computing ZK proof");
                    setStatus("done");
                    try {
                      (window as any).cJson = JSON.stringify(circuitInputs);
                      console.log("wrote circuit input to window.cJson. Run copy(cJson)");
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                  style={{ marginRight: "16px" }}
                >
                  {displayMessage}
                </Button>
                <Button
                  disabled={proof.length === 0 || publicSignals.length === 0 || isWriteCompleteOrderLoading}
                  onClick={async () => {
                    setLastAction("cancel");
                    writeCompleteOrder?.();
                  }}
                >
                  Submit Proof and Claim
                </Button>
              </ButtonContainer>
              {displayMessage === "Downloading compressed proving files... (this may take a few minutes)" && (
                  <ProgressBar width={downloadProgress * 10} label={`${downloadProgress} / 10 items`} />
                )}
                <ProcessStatus status={status}>
                  {status !== "not-started" ? (
                    <div>
                      Status:
                      <span data-testid={"status-" + status}>{status}</span>
                    </div>
                  ) : (
                    <div data-testid={"status-" + status}></div>
                  )}
                  <TimerDisplay timers={stopwatch} />
                </ProcessStatus>
            </ConditionalContainer>
          )}
        </Column>
      </Main>
    </Container>
  );
};

const ProcessStatus = styled.div<{ status: string }>`
  font-size: 8px;
  padding: 8px;
  border-radius: 8px;
`;

const ButtonContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between; // Adjust the space between the buttons
`;

const TimerDisplayContainer = styled.div`
  display: flex;
  flex-direction: column;
  font-size: 8px;
`;

const TimerDisplay = ({ timers }: { timers: Record<string, number> }) => {
  return (
    <TimerDisplayContainer>
      {timers["startedDownloading"] && timers["finishedDownloading"] ? (
        <div>
          Zkey Download time:&nbsp;
          <span data-testid="download-time">{timers["finishedDownloading"] - timers["startedDownloading"]}</span>ms
        </div>
      ) : (
        <div></div>
      )}
      {timers["startedProving"] && timers["finishedProving"] ? (
        <div>
          Proof generation time:&nbsp;
          <span data-testid="proof-time">{timers["finishedProving"] - timers["startedProving"]}</span>ms
        </div>
      ) : (
        <div></div>
      )}
    </TimerDisplayContainer>
  );
};

const Header = styled.span`
  font-weight: 600;
  margin-bottom: 1em;
  color: #fff;
  font-size: 2.25rem;
  line-height: 2.5rem;
  letter-spacing: -0.02em;
`;

const ConditionalContainer = styled(Col)`
  width: 100%;
  gap: 1rem;
  align-self: flex-start;
`;

const SubHeader = styled(Header)`
  font-size: 1.7em;
  margin-bottom: 16px;
  color: rgba(255, 255, 255, 0.9);
`;

const H3 = styled(SubHeader)`
  font-size: 1.4em;
  margin-bottom: -8px;
`;

const Main = styled(Row)`
  width: 100%;
  gap: 1rem;
`;

const Column = styled(Col)`
  width: 100%;
  gap: 1rem;
  align-self: flex-start;
  background: rgba(255, 255, 255, 0.1);
  padding: 1.5rem;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
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
