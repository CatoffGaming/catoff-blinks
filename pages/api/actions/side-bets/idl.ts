import { Idl, Program } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import * as web3 from "@solana/web3.js";

const IDL: Idl = {
  version: "0.1.0",
  name: "multi_token",
  instructions: [
    {
      name: "initializeEscrow",
      accounts: [
        { name: "escrowAccount", isMut: true, isSigner: true },
        { name: "owner", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [],
    },
    {
      name: "participate",
      accounts: [
        { name: "user", isMut: true, isSigner: true },
        { name: "userTokenAccount", isMut: true, isSigner: false },
        { name: "escrowTokenAccount", isMut: true, isSigner: false },
        { name: "escrowAccount", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "token", type: "string" },
        { name: "amount", type: "u64" },
        { name: "challengeId", type: "u64" },
        { name: "playerId", type: { option: "u64" } },
      ],
    },
    {
      name: "falseSettlement",
      accounts: [
        { name: "escrowAccount", isMut: true, isSigner: true },
        { name: "escrowTokenAccount", isMut: true, isSigner: false },
        { name: "userAccount", isMut: true, isSigner: false },
        { name: "userTokenAccount", isMut: true, isSigner: false },
        { name: "authority", isMut: false, isSigner: true },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "token", type: "string" },
        { name: "amount", type: "u64" },
        { name: "txnId", type: "string" },
      ],
    },
    {
      name: "send",
      accounts: [
        { name: "escrowAccount", isMut: true, isSigner: true },
        { name: "escrowTokenAccount", isMut: true, isSigner: false },
        { name: "adminAccount", isMut: true, isSigner: false },
        { name: "adminTokenAccount", isMut: true, isSigner: false },
        { name: "authority", isMut: false, isSigner: true },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "token", type: "string" },
        { name: "amount", type: "u64" },
      ],
    },
    {
      name: "settleChallenge",
      accounts: [
        { name: "escrowAccount", isMut: true, isSigner: true },
        { name: "escrowTokenAccount", isMut: true, isSigner: false },
        { name: "authority", isMut: true, isSigner: true },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "token", type: "string" },
        { name: "amounts", type: { vec: "u64" } },
        { name: "challengeId", type: "u64" },
      ],
    },
  ],
  accounts: [
    {
      name: "EscrowAccount",
      type: {
        kind: "struct",
        fields: [
          { name: "solBalance", type: "u64" },
          { name: "usdcBalance", type: "u64" },
          { name: "bonkBalance", type: "u64" },
          { name: "sendcoinBalance", type: "u64" },
          { name: "authority", type: "publicKey" },
        ],
      },
    },
  ],
  events: [
    {
      name: "ParticipateEvent",
      fields: [
        { name: "user", type: "publicKey", index: false },
        { name: "token", type: "string", index: false },
        { name: "amount", type: "u64", index: false },
        { name: "challengeId", type: "u64", index: false },
        { name: "playerId", type: { option: "u64" }, index: false },
      ],
    },
    {
      name: "SettleChallengeEvent",
      fields: [
        { name: "token", type: "string", index: false },
        { name: "amounts", type: { vec: "u64" }, index: false },
        { name: "challengeId", type: "u64", index: false },
      ],
    },
    {
      name: "FalseSettlementEvent",
      fields: [
        { name: "user", type: "publicKey", index: false },
        { name: "token", type: "string", index: false },
        { name: "amount", type: "u64", index: false },
        { name: "txnId", type: "string", index: false },
      ],
    },
    {
      name: "SendEvent",
      fields: [
        { name: "to", type: "publicKey", index: false },
        { name: "token", type: "string", index: false },
        { name: "amount", type: "u64", index: false },
      ],
    },
  ],
  errors: [
    {
      code: 6000,
      name: "Unauthorized",
      msg: "The requested operation is not authorized.",
    },
    {
      code: 6001,
      name: "InsufficientFunds",
      msg: "Insufficient funds to complete the operation.",
    },
    {
      code: 6002,
      name: "UnsupportedCurrency",
      msg: "The specified currency is not supported.",
    },
    {
      code: 6003,
      name: "TransferFailed",
      msg: "Failed to perform the transfer.",
    },
    { code: 6004, name: "InvalidInput", msg: "Invalid input provided." },
    { code: 6005, name: "InvalidSolAmount", msg: "Invalid sol amount." },
    { code: 6006, name: "TimeError", msg: "Failed to get current time." },
    {
      code: 6007,
      name: "InvalidAdminWallet",
      msg: "Invalid admin wallet public key.",
    },
  ],
};

const connection = new anchor.web3.Connection(
  process.env.SOLANA_RPC! || anchor.web3.clusterApiUrl("devnet"),
  "confirmed"
);
const programId = new PublicKey("BEposo9V2myENgYbJA6zu8bdFYZtaBcDKx7tcvtDuwE5");
const tempKeyPair = web3.Keypair.generate();

const provider = new anchor.AnchorProvider(
  connection,
  new anchor.Wallet(tempKeyPair),
  {
    commitment: "confirmed",
  }
);
const program = new Program(IDL, programId, provider);
export { connection, programId, tempKeyPair, program };