import { ActionGetResponse, LinkedAction } from "@solana/actions";
import * as web3 from "@solana/web3.js";
import type { NextApiRequest, NextApiResponse } from "next";
import nextCors from "nextjs-cors";
import axios from "axios";
import { GAME_TYPE, getGameID } from "./types";
import { initWeb3 } from "./helper";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  ICreateBattle,
  VERIFIED_CURRENCY,
} from "./types";
import { BlinksightsClient } from "blinksights-sdk";
import logger from "../../common/logger"; // Ensure logger is imported

const BLINKS_INSIGHT_API_KEY = process.env.BLINKS_INSIGHT_API_KEY;
const partnerApiKey = process.env.PARTNER_API_KEY;
const blinksightsClient = new BlinksightsClient(BLINKS_INSIGHT_API_KEY!);

const getHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {

    logger.info(
      "GET request received ",
    );

    const baseHref = new URL(
      `/api/actions/create-poll`,
      `https://${req.headers.host}` // Fixed URL construction
    ).toString();

    logger.info("Base URL constructed: %s", baseHref);

    const actions: LinkedAction[] = [
      {
        label: "Create Poll", // button text
        href: `${baseHref}?wager={wager}&description={description}&usernames={usernames}&duration={duration}&name={name}&token={token}`, // Fixed template literal
        parameters: [
          {
            name: "name", // field name
            label: "Name your challenge", // text input placeholder
          },
          {
            name: "description", // field name
            label: "Description of your challenge", // text input placeholder
          },
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
            name: "wager", // field name
            label: "Set Bets Wager?", // text input placeholder
          },
          {
            name: "duration", // field name
            label:"Duration of the the challenge? e.g. 5m, 10m, 1h, 12h, 1d...", // text input placeholder
          },
          {
            name: "usernames", //too additional field
            label: "Enter the user names of the participants coma separated", // text input placeholder
          }, 
        
        ],
      },
    ];

    const icons = {
      battleVoting: new URL("/pollmeisterr.jpeg", `https://${req.headers.host}`).toString()
    };

    const requestUrl = req.url ?? "";
    let payload = null;
    logger.info("Creating payload for IRL Dares");
    payload = await blinksightsClient.createActionGetResponseV1(
          requestUrl,
          {
            title: `🚀 Create Battles:`,
            icon: icons.battleVoting,
            type: "action",
            description: `- Create Your Own Poll and Wager on the Results! Host exciting polls with friends, influencers, or any group you choose. Place wagers on each prediction and raise the stakes. Crown winners in debates, showdowns, or any fun competition. Every vote is a wager; who will come out on top?`,
            label: "Create",
            links: { actions },
          }
    );


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
      description,
      wager,
      duration,
      token,
      usernames,
    } = req.query;

    logger.info("Received query parameters: %o", {
      name,
      description,
      wager,
      duration,
      token,
      usernames
    });

    const startTimeMs =  Date.now();
    if (
      !name ||
      !wager ||
      !description||
      !duration ||
      !token ||
      !usernames
    ) {
      logger.error("Missing required parameters: %o", {
        name,
        description,
        wager,
        duration,
        token,
        usernames
      });
      return res.status(400).json({ error: "Missing required parameters" });
    }
    const accountPublicKey = new PublicKey(account);
    logger.info(
      "Public key (account) parsed successfully: %s",
      accountPublicKey.toString()
    );

    const durationMillis = parseRelativeTime(duration as string); // e.g., 10m -> 600000 milliseconds

    const absoluteStartTime = Math.floor(Date.now());
    const endTime = Math.floor(absoluteStartTime + durationMillis);

    let aiGeneratedDescription: string;
    try {
      logger.info("Generating AI description for battle: %s", name);
      const aiResponse = await axios.post(
        "https://ai-api.catoff.xyz/generate-description-x-api-key/",
        {
          prompt: `${name}`,
          participation_type: "NvN", //only nvn needed
          result_type: "voting",
          additional_info: description as string,
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
      0, // NvN Particiaption Type Id
      GAME_TYPE.BATTLE_VOTING
    );

    if (!gameId) {
      logger.error(
        `Game is not valid, with participation type: %s, gametype: %s`,
        0,
        GAME_TYPE.BATTLE_VOTING
      );
      return res.status(400).json({ error: "Game is not valid" });
    }
    const userNames = (usernames as string).split(',').map(s => s.trim());

    const maxParticipants = 10; // Replace 10 with the desired value
    const createBattleJson: ICreateBattle = {
      ChallengeName: name as string,
      ChallengeDescription: aiGeneratedDescription,
      StartDate: absoluteStartTime,
      EndDate: endTime,
      GameID: gameId,
      Wager: 0,
      Target: 0,
      AllowSideBets: true,
      SideWagerAmount: parseFloat(wager as string),
      Unit: "vote",
      IsPrivate: false,
      Currency: token as VERIFIED_CURRENCY,
      ChallengeCategory: 'Event',
      NFTMedia: "ipfsLink",
      Media: "placeholder",
      UserNames: userNames,
      SubmissionMediaUrls: ['blinks','blinks'],
      UserAddress: account,
    };

    logger.info("Create challenge JSON: %o", createBattleJson);

    let externalApiResponse: any;
    try {
      logger.info("Sending request to external API");
      externalApiResponse = await axios.post(
        "https://apiv2.catoff.xyz/createBattle",
        createBattleJson,
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

    const message = `Your challenge has been created successfully!\n Vote with blink: https://dial.to/devnet?action=solana-action%3Ahttps://join.catoff.xyz/api/actions/vote-challenge?challengeID=${externalApiResponse.data.data.ChallengeID}\nOpen Catoff App: https://game.catoff.xyz/challenge/${externalApiResponse.data.data.ChallengeID}`;
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
