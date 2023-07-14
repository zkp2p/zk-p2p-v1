import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import {
  useContractWrite,
  usePrepareContractWrite,
  useSignMessage,
} from 'wagmi'

import { Button } from "../components/Button";
import { Col, SubHeader } from "../components/Layout";
import { NumberedStep } from "../components/NumberedStep";
import { SingleLineInput } from "../components/SingleLineInput";
import { generateAccountFromSignature, getPublicKeyFromAccount } from '../helpers/messagEncryption';
import { abi } from "../helpers/ramp.abi";
import { contractAddresses } from "../helpers/deployed_addresses";
import { formatAmountsForTransactionParameter } from '../helpers/transactionFormat';


interface NewOrderFormProps {
  loggedInWalletAddress: string;
}

export const NewOrderForm: React.FC<NewOrderFormProps> = ({
  loggedInWalletAddress,
}) => {
  const accountHashKey = `accountHash_${loggedInWalletAddress}`;
  const [accountHash, setAccountHash] = useState<string>(localStorage.getItem(accountHashKey) || "");

  const [newOrderAmount, setNewOrderAmount] = useState<number>(0);
  const [venmoIdEncryptingKey, setVenmoIdEncryptingKey] = useState<string>('');

  const {
    data: signedMessageSignature,
    signMessage,
    isLoading: isMessageSigning,
  } = useSignMessage({
    message: 'You are signing a message to log into zkp2p.xyz.',
  })

  /*
    Contract Writes
  */

  //
  // legacy: postOrder(uint256 _amount, uint256 _maxAmountToPay)
  // new:    postOrder(uint256 _amount, uint256 _maxAmountToPay, bytes calldata _encryptPublicKey)
  //
  const { config: writeCreateOrderConfig } = usePrepareContractWrite({
    addressOrName: contractAddresses['goerli'].ramp,
    contractInterface: abi,
    functionName: 'postOrder',
    args: [
      formatAmountsForTransactionParameter(newOrderAmount),
      // Assuming on-ramper wants to pay at most newOrderAmount for their requested USDC amount versus previously UINT256_MAX
      formatAmountsForTransactionParameter(newOrderAmount),
      '0x' + venmoIdEncryptingKey
    ],
    onError: (error: { message: any }) => {
      console.error(error.message);
    },
  });

  // Debug:
  // console.log(writeCreateOrderConfig);

  const {
    isLoading: isWriteNewOrderLoading,
    write: writeNewOrder
  } = useContractWrite(writeCreateOrderConfig);

  /*
    Hooks
  */

  useEffect(() => {
    // On successful completion of message signing only
    if (signedMessageSignature) {
      // Generate account hash from signature and store to localStorage
      const accountHash = generateAccountFromSignature(signedMessageSignature);
      setAccountHash(accountHash);
      localStorage.setItem(accountHashKey, accountHash);
      
      // Extract public key from account hash and set as venmo encrypting key parameter
      const publicKey = getPublicKeyFromAccount(accountHash);
      setVenmoIdEncryptingKey(publicKey);
    }
  }, [signedMessageSignature])

  useEffect(() => {
    // On update to the logged in wallet address (updating accountHashKey), fetch accountHash from localStorage
    const accountHash = localStorage.getItem(accountHashKey);
    setAccountHash(accountHash || "");

    // If accountHash exists, extract public key from account hash and set as venmo encrypting key parameter
    if (accountHash) {
      const publicKey = getPublicKeyFromAccount(accountHash);
      setVenmoIdEncryptingKey(publicKey);
    } else {
      setVenmoIdEncryptingKey("");
    }

  }, [loggedInWalletAddress]);

  return (
    <NewOrderFormHeaderContainer>
      <SubHeader>New Order</SubHeader>
      <NewOrderFormBodyContainer>
        <NumberedStep>
          Specify an amount to on-ramp. If this is your first time or you are logged in to the same wallet from a different
          browser, you will be prompted to sign a message to register.
        </NumberedStep>
        <SingleLineInput
          label="Amount USDC to Request"
          value={newOrderAmount === 0 ? '' : newOrderAmount.toString()}
          placeholder={'0'}
          onChange={(e) => {
            setNewOrderAmount(e.currentTarget.value);
          }}
        />
        <Button
          disabled={isWriteNewOrderLoading || isMessageSigning}
          onClick={async () => {
            if (accountHash === "") {
              await signMessage();
            } else {
              writeNewOrder?.();
            }
          }}
          >
          Create
        </Button>
      </NewOrderFormBodyContainer>
    </NewOrderFormHeaderContainer>
  );
};

const NewOrderFormHeaderContainer = styled.div`
  width: 100%;
  gap: 1rem;
`;

const NewOrderFormBodyContainer = styled(Col)`
  gap: 2rem;
`;
