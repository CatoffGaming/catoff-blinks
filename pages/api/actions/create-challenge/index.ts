import {
  ActionGetResponse,
  LinkedAction,
  ActionPostRequest as SolanaActionPostRequest,
} from "@solana/actions";
import * as web3 from "@solana/web3.js";
import BN from "bn.js";
import type { NextApiRequest, NextApiResponse } from "next";
import nextCors from "nextjs-cors";
import axios from "axios";
import {
  ApiResponse,
  GAME_TYPE,
  getGameID,
  IChallengeById,
  PARTICIPATION_TYPE,
} from "./types";
import {
  getAssociatedTokenAccount,
  web3Constants,
  IWeb3Participate,
  initWeb3,
} from "./helper";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  CHALLENGE_CATEGORIES,
  ICreateChallenge,
  VERIFIED_CURRENCY,
} from "../join-challenge/types";
import { refreshToken } from "./refreshTokens";

const getHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { participationtype } = req.query;
    const participationType = Number(participationtype);

    const baseHref = new URL(
      `/api/actions/create-challenge`,
      `http://${req.headers.host}` // Fixed URL construction
    ).toString();

    console.log(baseHref);

    const actions: LinkedAction[] = [
      {
        label: "Create Challenge", // button text
        href: `${baseHref}?participationtype=${participationtype}&wager={wager}&target={target}&startTime={startTime}&duration={duration}&name={name}&token={token}`, // Fixed template literal
        parameters: [
          {
            name: "token",
            label: "Choose Token",
            type: "radio",
            options: [
              {
                label: VERIFIED_CURRENCY.SOL,
                value: VERIFIED_CURRENCY.SOL,
                selected: true,
              },
              {
                label: VERIFIED_CURRENCY.USDC,
                value: VERIFIED_CURRENCY.USDC,
              },
              {
                label: VERIFIED_CURRENCY.SEND,
                value: VERIFIED_CURRENCY.SEND,
              },
              {
                label: VERIFIED_CURRENCY.BONK,
                value: VERIFIED_CURRENCY.BONK,
              },
            ],
          },
          {
            name: "name", // field name
            label: "Name your dare", // text input placeholder
          },
          {
            name: "wager", // field name
            label: "Wager amount", // text input placeholder
            type: "number",
          },
          {
            name: "target", // field name
            label: "Target", // text input placeholder
            type: "number",
          },
          {
            name: "startTime", // field name
            label: "Start the challenge in?", // text input placeholder
            type: "datetime-local",
          },
          {
            name: "duration", // field name
            label:
              "Duration of the the challenge? e.g. 5m, 10m, 1h, 12h, 1d...", // text input placeholder
          },
        ],
      },
    ];

    const dareIconUrl = new URL(
      "/dare.png",
      `http://${req.headers.host}` // Fixed URL construction
    ).toString();
    const peerIconUrl = new URL(
      "/peer.png",
      `http://${req.headers.host}` // Fixed URL construction
    ).toString();
    const multiIconUrl = new URL(
      "/multi.png",
      `http://${req.headers.host}` // Fixed URL construction
    ).toString();

    let payload: ActionGetResponse | null = null;

    if (participationType === 0) {
      payload = {
        title: "🚀 Create Dares on Blinks",
        icon: dareIconUrl,
        type: "action",
        description:
          "🚀 Dare Accepted! Set terms, watch to see who steps up and who is a Catoff.",
        label: "Create",
        links: {
          actions: actions,
        },
      };
    } else if (participationType === 1) {
      payload = {
        title: "Create 1v1 Challenge",
        icon: peerIconUrl,
        type: "action",
        description:
          "🚀 Duel On! Ignite 1v1 showdowns on X. Fitness, sports, skills - pick your battlefield.",
        label: "Create",
        links: {
          actions: actions,
        },
      };
    } else if (participationType === 2) {
      payload = {
        title: "Create Multiplayer Challenge",
        icon: multiIconUrl,
        type: "action",
        description: "🚀 Battle Royale! Launch multiplayer challenges on X.",
        label: "Create",
        links: {
          actions: actions,
        },
      };
    }

    if (!payload) {
      res.status(400).json({ error: "Payload is incorrect" });
    }

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
  if (!matches) throw new Error("Invalid time format");
  const value = parseInt(matches[1], 10);
  const unit = matches[2];

  switch (unit) {
    case "s":
      return value * 1000; // seconds to milliseconds
    case "m":
      return value * 60 * 1000; // minutes to milliseconds
    case "h":
      return value * 60 * 60 * 1000; // hours to milliseconds
    case "d":
      return value * 24 * 60 * 60 * 1000; // days to milliseconds
    default:
      throw new Error("Invalid time unit");
  }
};

const postHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { account } = req.body;
    const bearerToken = await refreshToken();
    console.log(bearerToken);

    if (!account) {
      console.error("Account not found in body");
      return res.status(400).json({ error: 'Invalid "account" provided' });
    }

    const { name, wager, target, startTime, duration, participationtype, token } =
      req.query;
    console.log("Received query parameters:", {
      name,
      wager,
      target,
      startTime,
      duration,
      participationtype,
      token,
    });

    const startTimeMs = new Date(startTime as string).getTime()
    if (
      !name ||
      !wager ||
      !target ||
      !startTime ||
      !duration ||
      !participationtype || 
      !token
    ) {
      console.error("Missing required parameters", {
        name,
        wager,
        target,
        startTime,
        duration,
        participationtype,
        token,
      });
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const accountPublicKey = new PublicKey(account);

    console.log(
      "Public key (account) parsed successfully:",
      accountPublicKey.toString()
    );

    const durationMillis = parseRelativeTime(duration as string); // e.g., 10m -> 600000 milliseconds

    const endTime = Math.floor(startTimeMs + durationMillis);

    const aiResponse = await axios.post(
      "https://ai-api.catoff.xyz/generate-description-x-api-key/",
      {
        prompt: `${name}`,
        participation_type: "0v1",
        result_type: "validator",
        additional_info: "",
      }
    );

    const aiGeneratedDescription = aiResponse.data.challenge_description;
    console.log("AI-generated description:", aiGeneratedDescription);

    const gameId = getGameID(
      parseInt(participationtype as string),
      GAME_TYPE.VALIDATOR
    );

    if (!gameId) {
      console.error(
        `Game is not valid, with participation type: ${participationtype}, gametype: ${GAME_TYPE.VALIDATOR}`
      );
      return res.status(400).json({ error: "Game is not valid" });
    }

    const createChallengeJson: ICreateChallenge = {
      ChallengeName: name as string,
      ChallengeDescription: aiGeneratedDescription,
      StartDate: startTimeMs,
      EndDate: endTime,
      GameID: gameId,
      Wager: parseFloat(wager as string),
      Target: parseFloat(target as string),
      IsPrivate: false,
      Currency: token as VERIFIED_CURRENCY,
      ChallengeCategory: CHALLENGE_CATEGORIES.SOCIAL_MEDIA,
      NFTMedia: "placeholder",
      Media: "placeholder",
    };

    const externalApiResponse = await axios.post(
      "https://stagingapi5.catoff.xyz/challenge",
      createChallengeJson,
      {
        headers: {
          Authorization: `bearer ${bearerToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("External API response:", externalApiResponse.data);

    console.log("Challenge JSON:", createChallengeJson);

    const textInput = JSON.stringify(createChallengeJson);

    const { program, connection, wallet } = await initWeb3();

    let ixs: web3.TransactionInstruction[] = [];
    const instruction = await program.methods
      .processStringInput("create-challenge.11", "textInput")
      .accounts({
        user: accountPublicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    ixs.push(instruction);

    const { blockhash } = await connection.getLatestBlockhash();
    console.log("blockhash: ", blockhash);
    console.log("ins: ", instruction);

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
