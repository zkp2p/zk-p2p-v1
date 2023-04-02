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
                    // const mail =
                    //   "RGVsaXZlcmVkLVRvOiBiaXN3YWppdHNhbXByaXRpQGdtYWlsLmNvbQ0KUmVjZWl2ZWQ6IGJ5IDIwMDI6YTA1OjY1MTI6M2UxNTowOjA6MDowIHdpdGggU01UUCBpZCBpMjFjc3AzMTExMzI2bGZ2Ow0KICAgICAgICBXZWQsIDIwIEp1bCAyMDIyIDIwOjU1OjIwIC0wNzAwIChQRFQpDQpYLUdvb2dsZS1TbXRwLVNvdXJjZTogQUdSeU0xdVV1cmtpL0RJRHR0ckFEM1I3Z2Y4SXNWSGFXamhqaHRtKzNsSkp6RmI4SVZMdmEyUEY1YmZXTllHaDBObHRSdFJvUDJjSg0KWC1SZWNlaXZlZDogYnkgMjAwMjphMDU6NjIyYTo1MTQ6YjA6MzFmOmI1OjdkNmUgd2l0aCBTTVRQIGlkIGwyMC0yMDAyMGEwNTYyMmEwNTE0MDBiMDAzMWYwMGI1N2Q2ZW1yODI1NTQ3NHF0eC42NzcuMTY1ODM3NTcxOTgxNDsNCiAgICAgICAgV2VkLCAyMCBKdWwgMjAyMiAyMDo1NToxOSAtMDcwMCAoUERUKQ0KQVJDLVNlYWw6IGk9MTsgYT1yc2Etc2hhMjU2OyB0PTE2NTgzNzU3MTk7IGN2PW5vbmU7DQogICAgICAgIGQ9Z29vZ2xlLmNvbTsgcz1hcmMtMjAxNjA4MTY7DQogICAgICAgIGI9T2hMY1c4TFV0RDFmNGNEQTZ3Qk13MnhwMzEvMlJtQURtWU8ycEM0T09FbExFY1FQRnQxZTFhNzAwejVUWmNqMS9hDQogICAgICAgICBNajl5dGxKa2ladGg5SzlzSjRMc2x1QmRudk1YQndDbmc0R2w1b0tTWEpoNlZiUmtWUm5nZWhrZlB2L2ZyMkhNNGthQg0KICAgICAgICAgMHRaWEVMK3JGUjJLNjN1MmVTODVKbnlmYkh6a2t5eDJiMlBKWW1CUDJnN2tUbkR6SDJnOUhOK2cvekk5czlEbERMTUMNCiAgICAgICAgIEwzNnZrbGprcTI5a1V3aUVjUU5hbVRiREFNUUk2ZFlhMmtCbVMveFdKUDVrY0dOb3lMNzFSc2x3R3R3SE15dyt1NWlvDQogICAgICAgICBsdDlkWVRHbDBMWWlyelJvdlBPUXV4eVJFaTdlYlBuN1A4VytDVUpjem1ENjhnTFA1WWFUYjBwR0FIWWF0dGJyNURRSw0KICAgICAgICAgSmJBZz09DQpBUkMtTWVzc2FnZS1TaWduYXR1cmU6IGk9MTsgYT1yc2Etc2hhMjU2OyBjPXJlbGF4ZWQvcmVsYXhlZDsgZD1nb29nbGUuY29tOyBzPWFyYy0yMDE2MDgxNjsNCiAgICAgICAgaD10bzpzdWJqZWN0Om1lc3NhZ2UtaWQ6ZGF0ZTpmcm9tOm1pbWUtdmVyc2lvbjpka2ltLXNpZ25hdHVyZTsNCiAgICAgICAgYmg9VysvWkdkQjFkM0lVOHhGNkNBUGJwNENpRDlLY2VVU3hnV2lmeFhBZkYrdz07DQogICAgICAgIGI9T25jWXZINlFnUjFHeG82Y0VGNmV4ZEdzekl5YVFaeEFRWEFXbWNuOW1hWXdRQmNWZW9HTjNGNGpURUJXMjVDV3d0DQogICAgICAgICBVUHNacnlXdExhbDNmaHF1VzVDSHF5VWNNOGlTYXRnUUt3dkFJUGVaT0pZMFpuenRtbmdmZHdwTDliSUFyRlhuR2prRA0KICAgICAgICAgTkhRLzEwTUZxRG9uNzgwR2diTXNReVJHOS83U2NwMXBySUowTTFvNGlCWUtIRFBiNkJHRkg3Q3dPcWUycWE5TnNTVy8NCiAgICAgICAgIFZnTmovU3B1QlJuTDNsZlpsZnN1MC93WlVENWNjb1pJeS9IdlllRjFYczF0bG9aWENqcWtoQ1c4RzZOZmpjRzluYkZUDQogICAgICAgICBmakZJSS9XallkazZSSkRXaUt3N0p3UUF4a3hKMHhOcEpyMUZSUDFhdGRsSGFoQ1B1QWhvUUp0MFBsdGdFUi9jU1VJcQ0KICAgICAgICAgNWlkQT09DQpBUkMtQXV0aGVudGljYXRpb24tUmVzdWx0czogaT0xOyBteC5nb29nbGUuY29tOw0KICAgICAgIGRraW09cGFzcyBoZWFkZXIuaT1AbWl0LmVkdSBoZWFkZXIucz1vdXRnb2luZyBoZWFkZXIuYj1lSGNxYmRoRzsNCiAgICAgICBzcGY9cGFzcyAoZ29vZ2xlLmNvbTogZG9tYWluIG9mIGFheXVzaGdAbWl0LmVkdSBkZXNpZ25hdGVzIDE4LjkuMjguMTEgYXMgcGVybWl0dGVkIHNlbmRlcikgc210cC5tYWlsZnJvbT1hYXl1c2hnQG1pdC5lZHU7DQogICAgICAgZG1hcmM9cGFzcyAocD1OT05FIHNwPU5PTkUgZGlzPU5PTkUpIGhlYWRlci5mcm9tPW1pdC5lZHUNClJldHVybi1QYXRoOiA8YWF5dXNoZ0BtaXQuZWR1Pg0KUmVjZWl2ZWQ6IGZyb20gb3V0Z29pbmcubWl0LmVkdSAob3V0Z29pbmctYXV0aC0xLm1pdC5lZHUuIFsxOC45LjI4LjExXSkNCiAgICAgICAgYnkgbXguZ29vZ2xlLmNvbSB3aXRoIEVTTVRQUyBpZCBhMTgtMjAwMjBhYzg0NGIyMDAwMDAwYjAwMzFlZGY0NjZiNzNzaTQ2NjAxN3F0by42NC4yMDIyLjA3LjIwLjIwLjU1LjE5DQogICAgICAgIGZvciA8Ymlzd2FqaXRzYW1wcml0aUBnbWFpbC5jb20+DQogICAgICAgICh2ZXJzaW9uPVRMUzFfMiBjaXBoZXI9RUNESEUtRUNEU0EtQUVTMTI4LUdDTS1TSEEyNTYgYml0cz0xMjgvMTI4KTsNCiAgICAgICAgV2VkLCAyMCBKdWwgMjAyMiAyMDo1NToxOSAtMDcwMCAoUERUKQ0KUmVjZWl2ZWQtU1BGOiBwYXNzIChnb29nbGUuY29tOiBkb21haW4gb2YgYWF5dXNoZ0BtaXQuZWR1IGRlc2lnbmF0ZXMgMTguOS4yOC4xMSBhcyBwZXJtaXR0ZWQgc2VuZGVyKSBjbGllbnQtaXA9MTguOS4yOC4xMTsNCkF1dGhlbnRpY2F0aW9uLVJlc3VsdHM6IG14Lmdvb2dsZS5jb207DQogICAgICAgZGtpbT1wYXNzIGhlYWRlci5pPUBtaXQuZWR1IGhlYWRlci5zPW91dGdvaW5nIGhlYWRlci5iPWVIY3FiZGhHOw0KICAgICAgIHNwZj1wYXNzIChnb29nbGUuY29tOiBkb21haW4gb2YgYWF5dXNoZ0BtaXQuZWR1IGRlc2lnbmF0ZXMgMTguOS4yOC4xMSBhcyBwZXJtaXR0ZWQgc2VuZGVyKSBzbXRwLm1haWxmcm9tPWFheXVzaGdAbWl0LmVkdTsNCiAgICAgICBkbWFyYz1wYXNzIChwPU5PTkUgc3A9Tk9ORSBkaXM9Tk9ORSkgaGVhZGVyLmZyb209bWl0LmVkdQ0KUmVjZWl2ZWQ6IGZyb20gbWFpbC15dzEtZjE4Mi5nb29nbGUuY29tIChtYWlsLXl3MS1mMTgyLmdvb2dsZS5jb20gWzIwOS44NS4xMjguMTgyXSkNCgkoYXV0aGVudGljYXRlZCBiaXRzPTApDQogICAgICAgIChVc2VyIGF1dGhlbnRpY2F0ZWQgYXMgYWF5dXNoZ0BBVEhFTkEuTUlULkVEVSkNCglieSBvdXRnb2luZy5taXQuZWR1ICg4LjE0LjcvOC4xMi40KSB3aXRoIEVTTVRQIGlkIDI2TDN0STdPMDA4NTM0DQoJKHZlcnNpb249VExTdjEvU1NMdjMgY2lwaGVyPUFFUzEyOC1HQ00tU0hBMjU2IGJpdHM9MTI4IHZlcmlmeT1OT1QpDQoJZm9yIDxiaXN3YWppdHNhbXByaXRpQGdtYWlsLmNvbT47IFdlZCwgMjAgSnVsIDIwMjIgMjM6NTU6MTkgLTA0MDANCkRLSU0tU2lnbmF0dXJlOiB2PTE7IGE9cnNhLXNoYTI1NjsgYz1yZWxheGVkL3JlbGF4ZWQ7IGQ9bWl0LmVkdTsgcz1vdXRnb2luZzsNCgl0PTE2NTgzNzU3MTk7IGJoPVcrL1pHZEIxZDNJVTh4RjZDQVBicDRDaUQ5S2NlVVN4Z1dpZnhYQWZGK3c9Ow0KCWg9RnJvbTpEYXRlOlN1YmplY3Q6VG87DQoJYj1lSGNxYmRoR29GNVM4N2YrOXIvWFB0dDVEYmdCandnb1lUcytKTVBIcUFIZ2hzazhLVVRoQTFyZkhab2hvTENVUQ0KCSBxamVEbW1rQXg0aDdKeS9ldG1nemdJSGEwZmhVRHpmbDh6Y1NZUVNDU29zM0NRTERieVlkYzNVMjJyWW0xcVhmVE4NCgkgYzRsYlhJMVQvbit0b25tcnkyMG8wZ2I1YlhMVGZVWjZTblc5RitXSGhhUFBYY0pvK3cyNzREeExoL2tJcjRTaEJNDQoJIC80Qk16MHNOaXVHeGQrZzFyR3lsclAvcjVnTTRxeHl6SlRVZjA4UVljeCtEUURVc3o3dlpVUXZLUjVJV3dSSit6TA0KCSBCZjY5cElwckZuakIzeXk1MWVxeGpIZXFnWDFWeE5GVlV0S2FoZm5VTys0dTRWVGRBQzk1MU5rRDFLRzRzb0NHWVgNCgkgYmFIMnR6Ny96QXZnQT09DQpSZWNlaXZlZDogYnkgbWFpbC15dzEtZjE4Mi5nb29nbGUuY29tIHdpdGggU01UUCBpZCAwMDcyMTE1N2FlNjgyLTMxZTQ1NTI3ZGE1c280OTg5NTU3YjMuNQ0KICAgICAgICBmb3IgPGJpc3dhaml0c2FtcHJpdGlAZ21haWwuY29tPjsgV2VkLCAyMCBKdWwgMjAyMiAyMDo1NToxOCAtMDcwMCAoUERUKQ0KWC1HbS1NZXNzYWdlLVN0YXRlOiBBSklvcmE4aXlsUmVNZmU2RWxSL0hHL3AvTXFDcGhJVGNEL2hvYkpXS0ZZU3hWQVVOMHYycmIzbg0KCUMwc2s0dkdlcmlVUklNbkdxWCsrdUhMcFZzNHlPY3pscGFLZ3FIdz0NClgtUmVjZWl2ZWQ6IGJ5IDIwMDI6YTBkOmY2YzU6MDpiMDozMWQ6YWY3ZDo1ZDRmIHdpdGggU01UUCBpZA0KIGcxODgtMjAwMjBhMGRmNmM1MDAwMDAwYjAwMzFkYWY3ZDVkNGZtcjQ0MjU4MTI2eXdmLjE4Ny4xNjU4Mzc1NzE4MDA3OyBXZWQsIDIwDQogSnVsIDIwMjIgMjA6NTU6MTggLTA3MDAgKFBEVCkNCk1JTUUtVmVyc2lvbjogMS4wDQpGcm9tOiBBYXl1c2ggR3VwdGEgPGFheXVzaGdAbWl0LmVkdT4NCkRhdGU6IFdlZCwgMjAgSnVsIDIwMjIgMjM6NTU6MDYgLTA0MDANClgtR21haWwtT3JpZ2luYWwtTWVzc2FnZS1JRDogPENBK09KNVFmRU9NN0VFYlV6MCsya1cwdXQ2b0RaVDZ0c0J5N3BUazZEZ3pBTlQtTGROd0BtYWlsLmdtYWlsLmNvbT4NCk1lc3NhZ2UtSUQ6IDxDQStPSjVRZkVPTTdFRWJVejArMmtXMHV0Nm9EWlQ2dHNCeTdwVGs2RGd6QU5ULUxkTndAbWFpbC5nbWFpbC5jb20+DQpTdWJqZWN0OiBkZXNwZXJhdGVseSB0cnlpbmcgdG8gbWFrZSBpdCB0byBjaGFpbg0KVG86ICJiaXN3YWppdHNhbXByaXRpQGdtYWlsLmNvbSIgPGJpc3dhaml0c2FtcHJpdGlAZ21haWwuY29tPg0KQ29udGVudC1UeXBlOiBtdWx0aXBhcnQvYWx0ZXJuYXRpdmU7IGJvdW5kYXJ5PSIwMDAwMDAwMDAwMDA5Mzc3YWYwNWU0NDhhZjUxIg0KDQotLTAwMDAwMDAwMDAwMDkzNzdhZjA1ZTQ0OGFmNTENCkNvbnRlbnQtVHlwZTogdGV4dC9wbGFpbjsgY2hhcnNldD0iVVRGLTgiDQoNCndpbGwgd2UgbWFrZSBpdCB0aGlzIHRpbWUgaW50byB0aGUgemsgcHJvb2YNCg0KLS0wMDAwMDAwMDAwMDA5Mzc3YWYwNWU0NDhhZjUxDQpDb250ZW50LVR5cGU6IHRleHQvaHRtbDsgY2hhcnNldD0iVVRGLTgiDQoNCjxkaXYgZGlyPSJhdXRvIj53aWxsIHdlIG1ha2UgaXQgdGhpcyB0aW1lIGludG8gdGhlIHprIHByb29mPC9kaXY+DQoNCi0tMDAwMDAwMDAwMDAwOTM3N2FmMDVlNDQ4YWY1MS0tDQo=";

                    const formattedArray = await insert13Before10(Uint8Array.from(Buffer.from(emailFull)));
                    // Due to a quirk in carriage return parsing in JS, we need to manually edit carriage returns to match DKIM parsing
                    console.log("formattedArray", formattedArray);
                    console.log("buffFormArray", Buffer.from(formattedArray.buffer));
                    console.log("buffFormArray", formattedArray.toString());

                    let input = "";
                    try {
                      input = await generate_input.generate_inputs(Buffer.from(formattedArray.buffer));
                      // input = await generate_input.generate_inputs(Buffer.from(emailFull));
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
                    console.time("zk-dl");
                    recordTimeForActivity("startedDownloading");
                    setDisplayMessage("Downloading compressed proving files... (this may take a few minutes)");
                    setStatus("downloading-proof-files");
                    await downloadProofFiles(filename, () => {
                      setDownloadProgress((p) => p + 1);
                    });
                    console.timeEnd("zk-dl");
                    recordTimeForActivity("finishedDownloading");

                    /*
                      Generate proof
                    */
                    console.time("zk-gen");
                    recordTimeForActivity("startedProving");
                    setDisplayMessage("Starting proof generation... (this will take 6-10 minutes and ~5GB RAM)");
                    setStatus("generating-proof");
                    console.log("Starting proof generation");
                    // alert("Generating proof, will fail due to input");
                    const { proof, publicSignals } = await generateProof(input, filename);
                    //const proof = JSON.parse('{"pi_a": ["19201501460375869359786976350200749752225831881815567077814357716475109214225", "11505143118120261821370828666956392917988845645366364291926723724764197308214", "1"], "pi_b": [["17114997753466635923095897108905313066875545082621248342234075865495571603410", "7192405994185710518536526038522451195158265656066550519902313122056350381280"], ["13696222194662648890012762427265603087145644894565446235939768763001479304886", "2757027655603295785352548686090997179551660115030413843642436323047552012712"], ["1", "0"]], "pi_c": ["6168386124525054064559735110298802977718009746891233616490776755671099515304", "11077116868070103472532367637450067545191977757024528865783681032080180232316", "1"], "protocol": "groth16", "curve": "bn128"}');
                    //const publicSignals = JSON.parse('["0", "0", "0", "0", "0", "0", "0", "0", "32767059066617856", "30803244233155956", "0", "0", "0", "0", "27917065853693287", "28015", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "113659471951225", "0", "0", "1634582323953821262989958727173988295", "1938094444722442142315201757874145583", "375300260153333632727697921604599470", "1369658125109277828425429339149824874", "1589384595547333389911397650751436647", "1428144289938431173655248321840778928", "1919508490085653366961918211405731923", "2358009612379481320362782200045159837", "518833500408858308962881361452944175", "1163210548821508924802510293967109414", "1361351910698751746280135795885107181", "1445969488612593115566934629427756345", "2457340995040159831545380614838948388", "2612807374136932899648418365680887439", "16021263889082005631675788949457422", "299744519975649772895460843780023483", "3933359104846508935112096715593287", "556307310756571904145052207427031380052712977221"]');
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
                >
                  {displayMessage}
                </Button>
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
