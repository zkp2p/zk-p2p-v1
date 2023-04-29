import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

import { Button } from "./Button";
import { Col, SubHeader } from "./Layout";
import { CustomTable } from './CustomTable';

import { OnRampOrderClaim } from "../helpers/types";
import { decryptMessageWithAccount } from '../helpers/messagEncryption';


interface SubmitOrderClaimsFormProps {
  loggedInWalletAddress: string;
  orderClaims: OnRampOrderClaim[];
  currentlySelectedOrderClaim: OnRampOrderClaim;
  setSelectedOrderClaim: (claim: OnRampOrderClaim) => void;
}
 

export const SubmitOrderClaimsForm: React.FC<SubmitOrderClaimsFormProps> = ({
  loggedInWalletAddress,
  orderClaims,
  currentlySelectedOrderClaim,
  setSelectedOrderClaim
}) => {
  const accountHashKey = `accountHash_${loggedInWalletAddress}`;
  const [accountHash, setAccountHash] = useState<string>(localStorage.getItem(accountHashKey) || "");

  const [venmoIdsVisible, setVenmoIdsVisible] = useState<boolean>(false);
  const [decryptedVenmoIds, setDecryptedVenmoIds] = useState<string[]>([]);

  const tableHeaders = ['Venmo Account', 'Requested Amount', 'Expiration'];
  const tableData = orderClaims.map((orderClaim, index) => [
    renderVenmoId(index),
    orderClaim.requestedAmount,
    formattedExpiration(orderClaim.expirationTimestamp),
  ]);

  function renderVenmoId(index: number) {
    if (venmoIdsVisible && decryptedVenmoIds[index]) {
      const venmoLink = `https://venmo.com/code?user_id=${decryptedVenmoIds[index]}`;
      return <a href={venmoLink} target="_blank" rel="noopener noreferrer">View Account</a>;
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
    return orderClaims.findIndex((orderClaim) => orderClaim.venmoId === selectedClaim.venmoId);
  }

  useEffect(() => {
    const accountHash = localStorage.getItem(accountHashKey);
    setAccountHash(accountHash || "");
  }, [accountHashKey, loggedInWalletAddress]);

  async function toggleVenmoIds() {
    if (!venmoIdsVisible) {
      const decryptedIds = await Promise.all(
        orderClaims.map(async (orderClaim) => {
          return await decryptMessageWithAccount(orderClaim.encryptedVenmoHandle, accountHash);
        })
      );
      setDecryptedVenmoIds(decryptedIds);
    }
    setVenmoIdsVisible(!venmoIdsVisible);
  }

  return (
    <SubmitOrderClaimsFormContainer>
      <SubHeader>Select Claim</SubHeader>
      <CustomTable
        headers={tableHeaders}
        data={tableData}
        onRowClick={async(rowData: any[]) => {
          const [rowIndex] = rowData;
          const orderClaimToSelect = orderClaims[rowIndex];
          setSelectedOrderClaim(orderClaimToSelect);
        }}
        selectedRow={getIndexForSelectedClaim(currentlySelectedOrderClaim)}
        rowsPerPage={3}
      />
      <Button
        disabled={false}
        onClick={toggleVenmoIds}
        >
        {venmoIdsVisible ? 'Hide Venmo Handles' : 'Decrypt Venmo Handles'}
      </Button>
    </SubmitOrderClaimsFormContainer>
  );
};

const SubmitOrderClaimsFormContainer = styled(Col)`
  width: 100%;
  gap: 1rem;
  align-self: flex-start;
`;
