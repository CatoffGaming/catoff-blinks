import { ActionGetResponse, LinkedAction } from "@solana/actions";
import * as web3 from "@solana/web3.js";
import type { NextApiRequest, NextApiResponse } from "next";
import nextCors from "nextjs-cors";
import { initWeb3, createNeverHaveIEverGame } from "./helper";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { BlinksightsClient } from "blinksights-sdk";
import logger from "../../common/logger";
import { CreateNeverHaveIEverGameDto } from "./types";

const BLINKS_INSIGHT_API_KEY = process.env.BLINKS_INSIGHT_API_KEY;
const blinksightsClient = new BlinksightsClient(BLINKS_INSIGHT_API_KEY!);

// GET handler to create the game (show the form for game creation)
const getHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const requestUrl = req.url ?? "";

    const baseHref = new URL(`/api/actions/create-never-have-i-ever`, `http://${req.headers.host}`).toString();

    // Define the parameters that the creator must fill in
    const actions: LinkedAction[] = [
      {
        type: 'post',
        label: 'Create Game',
        href: baseHref,
        parameters: [
          { name: "title", label: "Game Title", type: "text", required: true },
          { name: "question1", label: "Enter Question 1", type: "text", required: true },
          { name: "question2", label: "Enter Question 2 (Optional)", type: "text" },
          { name: "question3", label: "Enter Question 3 (Optional)", type: "text" },
          {
            name: "currency",
            label: "Choose currency",
            type: "radio",
            options: [
              { label: "SOL", value: "SOL" },
              { label: "USDC", value: "USDC" },
              { label: "BONK", value: "BONK" },
            ],
          },
          { name: "wager", label: "Wager Amount", type: "number", required: true },
          { name: "startTime", label: "Start Time (e.g., 5h = 5 hours)", type: "text", required: true },
          { name: "duration", label: "Duration (e.g., 2d = 2 days)", type: "text", required: true },
        ],
      },
    ];

    const payload = await blinksightsClient.createActionGetResponseV1(requestUrl, {
      title: `🚀 Create Never Have I Ever Game`,
      icon: `http://${req.headers.host}/never-have-i-ever.gif`,
      type: "action",
      description: `Create your own Never Have I Ever game! Add questions, choose a wager, and get a link to invite your friends.`,
      label: "Create your game",
      links: { actions }
    });

    if (!payload) {
      logger.error("Payload construction failed");
      return res.status(400).json({ error: "Payload is incorrect" });
    }

    await blinksightsClient.trackRenderV1(requestUrl, payload);
    res.status(200).json(payload);
  } catch (err) {
    logger.error("Error in getHandler: %s", err);
    res.status(400).json({ error: "An unknown error occurred" });
  }
};

// POST handler to process game creation and perform the on-chain transaction
const postHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    console.log(req.body);
    
    const { account, data } = req.body;
    const { title, question1, question2, question3, currency, wager, startTime, duration } = data || {};

    if (!account || !title || !question1 || !currency || !wager || !startTime || !duration) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const accountPublicKey = new PublicKey(account);

    // Create the game in the backend (for future use)
    const gameDetails: CreateNeverHaveIEverGameDto = {
      CreatorAddress: accountPublicKey.toString(),
      GameTitle: title,
      Question1: question1,
      Question2: question2 || "",
      Question3: question3 || "",
      Currency: currency,
      WagerAmount: Number(wager),
      StartDate: Date.now(),
      EndDate: Date.now() + parseDuration(duration),
    };

    await createNeverHaveIEverGame(gameDetails);

    // Initiating the on-chain transaction
    const { connection } = await initWeb3();

    const transaction = new web3.Transaction().add(
      web3.SystemProgram.transfer({
        fromPubkey: accountPublicKey,
        toPubkey: accountPublicKey,  // Placeholder, simulate sending 0 SOL to self for demo
        lamports: 1000,  // Small number of lamports (1000 lamports = 0.000001 SOL)
      })
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = accountPublicKey;

    const serializedTransaction = transaction.serialize({ requireAllSignatures: false });
    const base64Transaction = serializedTransaction.toString("base64");

    const gameLink = `https://dial.to/devnet?action=solana-action:http://localhost:3000/api/actions/never-have-i-ever/challengeID=${Math.random().toString(36).substring(7)}`;

    res.status(200).json({
      transaction: base64Transaction,
      message: `Your game has been successfully created! Share this link to invite others: ${gameLink}`,
    });
  } catch (err) {
    logger.error("An error occurred in postHandler: %s", err);
    return res.status(400).json({ error: err || "An unknown error occurred" });
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
    logger.error("Error in main handler: %s", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Helper function to parse duration (e.g., "5h" = 5 hours)
const parseDuration = (duration: string): number => {
  const timeUnit = duration.slice(-1);
  const timeValue = parseInt(duration.slice(0, -1));
  
  switch (timeUnit) {
    case 'h': return timeValue * 60 * 60 * 1000;  // hours to milliseconds
    case 'm': return timeValue * 60 * 1000;  // minutes to milliseconds
    case 's': return timeValue * 1000;  // seconds to milliseconds
    case 'd': return timeValue * 24 * 60 * 60 * 1000;  // days to milliseconds
    default: throw new Error("Invalid duration format");
  }
};
