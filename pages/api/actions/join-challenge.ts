import {
  ActionPostResponse,
  ACTIONS_CORS_HEADERS,
  createPostResponse,
  ActionGetResponse,
  ActionPostRequest as SolanaActionPostRequest,
} from "@solana/actions";
import { Cubik } from "@cubik-so/sdk";
import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";
import type { NextApiRequest, NextApiResponse } from "next";
import * as anchor from "@project-serum/anchor";
import nextCors from "nextjs-cors";
import fetch from "node-fetch";
import { connection, program, programId } from "./idl";
import {
  createAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const secretKeyData = process.env.secretKeyData || [];
const secretKey = new Uint8Array(secretKeyData);
// Generate the Keypair
const adminkeypair = Keypair.fromSecretKey(secretKey);

interface CustomActionPostRequest extends SolanaActionPostRequest {
  challenge_id?: string;
  wager_amount?: string;
  currency?: string;
  media?: string;
}

const getHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const requestUrl = new URL(req.url as string, `https://${req.headers.host}`);
    console.log(requestUrl);
    const challengeID = requestUrl.searchParams.get("challengeID");
    const wagerAmount = requestUrl.searchParams.get("wager_amount");
    const currency = requestUrl.searchParams.get("currency");
    const media = requestUrl.searchParams.get("media");

    if (!challengeID || !wagerAmount || !currency || !media) {
      return res.status(400).json({
        error: 'Missing one or more of the required parameters: "challengeID", "wager_amount", "currency", "media"',
      });
    }

    const baseHref = new URL("/api/actions/join-challenge", requestUrl.origin).toString();

    const action = {
      label: "Join Challenge",
      href: `${baseHref}?challenge_id=${challengeID}&wager_amount=${wagerAmount}&currency=${currency}&media=${media}`,
    };

    const payload: ActionGetResponse = {
      title: "Join the Challenge",
      icon: media,
      description: "Join the challenge directly from here",
      label: "Join Challenge",
      links: {
        actions: [action],
      },
    };
    res.status(200).json(payload);
  } catch (err) {
    console.error(err);
    let message = "An unknown error occurred";
    if (typeof err === "string") message = err;
    res.status(400).json({ error: message });
  }
};

const postHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const body: CustomActionPostRequest = req.body;
    console.log(body);

    const challengeID = body.challenge_id || req.query.challenge_id;
    const wagerAmountStr = body.wager_amount || req.query.wager_amount;
    const currency = body.currency || req.query.currency;
    const media = body.media || req.query.media;

    if (!challengeID || !wagerAmountStr || !currency || !media) {
      return res.status(400).json({
        error: 'Missing one or more of the required parameters: "challenge_id", "wager_amount", "currency", "media"',
      });
    }

    const wagerAmount = new anchor.BN(parseInt(wagerAmountStr) * 1_000_000_000);
    const challengeId = new anchor.BN(challengeID);

    let account: PublicKey;
    try {
      account = new PublicKey(body.account);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid "account" provided' });
    }

    let ixs: TransactionInstruction[] = [];
    const escrowAccountPublicKey = new PublicKey(process.env.ESCROW_PUBLIC_KEY);
    const tokenMintAddress = new PublicKey("9KRfR9qhnNNvmyyhCteJCmycAcUThwSfCRd65rUJcD3L"); // Replace with appropriate Mint Address for the currency

    const userPublickey = new PublicKey(account);
    const userTokenAccount = await getAssociatedTokenAccount(account, tokenMintAddress);
    const escrowTokenAccount = await getAssociatedTokenAccount(escrowAccountPublicKey, tokenMintAddress);

    const instruction = await program.methods
      .participate(currency, wagerAmount, challengeId, new anchor.BN(0)) // Assuming playerId is not required here
      .accounts({
        user: userPublickey,
        userTokenAccount: userTokenAccount,
        escrowTokenAccount: escrowTokenAccount,
        escrowAccount: escrowAccountPublicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    ixs.push(instruction);

    const { blockhash } = await connection.getLatestBlockhash();
    const transaction = new VersionedTransaction(
      new TransactionMessage({
        payerKey: new PublicKey(account),
        recentBlockhash: blockhash,
        instructions: ixs,
      }).compileToV0Message()
    );

    const serializedTransaction = transaction.serialize();
    const base64Transaction = Buffer.from(serializedTransaction).toString("base64");

    const message = `You have joined the challenge!`;
    return res.status(200).send({ transaction: base64Transaction, message });
  } catch (err) {
    console.error(err);
    let message = "An unknown error occurred";
    if (typeof err === "string") message = err;
    res.status(400).json({ error: message });
  }
};

async function getAssociatedTokenAccount(addr: any, tokenMintAddress: any) {
  const Accountaddress = new PublicKey(addr);
  const tokenList = await connection.getTokenAccountsByOwner(Accountaddress, {
    mint: new PublicKey(tokenMintAddress),
  });
  let associatedTokenAccount = null;
  if (tokenList.value.length > 0) {
    const tokenAccountInfo = tokenList.value[0];
    associatedTokenAccount = tokenAccountInfo.pubkey;
  } else {
    associatedTokenAccount = await createAssociatedTokenAccount(
      program.provider.connection,
      adminkeypair,
      new PublicKey(tokenMintAddress),
      Accountaddress
    );
  }
  return associatedTokenAccount;
}

export default async (req: NextApiRequest, res: NextApiResponse) => {
  await nextCors(req, res, {
    methods: ["GET", "POST"],
    origin: "*", // Change this to your frontend URL in production
    optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
  });

  if (req.method === "GET") {
    await getHandler(req, res);
  } else if (req.method === "POST") {
    await postHandler(req, res);
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};
