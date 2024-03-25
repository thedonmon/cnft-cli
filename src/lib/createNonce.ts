import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  NONCE_ACCOUNT_LENGTH,
  NonceAccount,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
} from '@solana/web3.js';
import { extractSecret } from './helpers';

export async function createNonce(
  keyPair: string | Uint8Array,
  rpcUrl?: string,
) {
  const newNonceTx = new Transaction();
  const connection = new Connection(rpcUrl || clusterApiUrl('devnet'));
  const rent =
    await connection.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH);
  const authKeypair = Keypair.fromSecretKey(extractSecret(keyPair));
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  const nonceKeypair = Keypair.generate();
  newNonceTx.feePayer = authKeypair.publicKey;
  newNonceTx.recentBlockhash = blockhash;
  newNonceTx.lastValidBlockHeight = lastValidBlockHeight;
  newNonceTx.add(
    SystemProgram.createAccount({
      fromPubkey: authKeypair.publicKey,
      newAccountPubkey: nonceKeypair.publicKey,
      lamports: rent,
      space: NONCE_ACCOUNT_LENGTH,
      programId: SystemProgram.programId,
    }),
    SystemProgram.nonceInitialize({
      noncePubkey: nonceKeypair.publicKey,
      authorizedPubkey: authKeypair.publicKey,
    }),
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 2000,
    }),
  );

  newNonceTx.sign(nonceKeypair, authKeypair);
  try {
    const signature = await connection.sendRawTransaction(
      newNonceTx.serialize(),
    );
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });
    console.log('      Nonce Acct Created: ', signature, {
      publicKey: nonceKeypair.publicKey.toBase58(),
    });
    return nonceKeypair.publicKey.toBase58();
  } catch (error) {
    console.error('Failed to create nonce account: ', error);
    throw error;
  }
}

export async function fetchNonceInfo(noncePublicKey: string, rpcUrl?: string) {
  const connection = new Connection(rpcUrl || clusterApiUrl('devnet'));
  const noncePk = new PublicKey(noncePublicKey);
  const accountInfo = await connection.getAccountInfo(noncePk);
  if (!accountInfo) throw new Error('No account info found');
  const nonceAccount = NonceAccount.fromAccountData(accountInfo.data);
  console.log('      Auth:', nonceAccount.authorizedPubkey.toBase58());
  console.log('      Nonce:', nonceAccount.nonce);
  return nonceAccount;
}
