import {
  ActionGetResponse,
  ActionPostRequest as SolanaActionPostRequest,
} from "@solana/actions";
import * as web3 from "@solana/web3.js";
import BN from "bn.js";
import type { NextApiRequest, NextApiResponse } from "next";
import * as anchor from "@project-serum/anchor";
import nextCors from "nextjs-cors";
import fetch from "node-fetch";
import axios from "axios";
import { ApiResponse, IChallengeById, PARTICIPATION_TYPE } from "./types";
import { getAssociatedTokenAccount, web3Constants, IWeb3Participate, initWeb3 } from './helper';
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { ICreateChallenge } from "../join-challenge/types";

const getHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { participationtype } = req.query as unknown as PARTICIPATION_TYPE;

    const baseHref = new URL(
      `/api/actions/create-challenge`,
      `http://${req.headers.host}`
    ).toString();

    console.log(baseHref);

    const actions = [
      {
        "label": "Create Challenge", // button text
        "href": `${baseHref}?participationtype=${participationtype}&wager={wager}&target={target}&startTime={startTime}&duration={duration}&name={name}&walletAddress={walletAddress}`,
        "parameters": [
          {
            "name": "name", // field name
            "label": "Name your dare" // text input placeholder
          },
          {
            "name": "wager", // field name
            "label": "Wager amount in SOL" // text input placeholder
          },
          {
            "name": "target", // field name
            "label": "Target" // text input placeholder
          },
          {
            "name": "startTime", // field name
            "label": "Start the challenge in? e.g. 5m, 10m, 1h, 12h, 1d..." // text input placeholder
          },
          {
            "name": "duration", // field name
            "label": "Duration of the the challenge? e.g. 5m, 10m, 1h, 12h, 1d..." // text input placeholder
          },
          { 
            "name": "walletAddress", 
            "label": "Your wallet address" }
        ]
      }
    ];

    const iconUrl = new URL(
      "/logo.png",
      `http://${req.headers.host}`
    ).toString();

    const payload: ActionGetResponse = {
      title: "Dare on blinks",
      icon: iconUrl,
      type: "action",
      description: "To settle you X beef now, dare your friends or foes!",
      label: "Create",
      links: {
        actions: actions,
      },
    };

    console.log("Payload constructed successfully:", payload);

    res.status(200).json(payload);
  } catch (err) {
    console.error("Error in getHandler:", err);
    res.status(400).json({ error: "An unknown error occurred" });
  }
};

const postHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { name, wager, target, startTime, duration, walletAddress } = req.query;

    if (!walletAddress) {
      console.error('walletAddress is missing or invalid');
      return res.status(400).json({ error: 'Invalid "walletAddress" provided' });
    }

    if (!name || !wager || !target || !startTime || !duration) {
      console.error('Missing required parameters', { name, wager, target, startTime, duration });
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const account = new PublicKey(walletAddress as string);

    const startTimeMillis = parseRelativeTime(startTime as string); 
    const durationMillis = parseRelativeTime(duration as string);

    const createChallengeJson: ICreateChallenge = {
      name: name as string,
      wager: wager as string,
      target: target as string,
      startTime: (Date.now() + startTimeMillis).toString(),
      duration: durationMillis.toString(),
      creator: {
        id: "Agar chahiye ho to",
        walletAddress: walletAddress as string,
      },
      participants: [],
      reward: {
        type: "SOL",
        amount: wager as string,
      },
    };

    console.log("Challenge JSON:", createChallengeJson);

    // Initialize Web3 and Solana program context
    const { program, connection, wallet } = await initWeb3();
    let ixs: web3.TransactionInstruction[] = [];

    // Create instruction for creating the challenge on-chain
    const instruction = await program.methods
      .createChallenge(
        new BN(Number(createChallengeJson.wager) * 10 ** 9), // Adjust this conversion based on the wager's unit
        createChallengeJson.name,
        createChallengeJson.target,
        Math.floor((Date.now() + startTimeMillis) / 1000), // Start time in seconds from now
        Math.floor(durationMillis / 1000)
      )
      .accounts({
        creator: account,
        systemProgram: SystemProgram.programId,
        tokenProgram: web3.Constants.TOKEN_PROGRAM_ID,
      })
      .instruction();
    ixs.push(instruction);

    // Fetch the latest blockhash
    const { blockhash } = await connection.getLatestBlockhash();

    // Construct and serialize the transaction
    const transaction = new web3.Transaction({
      recentBlockhash: blockhash,
      feePayer: account,
    });

    transaction.add(...ixs);
    const serializedTransaction = transaction.serialize();
    const base64Transaction = Buffer.from(serializedTransaction).toString("base64");

    // Construct the success message
    const message = `Your challenge has been created successfully!`;

    return res.status(200).send({ transaction: base64Transaction, message });
  } catch (err) {
    console.error("An error occurred", err);
    let message = "An unknown error occurred";
    if (typeof err === "string") message = err;
    res.status(400).json({ error: message });
  }
};

const parseRelativeTime = (time: string): number => {
  const matches = time.match(/^(\d+)([smhd])$/);
  if (!matches) throw new Error('Invalid time format');
  const value = parseInt(matches[1], 10);
  const unit = matches[2];

  switch (unit) {
    case 's': return value * 1000; // seconds to milliseconds
    case 'm': return value * 60 * 1000; // minutes to milliseconds
    case 'h': return value * 60 * 60 * 1000; // hours to milliseconds
    case 'd': return value * 24 * 60 * 60 * 1000; // days to milliseconds
    default: throw new Error('Invalid time unit');
  }
};

export default async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    await nextCors(req, res, {
      methods: ["GET", "POST"],
      origin: "*", // Secure this in production
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
  } catch (err) {
    console.error("Error in main handler:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
