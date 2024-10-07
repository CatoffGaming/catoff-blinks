import { Pool } from 'pg';  // PostgreSQL library
import {
  AnchorProvider,
  BN,
  Idl,
  Program,
  Wallet,
  web3,
} from "@project-serum/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as idl from "./idl.json";
import * as base58 from "bs58";

// PostgreSQL Pool setup
const pool = new Pool({
  user: 'your_username',
  host: 'localhost',
  database: 'your_database',
  password: 'your_password',
  port: 5432,
});

// dbQuery function to handle SQL queries
export const dbQuery = async (query: string, values?: any[]) => {
  const client = await pool.connect();
  try {
    const res = await client.query(query, values);
    return res.rows;
  } finally {
    client.release();
  }
};

// Rest of the helper.ts code remains the same
export const web3Constants = {
  programId: new PublicKey("Bo8aBQrjNGBuUN27qL5yXiDCEd57ysUaax4HmwcknSJ3"),
  USDC_MINT_ADDRESS: new PublicKey("usdcjuyqxVrSMiXtn6oDbETAwhJLs6Q5ZxZ2qLqXg9i"),
  BONK_MINT_ADDRESS: new PublicKey("bonkMLw9Gyn4F3dqwxaHgcqLQxvchiYLfjDjEVXCEMf"),
  SEND_MINT_ADDRESS: new PublicKey("send5CvJLQjEAASQjXfa1thdnDJkeMxXefZB3AMj1iF"),
  escrowAccountPublicKey: new PublicKey("F7S26HX7eH81RZ8uJe4gESzubcehAod6vSWs65KZ3h35"),
  TOKEN_PROGRAM_ID,
  READ_ONLY_PRIV_KEY: Keypair.fromSecretKey(
    base58.decode("3j35gJena7bTxgsmWHUGwGd5fpdp24v8pSSGMDerXPqHQxM4Wdo5E5HcYEaGBZsP9tvXZQ3KJSSRGdLHzhMzmkyb")
  ),
  escrowUSDCTokenAccount: new PublicKey("9ghcVQkevX8fEN1jFSTiBRSK6CvFEEwjZcgQs4DJBaYh")
};

export interface IWeb3Participate {
  wallet: Wallet;
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

// Additional functions like storing and calculating percentages...
export const storeNeverHaveIEverResponse = async (walletPublicKey: string, question1: string, question2: string) => {
  await dbQuery(`INSERT INTO responses (wallet, answer1, answer2) VALUES ($1, $2, $3)`, [walletPublicKey, question1, question2]);
};

export const getAnswerPercentage = async () => {
    // Fetch total responses from the database
    const totalResponsesResult = await dbQuery("SELECT COUNT(*) FROM responses");
    const totalResponses = Number(totalResponsesResult[0].count); // Extract and convert to a number
  
    // Fetch the count of players who answered "I Have"
    const option1CountResult = await dbQuery("SELECT COUNT(*) FROM responses WHERE answer1 = 'I Have'");
    const option1Count = Number(option1CountResult[0].count); // Extract and convert to a number
  
    // Calculate the count of players who answered the opposite ("I Have Never")
    const option2Count = totalResponses - option1Count;
  
    // Calculate the percentages
    const cal1 = (option1Count / totalResponses) * 100;
    const cal2 = (option2Count / totalResponses) * 100;
  
    // Return the calculated percentages
    return { cal1, cal2 };
  };
  
