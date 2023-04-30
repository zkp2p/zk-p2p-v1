import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

import { Button } from "./Button";
import { Col, SubHeader } from "./Layout";
import { OrderTable } from './OrderTable';
import { NumberedStep } from "../components/NumberedStep";

import { OnRampOrderClaim } from "../helpers/types";
import { decryptMessageWithAccount } from '../helpers/messagEncryption';
import { formatAmountsForUSDC } from '../helpers/tableFormatters';


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

  const tableHeaders = ['Venmo Account', 'Requested USD Amount', 'Expiration'];
  const tableData = orderClaims.map((orderClaim, index) => [
    renderVenmoId(index),
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
    return orderClaims.findIndex((orderClaim) => orderClaim.claimId === selectedClaim.claimId);
  }

  useEffect(() => {
    const accountHash = localStorage.getItem(accountHashKey);
    setAccountHash(accountHash || "");
  }, [accountHashKey, loggedInWalletAddress]);

  async function toggleVenmoIds() {
    if (!venmoIdsVisible) {
      const decryptedIds = await Promise.all(
        orderClaims.map(async (orderClaim) => {
          return await decryptMessageWithAccount(orderClaim.encryptedOffRamperVenmoId, accountHash);
        })
      );
      setDecryptedVenmoIds(decryptedIds);
    }
    setVenmoIdsVisible(!venmoIdsVisible);
  }

  return (
    <SubmitOrderClaimsFormHeaderContainer>
      <SubHeader>Select Claim</SubHeader>
      <SubmitOrderClaimsFormBodyContainer>
        <NumberedStep>
          Complete one of the claims below by sending the requested amount to the Venmo handle
          (click the link to view the handle). Make sure you have e-mail receipts
          enabled on Venmo before sending the payment.
        </NumberedStep>
        <SubmitOrderClaimsFormTableAndButtonContainer>
          <OrderTable
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