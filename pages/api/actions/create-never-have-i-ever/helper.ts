import { Connection, PublicKey } from "@solana/web3.js";
import { Pool } from 'pg';
import logger from "../../common/logger";
import { CreateNeverHaveIEverGameDto, NeverHaveIEverResponse } from "./types";

// Initialize the connection to Solana blockchain (shared logic)
export const initWeb3 = async (): Promise<{ connection: Connection }> => {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  return { connection };
};

// Create a new "Never Have I Ever" game in the backend (this could involve DB storage)
export const createNeverHaveIEverGame = async (gameDetails: CreateNeverHaveIEverGameDto): Promise<void> => {
  // In a production environment, store the game details in a database.
  // Here we will just log the details for demo purposes.
  logger.info("Creating new Never Have I Ever game with details: %o", gameDetails);

  // Assuming a PostgreSQL DB setup; you can store this info in a DB
  const query = `
    INSERT INTO game(creator_address, game_title, question1, question2, question3, currency, wager_amount, start_date, end_date)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `;

  const values = [
    gameDetails.CreatorAddress,
    gameDetails.GameTitle,
    gameDetails.Question1,
    gameDetails.Question2 || null,
    gameDetails.Question3 || null,
    gameDetails.Currency,
    gameDetails.WagerAmount,
    gameDetails.StartDate,
    gameDetails.EndDate,
  ];

  try {
    await dbQuery(query, values);
  } catch (err) {
    logger.error("Error creating game in the database: %s", err);
    throw new Error("Failed to create game in the database");
  }
};

// Store user responses (answers) in the database
export const storeNeverHaveIEverResponse = async (account: string, answer1: string, answer2: string): Promise<void> => {
  const query = `
    INSERT INTO responses (account, answer1, answer2, created_at)
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
  `;

  const values = [account, answer1, answer2];

  try {
    await dbQuery(query, values);
    logger.info("User response stored successfully for account: %s", account);
  } catch (err) {
    logger.error("Error storing user response: %s", err);
    throw new Error("Failed to store user response in the database");
  }
};

export const getAnswerPercentage = async (): Promise<{ cal1: number; cal2: number }> => {
    // Fetch total count of responses
    const totalResponsesResult = await dbQuery("SELECT COUNT(*) FROM responses");
    const totalResponses = totalResponsesResult[0]?.count ? parseInt(totalResponsesResult[0].count, 10) : 0;
  
    // Fetch count of option1 ("I Have")
    const option1CountResult = await dbQuery("SELECT COUNT(*) FROM responses WHERE answer1 = 'I Have'");
    const option1Count = option1CountResult[0]?.count ? parseInt(option1CountResult[0].count, 10) : 0;
  
    // Calculate option2 count by subtracting option1 count from total responses
    const option2Count = totalResponses - option1Count;
  
    // Calculate percentages
    const cal1 = (option1Count / totalResponses) * 100;
    const cal2 = (option2Count / totalResponses) * 100;
  
    return { cal1, cal2 };
  };

// Helper function for querying the PostgreSQL database
const dbPool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST || "localhost",
  database: process.env.PG_DB,
  password: process.env.PG_PASSWORD,
  port: Number(process.env.PG_PORT) || 5432,
});

export const dbQuery = async (text: string, params?: any[]) => {
  const client = await dbPool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } catch (err) {
    throw err;
  } finally {
    client.release();
  }
};
