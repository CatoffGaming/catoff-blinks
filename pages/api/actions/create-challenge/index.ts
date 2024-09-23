import { ActionGetResponse, LinkedAction } from "@solana/actions";
import * as web3 from "@solana/web3.js";
import type { NextApiRequest, NextApiResponse } from "next";
import nextCors from "nextjs-cors";
import axios from "axios";
import { GAME_TYPE, getGameID } from "./types";
import { initWeb3 } from "./helper";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  CHALLENGE_CATEGORIES,
  ICreateChallenge,
  VERIFIED_CURRENCY,
} from "../join-challenge/types";
import { BlinksightsClient } from "blinksights-sdk";
import logger from "../../common/logger"; // Ensure logger is imported

const BLINKS_INSIGHT_API_KEY = process.env.BLINKS_INSIGHT_API_KEY;
const partnerApiKey = process.env.PARTNER_API_KEY;
const blinksightsClient = new BlinksightsClient(BLINKS_INSIGHT_API_KEY!);

const getHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { participationtype } = req.query;
    const participationType = Number(participationtype);

    logger.info(
      "GET request received with participation type: %s",
      participationType
    );

    const baseHref = new URL(
      `/api/actions/create-challenge`,
      `http://${req.headers.host}` // Fixed URL construction
    ).toString();

    logger.info("Base URL constructed: %s", baseHref);

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
            label: "Name your challenge", // text input placeholder
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
            label: "Start the challenge in? e.g. 5m, 10m, 1h, 12h, 1d...", // text input placeholder
          },
          {
            name: "duration", // field name
            label:
              "Duration of the the challenge? e.g. 5m, 10m, 1h, 12h, 1d...", // text input placeholder
          },
        ],
      },
    ];

    const icons = {
      dare: new URL("/dare.png", `https://${req.headers.host}`).toString(),
      peer: new URL("/peer.png", `https://${req.headers.host}`).toString(),
      multi: new URL("/multi.png", `https://${req.headers.host}`).toString(),
    };

    const requestUrl = req.url ?? "";
    let payload = null;

    switch (participationType) {
      case 0:
        logger.info("Creating payload for IRL Dares");
        payload = await blinksightsClient.createActionGetResponseV1(
          requestUrl,
          {
            title: `🚀 Create IRL Dares:`,
            icon: icons.dare,
            type: "action",
            description: `- Make daring IRL challenges for friends\n- Wager on who will step up or back down\n- Spectators can join with side bets and raise the stakes. Who will rise to the challenge? Dare, compete, win big! 💪🔥`,
            label: "Create",
            links: { actions },
          }
        );
        break;
      case 1:
        logger.info("Creating payload for 1v1 Duel challenges");
        payload = await blinksightsClient.createActionGetResponseV1(
          requestUrl,
          {
            title: `🚀 Duel On!`,
            icon: icons.peer,
            type: "action",
            description: `- Ignite 1v1 showdowns in fitness, sports, skills, or games\n- Wager on every clash in real-time\n- Spectators fuel the fire with side bets. Who will emerge victorious? Step up, compete, win! 🥊🔥🕹️🔥`,
            label: "Create",
            links: { actions },
          }
        );
        break;
      case 2:
        logger.info("Creating payload for multiplayer challenges");
        payload = await blinksightsClient.createActionGetResponseV1(
          requestUrl,
          {
            title: `🚀 Battle Royale!`,
            icon: icons.multi,
            type: "action",
            description: `- Launch multiplayer challenges from fitness to cooking to creativity\n- Wagers are pooled for high stakes and bigger winnings\n- Spectators sidebet on top contenders. Who will outlast and outshine? Gather your crew, compete, win big! 🏆🔥`,
            label: "Create",
            links: { actions },
          }
        );
        break;
      default:
        logger.error("Invalid participation type: %s", participationType);
        return res.status(400).json({ error: "Invalid participation type" });
    }

    if (!payload) {
      logger.error("Payload construction failed");
      return res.status(400).json({ error: "Payload is incorrect" });
    }

    logger.info("Payload constructed successfully: %o", payload);

    await blinksightsClient.trackRenderV1(requestUrl, payload); //Added blinksights tracker

    res.status(200).json(payload);
  } catch (err) {
    logger.error("Error in getHandler: %s", err);
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

    logger.info("POST request received with account: %s", account);

    if (!account) {
      logger.error("Account not found in body");
      return res.status(400).json({ error: 'Invalid "account" provided' });
    }

    const {
      name,
      wager,
      target,
      startTime,
      duration,
      participationtype,
      token,
    } = req.query;

    logger.info("Received query parameters: %o", {
      name,
      wager,
      target,
      startTime,
      duration,
      participationtype,
      token,
    });

    const startTimeMs = new Date(startTime as string).getTime();
    if (
      !name ||
      !wager ||
      !target ||
      !startTime ||
      !duration ||
      !participationtype ||
      !token
    ) {
      logger.error("Missing required parameters: %o", {
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
    logger.info(
      "Public key (account) parsed successfully: %s",
      accountPublicKey.toString()
    );

    const startTimeMillis = parseRelativeTime(startTime as string); // e.g., 5m -> 300000 milliseconds
    const durationMillis = parseRelativeTime(duration as string); // e.g., 10m -> 600000 milliseconds

    const absoluteStartTime = Math.floor(Date.now() + startTimeMillis);
    const durationInSeconds = Math.floor(durationMillis);
    const endTime = Math.floor(absoluteStartTime + durationMillis);

    const participation_type = () => {
      if (participationtype === "0") {
        return "0v1";
      } else if (participationtype === "1") {
        return "1v1";
      } else if (participationtype === "2") {
        return "NvN";
      }
    };

    let aiGeneratedDescription: string;
    try {
      logger.info("Generating AI description for challenge: %s", name);
      const aiResponse = await axios.post(
        "https://ai-api.catoff.xyz/generate-description-x-api-key/",
        {
          prompt: `${name}`,
          participation_type: participation_type(),
          result_type: "validator",
          additional_info: "",
        },
        { timeout: 100000 }
      );
      aiGeneratedDescription = aiResponse.data.challenge_description;
      logger.info("AI-generated description: %s", aiGeneratedDescription);
    } catch (error: any) {
      logger.error(
        "Error generating AI description: %s",
        error.message || error
      );
      return res
        .status(500)
        .json({ error: "Failed to generate AI description" });
    }

    const gameId = getGameID(
      parseInt(participationtype as string),
      GAME_TYPE.VALIDATOR
    );

    if (!gameId) {
      logger.error(
        `Game is not valid, with participation type: %s, gametype: %s`,
        participationtype,
        GAME_TYPE.VALIDATOR
      );
      return res.status(400).json({ error: "Game is not valid" });
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
      Currency: token as VERIFIED_CURRENCY,
      ChallengeCategory: CHALLENGE_CATEGORIES.SOCIAL_MEDIA, 
      NFTMedia: "ipfsLink",
      Media: "placeholder",
      UserAddress: account, 
    };

    logger.info("Create challenge JSON: %o", createChallengeJson);

    let externalApiResponse: any;
    try {
      logger.info("Sending request to external API");
      externalApiResponse = await axios.post(
        "https://apiv2.catoff.xyz/challenge",
        createChallengeJson,
        {
          headers: {
            "x-api-key": partnerApiKey,
            "Content-Type": "application/json",
          },
          timeout: 100000,
        }
      );

      logger.info("External API response: %o", externalApiResponse.data);
    } catch (error: any) {
      logger.error("Error creating challenge: %s", error.message || error);
      return res.status(500).json({ error: "Failed to create challenge" });
    }

    const textInput = JSON.stringify(createChallengeJson);

    const requestUrl = req.url ?? "";
    await blinksightsClient.trackActionV2(
      accountPublicKey.toString(),
      requestUrl
    );
    const blinksightsActionIdentityInstruction =
      await blinksightsClient.getActionIdentityInstructionV2(
        accountPublicKey.toString(),
        requestUrl
      );

    const { program, connection, wallet } = await initWeb3();

    let ixs: web3.TransactionInstruction[] = [];

    if (blinksightsActionIdentityInstruction) {
      ixs.push(blinksightsActionIdentityInstruction);
    }

    const instruction = await program.methods
      .processStringInput("create-challenge.11", "textInput")
      .accounts({
        user: accountPublicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    ixs.push(instruction);

    const { blockhash } = await connection.getLatestBlockhash();
    logger.info("Blockhash: %s", blockhash);

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

    logger.info(
      "Challenge created successfully with ID: %s",
      externalApiResponse.data.data.ChallengeID
    );

    const message = `Your challenge has been created successfully!\nJoin with blink: https://dial.to/devnet?action=solana-action%3Ahttps://join.catoff.xyz/api/actions/join-challenge?challengeID=${externalApiResponse.data.data.ChallengeID}\nOpen Catoff App: https://game.catoff.xyz/challenge/${externalApiResponse.data.data.ChallengeID}`;
    return res.status(200).send({ transaction: base64Transaction, message });
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
