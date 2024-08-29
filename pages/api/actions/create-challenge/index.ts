import {
  ActionGetResponse,
  ActionPostRequest as SolanaActionPostRequest,
} from "@solana/actions";
import * as web3 from "@solana/web3.js";
import BN from "bn.js";
import type { NextApiRequest, NextApiResponse } from "next";
import nextCors from "nextjs-cors";
import axios from "axios";
import { ApiResponse, GAME_TYPE, getGameID, IChallengeById, PARTICIPATION_TYPE } from "./types";
import { getAssociatedTokenAccount, web3Constants, IWeb3Participate, initWeb3 } from './helper';
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { CHALLENGE_CATEGORIES, ICreateChallenge, VERIFIED_CURRENCY } from "../join-challenge/types";
import { refreshToken } from "./refreshTokens";

const getHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { participationtype } = req.query;

    const baseHref = new URL(
      `/api/actions/create-challenge`,
      `http://${req.headers.host}` // Fixed URL construction
    ).toString();

    console.log(baseHref);

    const actions = [
      {
        "label": "Create Challenge", // button text
        "href": `${baseHref}?participationtype=${participationtype}&wager={wager}&target={target}&startTime={startTime}&duration={duration}&name={name}`, // Fixed template literal
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
            "label": "Target for your friend or foe" // text input placeholder
          },
          {
            "name": "startTime", // field name
            "label": "Start the challenge in? e.g. 5m, 10m, 1h, 12h, 1d..." // text input placeholder
          },
          {
            "name": "duration", // field name
            "label": "Duration of the the challenge? e.g. 5m, 10m, 1h, 12h, 1d..." // text input placeholder
          },
        ]
      }
    ];

    const iconUrl = new URL(
      "/logo.png",
      `http://${req.headers.host}` // Fixed URL construction
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
    const { account } = req.body;
    const bearerToken = await refreshToken()
    console.log(bearerToken)


    if (!account) {
      console.error("Account not found in body");
      return res.status(400).json({ error: 'Invalid "account" provided' });
    }

    const { name, wager, target, startTime, duration, participationtype } = req.query;
    console.log("Received query parameters:", { name, wager, target, startTime, duration, participationtype });

    if (!name || !wager || !target || !startTime || !duration || !participationtype) {
      console.error('Missing required parameters', { name, wager, target, startTime, duration, participationtype });
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const accountPublicKey = new PublicKey(account);

    console.log("Public key (account) parsed successfully:", accountPublicKey.toString());

    const startTimeMillis = parseRelativeTime(startTime as string); // e.g., 5m -> 300000 milliseconds
    const durationMillis = parseRelativeTime(duration as string); // e.g., 10m -> 600000 milliseconds

    const absoluteStartTime = Math.floor((Date.now() + startTimeMillis));
    const durationInSeconds = Math.floor(durationMillis);
    const endTime = Math.floor(absoluteStartTime + durationMillis);

    const aiResponse = await axios.post("https://ai-api.catoff.xyz/generate-description-x-api-key/", {
      prompt: `${name}`,
      participation_type: "0v1",
      result_type: "validator",
      additional_info: ""
    });

    const aiGeneratedDescription = aiResponse.data.challenge_description;
    console.log("AI-generated description:", aiGeneratedDescription);

    const gameId = getGameID(parseInt(participationtype as string), GAME_TYPE.VALIDATOR)

    if (!gameId){
      console.error(`Game is not valid, with participation type: ${participationtype}, gametype: ${GAME_TYPE.VALIDATOR}`)
      return res.status(400).json({ error: 'Game is not valid' });
    }

    const createChallengeJson: ICreateChallenge = {
      ChallengeName: name as string,
      ChallengeDescription: aiGeneratedDescription,
      StartDate: absoluteStartTime,
      EndDate: endTime,
      GameID: gameId,
      Wager: parseFloat(wager as string),
      Target: parseFloat(target as string),
      IsPrivate: false,
      Currency: VERIFIED_CURRENCY.SOL,
      ChallengeCategory: CHALLENGE_CATEGORIES.SOCIAL_MEDIA,
      NFTMedia: "placeholder",
      Media: "placeholder"
    };

    const externalApiResponse = await axios.post(
      "https://stagingapi5.catoff.xyz/challenge",
      createChallengeJson,
      {
        headers: {
          Authorization: `bearer ${bearerToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("External API response:", externalApiResponse.data);

    console.log("Challenge JSON:", createChallengeJson);

    const textInput = JSON.stringify(createChallengeJson)

    const { program, connection, wallet } = await initWeb3();

    let ixs: web3.TransactionInstruction[] = [];
    const instruction = await program.methods
      .processStringInput("create-challenge.11", textInput)
      .accounts({
        user: accountPublicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    ixs.push(instruction);

    const { blockhash } = await connection.getLatestBlockhash();
    console.log("blockhash: ", blockhash);
    console.log("ins: ", instruction)

    const transaction = new web3.VersionedTransaction(
      new web3.TransactionMessage({
        payerKey: new PublicKey(account),
        recentBlockhash: blockhash,
        instructions: ixs,
      }).compileToV0Message()
    );


    const serializedTransaction = transaction.serialize();
    const base64Transaction = Buffer.from(serializedTransaction).toString(
      "base64"
    );
    const message = "Your challenge has been created successfully!"; // Fixed string formatting
    return res.status(200).send({ transaction: base64Transaction, message });
  } catch (err) {
    console.error("An error occurred:", err);
    const message = (err instanceof Error) ? err.message : "An unknown error occurred";
    return res.status(400).json({ error: message });
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
      res.status(405).end(`Method ${req.method} Not Allowed`); // Fixed string formatting
    }
  } catch (err) {
    console.error("Error in main handler:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
