import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import {
  useContractRead,
  useSignMessage,
  useNetwork,
} from 'wagmi'

import { Button } from "./Button";
import { Col, SubHeader } from "./Layout";
import { OrderTable } from './OrderTable';
import { NumberedStep } from "../components/NumberedStep";

import { OnRampOrder, OnRampOrderClaim } from "../helpers/types";
import {
  decryptMessageWithAccount,
  generateAccountFromSignature
} from '../helpers/messagEncryption';
import { generateVenmoIdHash } from "../helpers/venmoHash";
import { formatAmountsForUSDC } from '../helpers/tableFormatters';
import { abi } from "../helpers/ramp.abi";
import { useRampContractAddress } from '../hooks/useContractAddress';


interface SubmitOrderClaimsFormProps {
  loggedInWalletAddress: string;
  selectedOrder: OnRampOrder;
  currentlySelectedOrderClaim: OnRampOrderClaim;
  setSelectedOrderClaim: (claim: OnRampOrderClaim) => void;
}

export const SubmitOrderClaimsForm: React.FC<SubmitOrderClaimsFormProps> = ({
  loggedInWalletAddress,
  selectedOrder,
  currentlySelectedOrderClaim,
  setSelectedOrderClaim
}) => {
  const { chain } = useNetwork();
  
  const accountHashKey = `accountHash_${loggedInWalletAddress}`;
  const [accountHash, setAccountHash] = useState<string>(localStorage.getItem(accountHashKey) || "");

  const {
    data: signedMessageSignature,
    signMessage,
  } = useSignMessage({
    message: 'You are signing a message to log into zkp2p.xyz.',
  })

  const [venmoIdsVisible, setVenmoIdsVisible] = useState<boolean>(false);
  const [decryptedVenmoIds, setDecryptedVenmoIds] = useState<string[]>([]);
  const [hashedVenmoIds, setHashedVenmoIds] = useState<string[]>([]);

  const [fetchedOrderClaims, setFetchedOrderClaims] = useState<OnRampOrderClaim[]>([]);

  const tableHeaders = ['Venmo Account', 'Verified', 'Requested USD Amount', 'Expiration'];
  const tableData = fetchedOrderClaims.map((orderClaim, index) => [
    renderVenmoId(index),
    renderVenmoHashConfirmation(index),
    formatAmountsForUSDC(orderClaim.minAmountToPay),
    formattedExpiration(orderClaim.claimExpirationTime),
  ]);

  function renderVenmoId(index: number) {
    if (venmoIdsVisible && decryptedVenmoIds[index]) {
      const venmoLink = `https://venmo.com/code?user_id=${decryptedVenmoIds[index]}`;
      return <a href={venmoLink} target="_blank" rel="noopener noreferrer">{decryptedVenmoIds[index]}</a>;
    } else {
      return 'Encrypted';
    }
  }

  function renderVenmoHashConfirmation(index: number) {
    if (venmoIdsVisible && hashedVenmoIds[index]) {
      const orderClaim = fetchedOrderClaims[index];
      const orderClaimHashedVenmoId = orderClaim.hashedVenmoId.toString();
      const venmoHash = hashedVenmoIds[index];

      if (orderClaimHashedVenmoId === venmoHash) {
        return 'Matches';
      } else {
        return 'Does Not Match';
      }
    } else {
      return 'Encrypted';
    }
  }

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

  function getIndexForSelectedClaim(selectedClaim: OnRampOrderClaim): number {
    return fetchedOrderClaims.findIndex((orderClaim) => orderClaim.claimId === selectedClaim.claimId);
  }

  /*
    Contract Reads
  */
  
  // getClaimsForOrder(uint256 _orderId) external view returns (OrderClaim[] memory) {
  const {
    data: orderClaimsData,
    isLoading: isReadOrderClaimsLoading,
    isError: isReadOrderClaimsError,
    refetch: refetchClaimedOrders,
  } = useContractRead({
    addressOrName: useRampContractAddress(chain),
    contractInterface: abi,
    functionName: 'getClaimsForOrder',
    args: [selectedOrder.orderId],
  });

  /*
    Hooks
  */

  // Fetch Order Claims
  useEffect(() => {
    if (!isReadOrderClaimsLoading && !isReadOrderClaimsError && orderClaimsData) {

      const sanitizedOrderClaims: OnRampOrderClaim[] = [];
      for (let i = orderClaimsData.length - 1; i >= 0; i--) {
        const claimsData = orderClaimsData[i];

        const claimId = i;
        const offRamper = claimsData.offRamper.toString();
        const hashedVenmoId = claimsData.venmoId;
        const status = claimsData.status; 
        const encryptedOffRamperVenmoId = claimsData.encryptedOffRamperVenmoId.substring(2);
        const claimExpirationTime = claimsData.claimExpirationTime.toString();
        const minAmountToPay = claimsData.minAmountToPay.toString();
        
        const orderClaim: OnRampOrderClaim = {
          claimId,
          offRamper,
          hashedVenmoId,
          status,
          encryptedOffRamperVenmoId,
          claimExpirationTime,
          minAmountToPay,
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
      }, 15000); // Refetch every 15 seconds
  
      return () => {
        clearInterval(intervalId);
      };
    }
  }, [selectedOrder, refetchClaimedOrders]);

  useEffect(() => {
    // On successful completion of message signing only
    if (signedMessageSignature) {
      // Generate account hash from signature and store to localStorage
      const accountHash = generateAccountFromSignature(signedMessageSignature);
      setAccountHash(accountHash);
      localStorage.setItem(accountHashKey, accountHash);
    }
  }, [signedMessageSignature])

  useEffect(() => {
    // On update to the logged in wallet address (updating accountHashKey), fetch accountHash from localStorage
    const accountHash = localStorage.getItem(accountHashKey);
    setAccountHash(accountHash || "");
  }, [loggedInWalletAddress]);

  async function toggleVenmoIds() {
    if (!venmoIdsVisible) {
      // Decrypt the off-ramper Venmo IDs
      const decryptedIds = await Promise.all(
        fetchedOrderClaims.map(async (orderClaim) => {
          return await decryptMessageWithAccount(orderClaim.encryptedOffRamperVenmoId, accountHash);
        })
      );
      setDecryptedVenmoIds(decryptedIds);
      
      // Hash the decrypted Venmo IDs to confirm they match the on-chain hashes
      const hashedVenmoIds = await Promise.all(
        decryptedIds.map(async (decryptedId) => {
          const hashedId = await generateVenmoIdHash(decryptedId);
          return hashedId;
        })
      );
      setHashedVenmoIds(hashedVenmoIds);
    }
    setVenmoIdsVisible(!venmoIdsVisible);
  }

  return (
    <SubmitOrderClaimsFormHeaderContainer>
      <SubHeader>Select Claim</SubHeader>
      <SubmitOrderClaimsFormBodyContainer>
        <NumberedStep>
          Complete one of the claims below by sending the requested amount to the Venmo
          handle (click the link to view the handle). Make sure you have e-mail receipts
          enabled on Venmo before sending the payment.
        </NumberedStep>
        <SubmitOrderClaimsFormTableAndButtonContainer>
          <OrderTable
            headers={tableHeaders}
            data={tableData}
            onRowClick={async(rowData: any[]) => {
              const [rowIndex] = rowData;
              const orderClaimToSelect = fetchedOrderClaims[rowIndex];
              setSelectedOrderClaim(orderClaimToSelect);
            }}
            selectedRow={getIndexForSelectedClaim(currentlySelectedOrderClaim)}
            rowsPerPage={3}
          />
          <Button
            disabled={false}
            onClick={async () => {
              if (accountHash === "") {
                await signMessage();
              } else {
                toggleVenmoIds();
              }
            }}
            >
            {venmoIdsVisible ? 'Hide Venmo IDs' : 'Decrypt and Verify IDs'}
          </Button>
        </SubmitOrderClaimsFormTableAndButtonContainer>
      </SubmitOrderClaimsFormBodyContainer>
    </SubmitOrderClaimsFormHeaderContainer>
  );
};

const SubmitOrderClaimsFormHeaderContainer = styled.div`
  width: 100%;
  gap: 1rem;
`;

const SubmitOrderClaimsFormBodyContainer = styled(Col)`
  gap: 2rem;
`;

const SubmitOrderClaimsFormTableAndButtonContainer = styled(Col)`
  gap: 0rem;
`;