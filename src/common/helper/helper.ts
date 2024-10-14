import {
  AnchorProvider,
  BN,
  Idl,
  Program,
  Wallet,
  web3,
} from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import * as idl from "./idl.json";
import * as base58 from "bs58";
import { ONCHAIN_CONFIG } from "./cluster.helper";
import { IGetTxObject, ITokenAccountGetter, ResultWithError, VERIFIED_CURRENCY } from "../types";
import BigNumber from "bignumber.js";
import logger from "../logger";
import { GenericError } from "./error";
import { StatusCodes } from "http-status-codes";

export const getAssociatedTokenAccount = async (
  connection: Connection,
  addr: PublicKey,
  tokenMintAddress: PublicKey,
): Promise<PublicKey | null> => {
  try {
    logger.info(`[getAssociatedTokenAccount] Fetching associated token account for address: ${addr.toBase58()} and token mint: ${tokenMintAddress.toBase58()}`);
    const Accountaddress = new PublicKey(addr);
    const tokenList = await connection.getTokenAccountsByOwner(Accountaddress, {
      mint: new PublicKey(tokenMintAddress),
    });

    if (!tokenList.value.length) {
      logger.error("[getAssociatedTokenAccount] No associated token account found.");
      throw new GenericError("No associated token account found.", StatusCodes.NOT_FOUND);
    }

    const account = tokenList.value[0].pubkey;
    logger.info(`[getAssociatedTokenAccount] Found associated token account: ${account.toBase58()}`);
    return account;
  } catch (error) {
    logger.error(`[getAssociatedTokenAccount] Error fetching associated token account: ${error}`);
    throw new GenericError("Failed to fetch associated token account.", StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

export const initWeb3 = async (
  cluster: keyof typeof ONCHAIN_CONFIG,
): Promise<{ program: Program; connection: Connection }> => {
  try {
    const creds = ONCHAIN_CONFIG[cluster];
    const connection = new web3.Connection(creds.nodeURL!, "confirmed");
    logger.info(`[initWeb3] Initialized connection to cluster: ${cluster}`);

    const provider = new AnchorProvider(connection, {} as any, {
      preflightCommitment: "processed",
    });
    const program = new Program(idl as Idl, creds.progId, provider);
    logger.info(`[initWeb3] Initialized program with ID: ${creds.progId}`);
    return { program, connection };
  } catch (error) {
    logger.error(`[initWeb3] Error initializing web3: ${error}`);
    throw new GenericError("Failed to initialize web3 connection.", StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

export const tokenAccounts = async (
  data: ITokenAccountGetter,
): Promise<{ escrowTokenAccount: PublicKey; userTokenAccount: PublicKey }> => {
  try {
    logger.info(`[tokenAccounts] Fetching token accounts for currency: ${data.currency}`);
    const { connection, currency, escrowPublicKey, userPublicKey, cluster } = data;
    let TOKEN_MINT_ADDRESS: PublicKey;

    switch (currency) {
      case "USDC":
        TOKEN_MINT_ADDRESS = ONCHAIN_CONFIG[cluster].usdcMintAddress;
        break;
      case "SOL":
        TOKEN_MINT_ADDRESS = ONCHAIN_CONFIG[cluster].usdcMintAddress;
        break;
      case "BONK":
        TOKEN_MINT_ADDRESS = ONCHAIN_CONFIG[cluster].bonkMintAddress;
        break;
      case "SEND":
        TOKEN_MINT_ADDRESS = ONCHAIN_CONFIG[cluster].sendMintAddress;
        break;
      default:
        logger.error(`[tokenAccounts] Invalid currency type: ${currency}`);
        throw new GenericError(`Invalid currency type: ${currency}`, StatusCodes.BAD_REQUEST);
    }

    const escrowTokenAccount = await getAssociatedTokenAccount(connection, escrowPublicKey, TOKEN_MINT_ADDRESS);
    if (!escrowTokenAccount) {
      throw new GenericError("Failed to get or create associated token account for escrow.", StatusCodes.INTERNAL_SERVER_ERROR);
    }

    const userTokenAccount = await getAssociatedTokenAccount(
      connection,
      currency === VERIFIED_CURRENCY.SOL ? escrowPublicKey : userPublicKey,
      TOKEN_MINT_ADDRESS,
    );
    if (!userTokenAccount) {
      throw new GenericError("Failed to get associated token account for user.", StatusCodes.INTERNAL_SERVER_ERROR);
    }

    logger.info(`[tokenAccounts] Retrieved escrow and user token accounts successfully.`);
    return { escrowTokenAccount, userTokenAccount };
  } catch (error) {
    logger.error(`[tokenAccounts] Error fetching token accounts: ${error}`);
    throw error instanceof GenericError ? error : new GenericError("Failed to retrieve token accounts.", StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

export const getTxObject = async (
  data: IGetTxObject,
): Promise<ResultWithError> => {
  try {
    logger.info(`[getTxObject] Building transaction object.`);
    const {
      onchainParticipateType,
      account,
      program,
      playerId,
      challengeId,
      amount,
      currency,
      userPublicKey,
      userTokenAccount,
      escrowTokenAccount,
      cluster,
    } = data;

    let ixs: web3.TransactionInstruction[] = [];
    const instruction = await program.methods
      .participate(currency, amount, challengeId, playerId, {
        [onchainParticipateType]: {},
      })
      .accounts({
        user: userPublicKey,
        userTokenAccount,
        escrowTokenAccount,
        escrowAccount: ONCHAIN_CONFIG[cluster].escrowAccountPublicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: new PublicKey(
          "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        ),
      })
      .instruction();

    ixs.push(instruction);
    const { blockhash } = await program.provider.connection.getLatestBlockhash();

    const transaction = new web3.VersionedTransaction(
      new web3.TransactionMessage({
        payerKey: new PublicKey(account),
        recentBlockhash: blockhash,
        instructions: ixs,
      }).compileToV0Message(),
    );

    logger.info(`[getTxObject] Successfully built transaction.`);
    return { data: transaction, error: null };
  } catch (error) {
    logger.error(`[getTxObject] Web3 Transaction Build Failed: ${error}`);
    return { data: null, error: `Web3 Transaction Build Failed: ${error}` };
  }
};

export const parseToPrecision = (amount: number, decimals: number) => {
  try {
    logger.info(`[parseToPrecision] Parsing amount to precision: ${amount} with decimals: ${decimals}`);
    const amountFormatted = new BigNumber(amount);
    const multiplier = new BigNumber(Math.pow(10, decimals));
    const parsedAmount = amountFormatted.multipliedBy(multiplier);
    logger.info(`[parseToPrecision] Parsed amount: ${parsedAmount.toString()}`);
    return parsedAmount.toString();
  } catch (error) {
    logger.error(`[parseToPrecision] Error parsing amount: ${error}`);
    throw new GenericError("Failed to parse amount to precision.", StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

export function circularReplacer() {
  const seen = new WeakSet();
  return (value: any) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        logger.warn("[circularReplacer] Circular reference detected and removed.");
        return undefined; // Removes the circular reference
      }
      seen.add(value);
    }
    return value;
  };
}
