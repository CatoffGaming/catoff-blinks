import {
  ActionGetResponse,
  LinkedAction,
  ActionPostRequest as SolanaActionPostRequest,
} from "@solana/actions";
import * as web3 from "@solana/web3.js";
import BN from "bn.js";
import type { NextApiRequest, NextApiResponse } from "next";
import nextCors from "nextjs-cors";
import { IChallengeById, JOIN_CHALLENGE_METHOD } from "./types";
import axios from "axios";
import {
  getAssociatedTokenAccount,
  web3Constants,
  IWeb3Participate,
  initWeb3,
} from "./helper";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import logger from "../../common/logger";

import { BlinksightsClient } from 'blinksights-sdk';

const BLINKS_INSIGHT_API_KEY = process.env.BLINKS_INSIGHT_API_KEY;
const blinksightsClient = new BlinksightsClient(BLINKS_INSIGHT_API_KEY);

const getHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { challengeID } = req.query;

    logger.info("GET Request received with challengeID: %s", challengeID);

    if (challengeID) {
      const challengeResponse = await axios.get(
        `https://apiv2.catoff.xyz/challenge/${challengeID}`,
        {
          headers: {
            accept: "application/json",
          },
        }
      );

      if (!challengeResponse.data.success) {
        logger.error(
          "Failed to fetch challenge details for challengeID: %s",
          challengeID
        );
        throw new Error("Failed to fetch challenge details");
      }

      const challenge: IChallengeById = challengeResponse.data.data;

      logger.info("Fetched challenge details for challengeID: %s", challengeID);

      const baseHref = new URL(
        `/api/actions/join-challenge`,
        `https://${req.headers.host}`
      ).toString();

      const actions = [
        {
          label: `Join Challenge ${challenge.ChallengeID}`,
          href: `${baseHref}?challengeId=${challengeID}`,
        },
      ];

      const iconUrl = new URL(
        "/logo.png",
        `https://${req.headers.host}`
      ).toString();

      const payload: ActionGetResponse = {
        title: "Join Challenge",
        icon: iconUrl,
        type: "action",
        description: `${challenge.ChallengeName}\n${challenge.ChallengeDescription}`,
        label: "Join",
        links: {
          actions: actions,
        },
      };

      logger.info(
        "Payload constructed successfully for challengeID: %s",
        challengeID
      );

      res.status(200).json(payload);
    } else {
      const baseHref = new URL(
        `/api/actions/join-challenge`,
        `https://${req.headers.host}`
      ).toString();

      const actions: LinkedAction[] = [
        {
          label: "Join Catoff Challenge",
          href: `${baseHref}?method={method}&value={value}`,
          parameters: [
            {
              name: "method",
              label: "You have?",
              type: "radio",
              options: [
                {
                  label: "Challenge Link",
                  value: JOIN_CHALLENGE_METHOD.LINK,
                  selected: true,
                },
                {
                  label: "Challenge SLUG",
                  value: JOIN_CHALLENGE_METHOD.SLUG,
                },
                {
                  label: "Challenge ID",
                  value: JOIN_CHALLENGE_METHOD.CHALLENGE_ID,
                },
              ],
            },
            {
              name: "value",
              label: "Paste the link/SLUG/Challenge ID",
            },
          ],
        },
      ];

      const iconUrl = new URL(
        "/logo.png",
        `https://${req.headers.host}`
      ).toString();

      const requestUrl = req.url ?? '';

      const payload: ActionGetResponse = {
        title: "Join Challenges",
        icon: iconUrl,
        type: "action",
        description: `🚀 Join the Action!\n- Enter thrilling IRL or in-game Challenges\n- Compete in high-stakes dares, duels, and multiplayer showdowns\n- Who will rise or crack under pressure? Join the fun, win big! 🎯🔥`,
        label: "Join",
        links: {
          actions: actions,
        },
      };

      logger.info("Payload for joining challenges constructed successfully");

      await blinksightsClient.trackRenderV1(requestUrl, payload);

      res.status(200).json(payload);
    }
  } catch (err) {
    logger.error("Error in getHandler: %s", err);
    res.status(400).json({ error: "An unknown error occurred" });
  }
};

const postHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    logger.info("POST Request received with body: %o", req.body);

    const account = new PublicKey(req.body?.account);
    if (!account) {
      logger.error("Invalid 'account' provided in body");
      return res.status(400).json({ error: 'Invalid "account" provided' });
    }
    const accountStr = account.toString();

    logger.info("Parsed account: %s", accountStr);

    let challengeId: number | null = req.query.challengeId
      ? Number(req.query.challengeId)
      : null;

    logger.info(
      "Extracted Challenge ID: %s for account: %s",
      challengeId,
      accountStr
    );

    if (!challengeId) {
      const method: JOIN_CHALLENGE_METHOD = req.query
        .method as JOIN_CHALLENGE_METHOD;
      const value: string = req.query.value as string;

      logger.info(
        "Method: %s, Value: %s, for account: %s",
        method,
        value,
        accountStr
      );

      switch (method) {
        case JOIN_CHALLENGE_METHOD.CHALLENGE_ID:
          challengeId = parseInt(value);
          logger.info(
            "Parsed challenge ID from value: %s, for account: %s",
            challengeId,
            accountStr
          );
          break;
        case JOIN_CHALLENGE_METHOD.LINK:
          const linkParts = value.split("/");
          const idFromLink = linkParts[linkParts.length - 1];
          challengeId = parseInt(idFromLink);
          if (isNaN(challengeId)) {
            logger.error(
              "Invalid challenge ID in link for account: %s",
              accountStr
            );
            throw new Error("Invalid challenge ID in link");
          }
          logger.info(
            "Extracted challenge ID from link: %s for account: %s",
            challengeId,
            accountStr
          );
          break;
        case JOIN_CHALLENGE_METHOD.SLUG:
          logger.info(
            "Fetching challenge by slug: %s for account: %s",
            value,
            accountStr
          );
          const challengeResponse = await axios.get(
            `https://apiV2.catoff.xyz/challenge/share/${value}`,
            {
              headers: {
                accept: "application/json",
              },
            }
          );
          if (!challengeResponse.data.success) {
            logger.error(
              "Failed to fetch challenge details for slug: %s, account: %s",
              value,
              accountStr
            );
            throw new Error("Failed to fetch challenge details");
          }

          const link = challengeResponse.data.data.Link;
          const linkPartsSlug = link.split("/");
          challengeId = parseInt(linkPartsSlug[linkPartsSlug.length - 1]);
          if (isNaN(challengeId)) {
            logger.error(
              "Invalid challenge ID in link from slug for account: %s",
              accountStr
            );
            throw new Error("Invalid challenge ID in link from slug");
          }
          logger.info(
            "Extracted challenge ID from slug: %s for account: %s",
            challengeId,
            accountStr
          );
          break;
        default:
          logger.error(
            "Invalid method provided for joining challenge for account: %s",
            accountStr
          );
          throw new Error("Invalid method provided for joining challenge");
      }
    }

    logger.info(
      "Fetching challenge details for challengeId: %s, account: %s",
      challengeId,
      accountStr
    );

    const challengeResponse = await axios.get(
      `https://apiv2.catoff.xyz/challenge/${challengeId}`,
      {
        headers: {
          accept: "application/json",
        },
      }
    );
    if (!challengeResponse.data.success) {
      logger.error(
        "Failed to fetch challenge details for challengeId: %s, account: %s",
        challengeId,
        accountStr
      );
      throw new Error("Failed to fetch challenge details");
    }

    const challenge: IChallengeById = challengeResponse.data.data;

    logger.info(
      `Fetched challenge details for challenge: ${JSON.stringify(
        challenge
      )}, account: ${accountStr}`
    );

    const requestUrl = req.url ?? '';
    await blinksightsClient.trackActionV2(account.toString(), requestUrl);
    const blinksightsActionIdentityInstruction = await blinksightsClient.getActionIdentityInstructionV2(account.toString(), requestUrl);
    
    const { program, connection, wallet } = await initWeb3();
    logger.info("Initialized Web3 for account: %s", accountStr);

    let ixs: web3.TransactionInstruction[] = [];
    if (blinksightsActionIdentityInstruction) {
      ixs.push(blinksightsActionIdentityInstruction);
    }

    let web3Participate: IWeb3Participate;
    let userTokenAccount: PublicKey | null =
      web3Constants.escrowUSDCTokenAccount;
    let escrowTokenAccount: PublicKey | null =
      web3Constants.escrowUSDCTokenAccount;
    let TOKEN_MINT_ADDRESS: PublicKey = web3Constants.USDC_MINT_ADDRESS;

    logger.info(
      "Challenge currency: %s, account: %s",
      challenge.Currency,
      accountStr
    );

    if (challenge.Currency === "SOL") {
      web3Participate = {
        wallet,
        connection,
        playerId: new BN(0),
        challengeId: new BN(challenge.ChallengeID),
        amount: new BN(challenge.Wager * 10 ** 9),
        currency: challenge.Currency,
      };

      logger.info(
        "Preparing transaction for SOL currency, account: %s",
        accountStr
      );

      userTokenAccount = await getAssociatedTokenAccount(
        connection,
        web3Constants.escrowAccountPublicKey,
        TOKEN_MINT_ADDRESS
      );

      escrowTokenAccount = await getAssociatedTokenAccount(
        connection,
        web3Constants.escrowAccountPublicKey,
        TOKEN_MINT_ADDRESS
      );
    } else {
      switch (challenge.Currency) {
        case "USDC":
          TOKEN_MINT_ADDRESS = web3Constants.USDC_MINT_ADDRESS;
          break;
        case "BONK":
          TOKEN_MINT_ADDRESS = web3Constants.BONK_MINT_ADDRESS;
          break;
        case "SEND":
          TOKEN_MINT_ADDRESS = web3Constants.SEND_MINT_ADDRESS;
          break;
        default:
          break;
      }

      logger.info(
        "Setting up token for currency: %s, account: %s",
        challenge.Currency,
        accountStr
      );

      web3Participate = {
        wallet,
        connection,
        playerId: new BN(0),
        challengeId: new BN(challenge.ChallengeID),
        amount: new BN (challenge.Wager),
        currency: challenge.Currency,
      };

      logger.info(`Web3 participate: ${web3Participate.playerId}, ${web3Participate.challengeId}, ${challenge.Wager} ${web3Participate.amount}, ${web3Participate.currency}`);

      userTokenAccount = await getAssociatedTokenAccount(
        connection,
        account,
        TOKEN_MINT_ADDRESS
      );

      escrowTokenAccount = await getAssociatedTokenAccount(
        connection,
        web3Constants.escrowAccountPublicKey,
        TOKEN_MINT_ADDRESS
      );
    }

    if (!userTokenAccount) {
      logger.error("User Token account not found for account: %s", accountStr);
      throw new Error("User Token account not found");
    }

    if (!escrowTokenAccount) {
      logger.error(
        "Escrow Token account not found for account: %s",
        accountStr
      );
      throw new Error("Escrow Token account not found");
    }

    logger.info(
      "User token and escrow token accounts set up for account: %s",
      accountStr
    );

    logger.info(
      `Creating tx with data: [${web3Participate.currency},${web3Participate.amount},${web3Participate.challengeId},${web3Participate.playerId}], for account: ${accountStr}`
    );
    logger.info(
      `Creating tx with accounts: [${userTokenAccount},${escrowTokenAccount},${web3Constants.escrowAccountPublicKey}], for account: ${accountStr}`
    );

    const instruction = await program.methods
      .participate(
        web3Participate.currency,
        web3Participate.amount,
        web3Participate.challengeId,
        web3Participate.playerId,
        { joinChallenge: {} }
      )
      .accounts({
        user: account,
        userTokenAccount: userTokenAccount,
        escrowTokenAccount: escrowTokenAccount,
        escrowAccount: web3Constants.escrowAccountPublicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: web3Constants.TOKEN_PROGRAM_ID,
      })
      .instruction();

    logger.info("Transaction instruction prepared for account: %s", accountStr);

    ixs.push(instruction);
    const { blockhash } = await connection.getLatestBlockhash();

    logger.info(
      "Fetched blockhash: %s, for account: %s",
      blockhash,
      accountStr
    );

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
    const message = `Congratulations! You've joined the challenge`;

    logger.info("Transaction serialized for account: %s", accountStr);

    return res.status(200).send({ transaction: base64Transaction, message });
  } catch (err) {
    logger.error("An error occurred for account: %s, error: %s", err);
    let message = "An unknown error occurred";
    if (typeof err === "string") message = err;
    res.status(400).json({ error: message });
  }
};

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
