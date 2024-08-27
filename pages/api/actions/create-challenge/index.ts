import {
  ActionGetResponse,
  ActionPostRequest as SolanaActionPostRequest,
} from "@solana/actions";
import * as web3 from "@solana/web3.js";
import BN from "bn.js";
import type { NextApiRequest, NextApiResponse } from "next";
import nextCors from "nextjs-cors";
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
      description: "To settle your X beef now, dare your friends or foes!",
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

// Utility function to parse relative time to milliseconds
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

const postHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { account, text } = req.body;

    if (!account) {
      console.error("Account not found in body");
      return res.status(400).json({ error: 'Invalid "account" provided' });
    }

    if (!text) {
      console.error("Text not found in body");
      return res.status(400).json({ error: 'Missing "text" parameter' });
    }

    const { name, wager, target, startTime, duration, walletAddress } = req.query;
    console.log("Received query parameters:", { name, wager, target, startTime, duration, walletAddress });

    if (!walletAddress || Array.isArray(walletAddress)) {
      console.error('walletAddress is missing or invalid:', walletAddress);
      return res.status(400).json({ error: 'Invalid "walletAddress" provided' });
    }

    if (!name || !wager || !target || !startTime || !duration) {
      console.error('Missing required parameters', { name, wager, target, startTime, duration });
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const accountPublicKey = new PublicKey(account);
    const walletPublicKey = new PublicKey(walletAddress as string);

    console.log("Public key (account) parsed successfully:", accountPublicKey.toString());
    console.log("Public key (walletAddress) parsed successfully:", walletPublicKey.toString());

    const startTimeMillis = parseRelativeTime(startTime as string); // e.g., 5m -> 300000 milliseconds
    const durationMillis = parseRelativeTime(duration as string); // e.g., 10m -> 600000 milliseconds

    const absoluteStartTime = Math.floor((Date.now() + startTimeMillis) / 1000); // In seconds
    const durationInSeconds = Math.floor(durationMillis / 1000);

    const wagerValue = new BN(parseInt(wager as string, 10) * 10 ** 9); // Convert to Lamports and BN

    const createChallengeJson = {
      text,
      name: name as string,
      target: target as string,
      start_time: absoluteStartTime,
      duration: durationInSeconds,
      wager: wagerValue, // Ensure BN type for wager
    };

    console.log("Challenge JSON:", createChallengeJson);

    const { program, connection, wallet } = await initWeb3();

    // Create instruction for creating the challenge on-chain
    const instruction = await program.methods
      .createChallenge(
        createChallengeJson.text,
        createChallengeJson.name,
        createChallengeJson.target,
        createChallengeJson.start_time,
        createChallengeJson.duration,
        createChallengeJson.wager,
      )
      .accounts({
        user: accountPublicKey,
        systemProgram: SystemProgram.programId,
        // No need for tokenProgram in this context as it's not involved.
      })
      .instruction();

    const { blockhash } = await connection.getLatestBlockhash();
    console.log("blockhash: ", blockhash);

    const transaction = new web3.Transaction({
      recentBlockhash: blockhash,
      feePayer: accountPublicKey,
    });

    transaction.add(instruction);
    const serializedTransaction = transaction.serialize();
    const base64Transaction = Buffer.from(serializedTransaction).toString(
      "base64"
    );

    const message = `Your challenge has been created successfully!`;
    return res.status(200).send({
      transaction: base64Transaction,
      message,
    });
  } catch (err) {
    console.error("An error occurred:", err);
    const message =
      err instanceof Error ? err.message : "An unknown error occurred";
    return res.status(400).json({ error: message });
  }
};

export default async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    await nextCors(req, res, {
      methods: ["GET", "POST"],
      origin: "*", // Secure this in production
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
  } catch (err) {
    console.error("Error in main handler:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
