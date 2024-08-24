import { PublicKey } from '@solana/web3.js';


const challengeIdToPublicKeyMap: { [key: string]: string } = {
  '643': 'Ds6vFEUqVEQfy7v3MZ2ykNgNauspZiDrA7H8e4yqWN1R',  
  '644': 'AhsxQZhpotHfvGS9YN1u8BFQW9t2UES1Vb7l2Rr4FgKX',  
  
};


export const getChallengePublicKey = (challenge_id: string): PublicKey | null => {
  const publicKeyString = challengeIdToPublicKeyMap[challenge_id];
  return publicKeyString ? new PublicKey(publicKeyString) : null;
};


export const addChallengePublicKeyMapping = (challenge_id: string, publicKey: string) => {
  challengeIdToPublicKeyMap[challenge_id] = publicKey;
};
