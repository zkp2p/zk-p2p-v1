import React, { useState } from 'react';
import styled from 'styled-components';

import { Button } from "../components/Button";
import { Col, Row } from "../components/Layout";
import { NumberedStep } from "../components/NumberedStep";
import { ReadOnlyInput } from "../components/ReadOnlyInput";
import { SingleLineInput } from "../components/SingleLineInput";

import EthCrypto from 'eth-crypto';


interface ClaimOrderFormProps {
  senderAddress: string;
  senderRequestedAmount: number;
  venmoHandle: string;
  setVenmoHandle: (amount: string) => void;
  requestedUSDAmount: number;
  setRequestedUSDAmount: (key: number) => void;
  writeClaimOrder?: () => void;
  isWriteClaimOrderLoading: boolean;
}
 
export const ClaimOrderForm: React.FC<ClaimOrderFormProps> = ({ senderAddress, senderRequestedAmount, venmoHandle, setVenmoHandle, requestedUSDAmount, setRequestedUSDAmount, writeClaimOrder, isWriteClaimOrderLoading }) => {
  async function encryptWithPublicKey(text: string, publicKey: string) {
    const entropy = Buffer.from('', 'utf-8');
    const identity = EthCrypto.createIdentity(entropy);
    console.log('Generated identity:');
    console.log(identity);
    
    console.log('Passed in:');
    console.log(text);
    console.log(publicKey);

    const genPublicKey = EthCrypto.publicKeyByPrivateKey('')
    console.log('Generated Pubkey:');
    console.log(genPublicKey);

    const encrypted = await EthCrypto.encryptWithPublicKey(genPublicKey, text);
    const encryptedString = EthCrypto.cipher.stringify(encrypted);
    
    console.log('Encrypted message:')
    console.log(encryptedString);

    const privateKey = '';
    const encryptedObject = EthCrypto.cipher.parse(encryptedString);
    const decrypted = await EthCrypto.decryptWithPrivateKey(privateKey, encryptedObject);

    console.log('Decrypted message:')
    console.log(decrypted);

    return encryptedString;
  };

  return (
    <ClaimOrderFormContainer>
      <SelectedOrderContainer>
        <ReadOnlyInput
          label="Order Creator"
          value={senderAddress}
        />
        <ReadOnlyInput
          label="Amount (USDC)"
          value={senderRequestedAmount}
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
        Submit a claim on the order on-chain. This will lock {senderRequestedAmount} USDC for the user to claim with a proof
      </NumberedStep>
      <hr />
      <SingleLineInput
        label="Venmo Handle"
        value={venmoHandle}
        placeholder={'Your-Venmo-Handle'}
        onChange={(e) => {
          setVenmoHandle(e.currentTarget.value);
        }}
      />
      <SingleLineInput
        label="USD Amount"
        value={requestedUSDAmount}
        placeholder={'0'}
        onChange={(e) => {
          setRequestedUSDAmount(e.currentTarget.value);
        }}
      />
      <Button
        disabled={isWriteClaimOrderLoading}
        onClick={async () => {
          await encryptWithPublicKey('0x0B8EBCC49Abe3E1Cae4c0364C25507241DdfFbbd', venmoHandle)

          // writeClaimOrder?.();
        }}
        >
        ClaimOrder
      </Button>
    </ClaimOrderFormContainer>
  );
};

const SelectedOrderContainer = styled(Col)`
  background: rgba(255, 255, 255, 0.1);
  width: 100%;
  gap: 1rem;
  border-radius: 4px;
  padding: 1rem;
  margin: 0 -1rem;
  color: #fff;
`;

const ClaimOrderFormContainer = styled(Col)`
  width: 100%;
  gap: 1rem;
  align-self: flex-start;
`;
