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
    formatAddressForTable('0x6AE571Aaaf8D3bF5769B9318db6Fc9c03a80bc15'), // TODO: should we return the claimer address?
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
    addressOrName: '0x6AE571Aaaf8D3bF5769B9318db6Fc9c03a80bc15',
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
    addressOrName: '0x6AE571Aaaf8D3bF5769B9318db6Fc9c03a80bc15',
    contractInterface: abi,
    functionName: 'getClaimsForOrder',
    args: [selectedOrder.orderId],
  });

  /*
    Contract Writes
  */

  // register(uint256 _venmoId) external
  const { config: writeRegisterOrderConfig } = usePrepareContractWrite({
    addressOrName: '0x6AE571Aaaf8D3bF5769B9318db6Fc9c03a80bc15',
    contractInterface: abi,
    functionName: 'register',
    args: ['645716473020416186'],
    onError: (error: { message: any }) => {
      console.error(error.message);
    },
  });

  const {
    data: newRegistrationData,
    isLoading: isWriteRegistrationLoading,
    isSuccess: isWriteRegistrationSuccess,
    write: writeRegister
  } = useContractWrite(writeRegisterOrderConfig);
  // console.log(
  //   "Create new order txn details:",
  //   writeRegister,
  //   newRegistrationData,
  //   isWriteRegistrationLoading,
  //   isWriteRegistrationSuccess,
  //   writeRegisterOrderConfig
  // ); 

  // postOrder(uint256 _amount, uint256 _maxAmountToPay) external onlyRegisteredUser() 
  const { config: writeCreateOrderConfig } = usePrepareContractWrite({
    addressOrName: '0x6AE571Aaaf8D3bF5769B9318db6Fc9c03a80bc15',
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
    addressOrName: '0x6AE571Aaaf8D3bF5769B9318db6Fc9c03a80bc15',
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

  // onRamp( uint256 _orderId, uint256 _offRamper, VenmoId, bytes calldata _proof) external onlyRegisteredUser()
  const { config: writeCompleteOrderConfig } = usePrepareContractWrite({
    addressOrName: '0x6AE571Aaaf8D3bF5769B9318db6Fc9c03a80bc15',
    contractInterface: abi,
    functionName: 'onRamp',
    args: [
      selectedOrder?.orderId,
      selectedOrderClaim?.venmoId,
      ...reformatProofForChain(proof),
      publicSignals ? JSON.parse(publicSignals) : null
    ],
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
    }, 10000); // Refetch every 10 seconds

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
      }, 10000); // Refetch every 10 seconds
  
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
                      input = inputBuffer
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

                    // const { proof, publicSignals } = await generateProof(input, "circuit");
 
                    const proof = JSON.parse('{"pi_a": ["19201501460375869359786976350200749752225831881815567077814357716475109214225", "11505143118120261821370828666956392917988845645366364291926723724764197308214", "1"], "pi_b": [["17114997753466635923095897108905313066875545082621248342234075865495571603410", "7192405994185710518536526038522451195158265656066550519902313122056350381280"], ["13696222194662648890012762427265603087145644894565446235939768763001479304886", "2757027655603295785352548686090997179551660115030413843642436323047552012712"], ["1", "0"]], "pi_c": ["6168386124525054064559735110298802977718009746891233616490776755671099515304", "11077116868070103472532367637450067545191977757024528865783681032080180232316", "1"], "protocol": "groth16", "curve": "bn128"}');
                    const publicSignals = JSON.parse('["0", "0", "0", "0", "0", "0", "0", "0", "32767059066617856", "30803244233155956", "0", "0", "0", "0", "27917065853693287", "28015", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "113659471951225", "0", "0", "1634582323953821262989958727173988295", "1938094444722442142315201757874145583", "375300260153333632727697921604599470", "1369658125109277828425429339149824874", "1589384595547333389911397650751436647", "1428144289938431173655248321840778928", "1919508490085653366961918211405731923", "2358009612379481320362782200045159837", "518833500408858308962881361452944175", "1163210548821508924802510293967109414", "1361351910698751746280135795885107181", "1445969488612593115566934629427756345", "2457340995040159831545380614838948388", "2612807374136932899648418365680887439", "16021263889082005631675788949457422", "299744519975649772895460843780023483", "3933359104846508935112096715593287", "556307310756571904145052207427031380052712977221"]');
                    
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
