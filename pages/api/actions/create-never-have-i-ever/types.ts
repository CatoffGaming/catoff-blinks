import { Connection, PublicKey } from "@solana/web3.js";

// Define the currency options for the game
export enum VERIFIED_CURRENCY {
  SOL = "SOL",
  USDC = "USDC",
  BONK = "BONK",
}

// DTO for creating the "Never Have I Ever" game
export interface CreateNeverHaveIEverGameDto {
  CreatorAddress: string;
  GameTitle: string;
  Question1: string;
  Question2?: string;  // Optional
  Question3?: string;  // Optional
  Currency: VERIFIED_CURRENCY;
  WagerAmount: number;
  StartDate: number;
  EndDate: number;
}

// Interface for transactions
export interface ICreateTransaction {
  accountPublicKey: PublicKey;
  recipientPublicKey: PublicKey;
  currency: VERIFIED_CURRENCY;
  amount: number;
  connection: Connection;
}

// Store player response
export interface NeverHaveIEverResponse {
  account: string;
  answer1: string;
  answer2: string;
  createdAt: Date;
}

// Default duration (e.g., 5 days)
export const defaultDuration = 5 * 24 * 60 * 60 * 1000;
