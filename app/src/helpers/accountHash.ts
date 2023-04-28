import * as crypto from 'crypto';
import EthCrypto from 'eth-crypto';


export const generateAccountFromSignature = (signature: string): string => {
  const hash = crypto.createHash('sha512');
  hash.update(signature);

  // console.log('Generated account hash from signature:');
  // console.log(hash.digest('hex'));

  return hash.digest('hex');
}

export const getPublicKeyFromAccount = (account: string): string => {
  const entropy = Buffer.from(account, 'utf-8');
  const identity = EthCrypto.createIdentity(entropy);

  // console.log('Generated identity:');
  // console.log(identity);

  return identity.publicKey;
}
