import {
  ActionPostResponse,
  ACTIONS_CORS_HEADERS,
  CustomActionPostRequest,
  createPostResponse,
  ActionGetResponse,
  ActionPostRequest as SolanaActionPostRequest,
} from "@solana/actions";
import { Cubik } from "@cubik-so/sdk";
import {
  clusterApiUrl,
  Connection,
  PublicKey,
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

interface CustomActionPostRequest extends SolanaActionPostRequest {
  challenge_id?: string | number | string[];
}

const getHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const requestUrl = new URL(req.url as string, `http://${req.headers.host}`);
    const challengeID = requestUrl.searchParams.get("challengeID");

    if (!challengeID) {
      return res.status(400).json({
        error: 'Missing "challengeID" parameter',
      });
    }

    // Ensure absolute URL for fetching challenge details
    const challengeResponse = await fetch(
      `https://apiv2.catoff.xyz/challenge/${challengeID}`,
      {
        headers: {
          accept: "application/json",
        },
      }
    );

    if (!challengeResponse.ok) {
      throw new Error("Failed to fetch challenge details");
    }

    const responseJson = await challengeResponse.json() as { data: any };
    const { data: challenge } = responseJson;

    const baseHref = new URL(
      "/api/actions/join-challenge/join-challenge",
      requestUrl.origin
    ).toString();

    const actions = [{
      label: `Join Challenge ${challenge.ID}`,
      href: `${baseHref}?challenge_id=${challenge.ID}`,
    }];

    const iconUrl = new URL(challenge.MediaUrl, requestUrl.origin).toString();

    const payload: ActionGetResponse = {
      title: "Join Challenge",
      icon: iconUrl,
      description: "Join the challenge on-chain",
      label: "Join",
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
    
    console.log("Request Body:", body);

    let challenge_id: string | number | string[] | undefined =
      body.challenge_id || req.query.challenge_id;

    console.log("Challenge ID:", challenge_id);

    if (typeof challenge_id === "undefined") {
      console.error('Challenge ID is undefined');
      return res.status(400).json({ error: '"challenge_id" is required' });
    }

    if (Array.isArray(challenge_id)) {
      console.error('Challenge ID is an array');
      return res
        .status(400)
        .json({ error: '"challenge_id" cannot be an array' });
    }

    const validChallengeId: string | number =
      typeof challenge_id === "string" || typeof challenge_id === "number"
        ? challenge_id
        : String(challenge_id);

    console.log("Valid Challenge ID:", validChallengeId);

    let account: PublicKey;
    try {
      account = new PublicKey(body.account);
      console.log("Account:", account.toString());
    } catch (err) {
      console.error('Invalid "account" provided', err);
      return res.status(400).json({ error: 'Invalid "account" provided' });
    }
    
    let ixs: web3.TransactionInstruction[] = [];

    try {
      const instruction = await program.methods
        .joinChallenge(new anchor.BN(validChallengeId))
        .accounts({
          user: account,
          challenge: new PublicKey(validChallengeId),
        })
        .instruction();
      ixs.push(instruction);
    } catch (err) {
      console.error('Error creating joinChallenge instruction', err);
      return res.status(400).json({ error: 'Failed to create instruction' });
    }

    const { blockhash } = await connection.getLatestBlockhash();
    console.log("Blockhash:", blockhash);

    const transaction = new web3.VersionedTransaction(
      new web3.TransactionMessage({
        payerKey: account,
        recentBlockhash: blockhash,
        instructions: ixs,
      }).compileToV0Message()
    );
    

    const serializedTransaction = transaction.serialize();
    const base64Transaction = Buffer.from(serializedTransaction).toString(
      "base64"
    );
    const message = `You have joined the challenge successfully`;

    console.log("Transaction prepared successfully");

    return res.status(200).send({ transaction: base64Transaction, message });
  } catch (err) {
    console.error('An error occurred', err);
    let message = "An unknown error occurred";
    if (typeof err === "string") message = err;
    res.status(400).json({ error: message });
  }
};

export default async (req: NextApiRequest, res: NextApiResponse) => {
  // Apply CORS middleware to all requests
  await nextCors(req, res, {
    methods: ["GET", "POST"],
    origin: "*",
    optionsSuccessStatus: 200,
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
