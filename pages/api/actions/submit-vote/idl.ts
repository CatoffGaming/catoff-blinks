import { Idl, Program } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import * as web3 from "@solana/web3.js";

const IDL: Idl = {
  version: "0.1.0",
  name: "voting_blinks",
  instructions: [
    {
      name: "submitVote",
      accounts: [
        {
          name: "user",
          isMut: true,
          isSigner: true,
        },
      ],
      args: [
        {
          name: "submissionId",
          type: "u64",
        },
      ],
    },
  ],
  events: [
    {
      name: "VoteSubmitted",
      fields: [
        {
          name: "submissionId",
          type: "u64",
          index: false,
        },
        {
          name: "userWallet",
          type: "publicKey",
          index: false,
        },
      ],
    },
  ],
};

const connection = new anchor.web3.Connection(
  process.env.SOLANA_RPC! || anchor.web3.clusterApiUrl("devnet"),
  "confirmed"
);
const programId = new PublicKey("AAkrLC6jXnorRDGFHAzEkoWjt1ZPaZ3wHx7Y8dnxn7Bt");
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
