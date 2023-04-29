import React, { useState } from 'react';
import styled from 'styled-components';

import { Button } from "../components/Button";
import { Col, SubHeader } from "../components/Layout";
import { NumberedStep } from "../components/NumberedStep";
import { ReadOnlyInput } from "../components/ReadOnlyInput";
import { SingleLineInput } from "../components/SingleLineInput";

import { encryptMessage } from "../helpers/accountHash";
import { initializePoseidon, poseidon } from "../helpers/poseidonHash";


interface ClaimOrderFormProps {
  senderEncryptingKey: string;
  senderAddressDisplay: string;
  senderRequestedAmountDisplay: number;
  setRequestedUSDAmount: (key: number) => void;
  setEncryptedVenmoHandle: (key: string) => void;
  setHashedVenmoHandle: (key: string) => void;
  writeClaimOrder?: () => void;
  isWriteClaimOrderLoading: boolean;
}
 
export const ClaimOrderForm: React.FC<ClaimOrderFormProps> = ({
  senderEncryptingKey,
  senderAddressDisplay,
  senderRequestedAmountDisplay,
  setRequestedUSDAmount,
  setEncryptedVenmoHandle,
  setHashedVenmoHandle,
  writeClaimOrder,
  isWriteClaimOrderLoading
}) => {
  const [venmoIdInput, setVenmoIdInput] = useState<string>("");
  const [requestedUSDAmountInput, setRequestedUSDAmountInput] = useState<number>(0);

  return (
    <ClaimOrderFormContainer>
      <SubHeader>Claim Order</SubHeader>
      <SelectedOrderContainer>
        <ReadOnlyInput
          label="Order Creator"
          value={senderAddressDisplay}
        />
        <ReadOnlyInput
          label="Amount (USDC)"
          value={senderRequestedAmountDisplay}
        />
      </SelectedOrderContainer>
      <hr />
      <NumberedStep step={1}>
        Provide a Venmo Handle to receive USD at. This will be encrypted using the key provided by the on-ramper
      </NumberedStep>
      <NumberedStep step={2}>
        Specify the USD amount for the user to send. This amount will be sent by the on-ramper through Venmo
      </NumberedStep>
      <NumberedStep step={3}>
        Submit a claim on the order on-chain. This will lock {senderRequestedAmountDisplay} USDC for the user to claim with a proof
      </NumberedStep>
      <hr />
      <SingleLineInput
        label="Venmo ID"
        value={venmoIdInput}
        placeholder={'1234567891011121314'}
        onChange={(e) => {
          setVenmoIdInput(e.currentTarget.value);
        }}
      />
      <SingleLineInput
        label="USD Amount to send"
        value={requestedUSDAmountInput}
        placeholder={'0'}
        onChange={(e) => {
          setRequestedUSDAmountInput(e.currentTarget.value);
        }}
      />
      <Button
        disabled={isWriteClaimOrderLoading}
        onClick={async () => {
          // Sign venmo id with encrypting key from the order
          const encryptedVenmoId = await encryptMessage(venmoIdInput, senderEncryptingKey);
          setEncryptedVenmoHandle(encryptedVenmoId);
          console.log(encryptedVenmoId);

          // Generate Poseidon hash of the venmo id
          await initializePoseidon();
          const hashedVenmoId = poseidon([venmoIdInput]);
          setHashedVenmoHandle(hashedVenmoId);

          // Set the requested USD amount
          setRequestedUSDAmount(requestedUSDAmountInput);

          writeClaimOrder?.();
        }}
        >
        ClaimOrder
      </Button>
    </ClaimOrderFormContainer>
  );
};

const SelectedOrderContainer = styled(Col)`
  background: rgba(255, 255, 255, 0.1);
  gap: 1rem;
  border-radius: 4px;
  padding: 1rem;
  color: #fff;
`;

const ClaimOrderFormContainer = styled(Col)`
  width: 100%;
  gap: 1rem;
  align-self: flex-start;
`;
