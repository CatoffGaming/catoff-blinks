import {
  AnchorProvider,
  BN,
  Idl,
  Program,
  Wallet,
  web3,
} from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as idl from "./idl.json";
import * as base58 from "bs58";

export const getAssociatedTokenAccount = async (
  connection: Connection,
  addr: PublicKey,
  tokenMintAddress: PublicKey
): Promise<PublicKey | null> => {
  const Accountaddress = new PublicKey(addr);
  const tokenList = await connection.getTokenAccountsByOwner(Accountaddress, {
    mint: new PublicKey(tokenMintAddress),
  });
  return tokenList.value[0].pubkey;
};

export const web3Constants = {
  programId: new PublicKey("GndpX952DhFddW8yMtEhY4eoUCp7n277aMN77g1TXG2U"),
  USDC_MINT_ADDRESS: new PublicKey(
    "usdcjuyqxVrSMiXtn6oDbETAwhJLs6Q5ZxZ2qLqXg9i"
  ),
  BONK_MINT_ADDRESS: new PublicKey(
    "bonkMLw9Gyn4F3dqwxaHgcqLQxvchiYLfjDjEVXCEMf"
  ),
  SEND_MINT_ADDRESS: new PublicKey(
    "send5CvJLQjEAASQjXfa1thdnDJkeMxXefZB3AMj1iF"
  ),
  escrowAccountPublicKey: new PublicKey(
    "F7S26HX7eH81RZ8uJe4gESzubcehAod6vSWs65KZ3h35"
  ),
  TOKEN_PROGRAM_ID: new PublicKey(
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
  ),
  READ_ONLY_PRIV_KEY: Keypair.fromSecretKey(
    base58.decode(
      "3j35gJena7bTxgsmWHUGwGd5fpdp24v8pSSGMDerXPqHQxM4Wdo5E5HcYEaGBZsP9tvXZQ3KJSSRGdLHzhMzmkyb"
    )
  ),
  escrowUSDCTokenAccount: new PublicKey(
    "9ghcVQkevX8fEN1jFSTiBRSK6CvFEEwjZcgQs4DJBaYh"
  )
};

export interface IWeb3Participate {
  wallet: Wallet,
  connection: Connection;
  playerId: BN;
  challengeId: BN;
  amount: BN;
  currency?: string;
}

export const initWeb3 = async (): Promise<{ program: Program, connection: Connection, wallet: Wallet }> => {
  const connection = new web3.Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const wallet = new Wallet(web3Constants.READ_ONLY_PRIV_KEY);
  const provider = new AnchorProvider(connection, wallet, {
    preflightCommitment: "processed",
  });
  const program = new Program(idl as Idl, web3Constants.programId, provider);
  return { program, connection, wallet };
};
