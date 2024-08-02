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
} from "@solana/web3.js";
import * as web3 from "@solana/web3.js";
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
import { publicKey } from "@project-serum/anchor/dist/cjs/utils";
import { get } from "http";
const secretKeyData = process.env.secretKeyData || [];
const secretKey = new Uint8Array(secretKeyData);
// Generate the Keypair
const adminkeypair = Keypair.fromSecretKey(secretKey);
// import generateCollageImageUrl from "../../../components/ImageConverter";
interface CustomActionPostRequest extends SolanaActionPostRequest {
  player_id?: string | number | string[];
}
const getHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const requestUrl = new URL(req.url as string, `https://${req.headers.host}`);
    console.log(requestUrl);
    const challengeID = requestUrl.searchParams.get("challengeID");
    if (!challengeID) {
      return res.status(400).json({
        error: 'Missing "challengeID" parameter',
      });
    }
    // Ensure absolute URL for fetching submissions
    const playersResponse = await fetch(
      `https://blinksstaging.catoff.xyz/player/challenge/${challengeID}`,
      {
        headers: {
          accept: "application/json",
        },
      }
    );
    if (!playersResponse.ok) {
      throw new Error("Failed to fetch players");
    }
    const responseJson = (await playersResponse.json()) as { data: any };
    const { data: players } = responseJson;
    console.log("these are the players ");
    console.log(players);
    const baseHref = new URL(
      "/api/actions/side-bets",
      requestUrl.origin
    ).toString();
    console.log(players);
    const actions = players.map((player: { PlayerID: number }) => ({
      label: `Bet on player ${player.PlayerID}`,
      href: `${baseHref}?player_id=${player.PlayerID}`,
    }));
    console.log(actions)
    const firstSubmissionMedia =
      players.length > 0 && players[0].Challenge.Media
        ? new URL(
            players[0].Challenge.Media,
            `https://${req.headers.host}`
          ).toString()
        : new URL("/solana_devs.jpg", `https://${req.headers.host}`).toString();
    // const mediaUrls = submissions.map((submission: { MediaUrl: any }) => submission.MediaUrl);
    // const submissionids = submissions.map((submission: { ID: number }) => submission.ID)
    // Generate collage image URL
    // const collageImageUrl = await generateCollageImageUrl(mediaUrls , submissionids);
    console.log(actions);
    const payload: ActionGetResponse = {
      title: "Bet on a player",
      icon: firstSubmissionMedia,
      description: "Side bet on a player",
      label: "Bet",
      links: {
        actions: actions,
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
    let player_id: string | number | string[] | undefined =
      body.player_id || req.query.player_id;
    if (typeof player_id === "undefined") {
      return res.status(400).json({ error: '"player_id" is required' });
    }
    if (Array.isArray(player_id)) {
      return res.status(400).json({ error: '"player_id" cannot be an array' });
    }
    const valid_player_id: string | number =
      typeof player_id === "string" || typeof player_id === "number"
        ? player_id
        : String(player_id);
    let account: PublicKey;
    try {
      account = new PublicKey(body.account);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid "account" provided' });
    }
    let ixs: web3.TransactionInstruction[] = [];
    const escrowAccountPublicKey = new PublicKey(process.env.ESCROW_PUBLIC_KEY);
    const tokenMintAddress = new PublicKey(
      "9KRfR9qhnNNvmyyhCteJCmycAcUThwSfCRd65rUJcD3L"
    );
    const userPublickey = new PublicKey(account);
    const userTokenAccount = await getAssociatedTokenAccount(
      account,
      tokenMintAddress
    );
    const escrowTokenAccount = await getAssociatedTokenAccount(
      escrowAccountPublicKey,
      tokenMintAddress
    );
    const amount = new anchor.BN(5000*1_000_000_000);
    const challengeId = new anchor.BN(1);
    const playerId = new anchor.BN(player_id);
    const instruction = await program.methods
      .participate("USDC", amount, challengeId, playerId)
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
    const transaction = new web3.VersionedTransaction(
      new web3.TransactionMessage({
        payerKey: new web3.PublicKey(account),
        recentBlockhash: blockhash,
        instructions: ixs,
      }).compileToV0Message()
    );
    const serializedTransaction = transaction.serialize();
    const base64Transaction = Buffer.from(serializedTransaction).toString(
      "base64"
    );
    const message = `Your bet has been placed!`;
    return res.status(200).send({ transaction: base64Transaction, message });
  } catch (err) {
    console.error(err);
    let message = "An unknown error occurred";
    if (typeof err === "string") message = err;
    res.status(400).json({ error: message });
  }
};
async function getAssociatedTokenAccount(addr: any, tokenMintAddress: any) {
  // console.log("We are inside get token function");
  const Accountaddress = new web3.PublicKey(addr);
  // console.log("Address:", Accountaddress.toBase58());
  // console.log("Token Mint Address:", tokenMintAddress.toString());
  const tokenList = await connection.getTokenAccountsByOwner(Accountaddress, {
    mint: new web3.PublicKey(tokenMintAddress),
  });
  let associatedTokenAccount = null;
  if (tokenList.value.length > 0) {
    const tokenAccountInfo = tokenList.value[0];
    associatedTokenAccount = tokenAccountInfo.pubkey;
  } else {
    // console.log("we are in the else part");
    associatedTokenAccount = await createAssociatedTokenAccount(
      program.provider.connection,
      adminkeypair,
      new web3.PublicKey(tokenMintAddress),
      Accountaddress
    );
  }
  // console.log("Associated Token Account:", associatedTokenAccount.toString());
  return associatedTokenAccount;
}
export default async (req: NextApiRequest, res: NextApiResponse) => {
  // Apply CORS middleware to all requests
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
