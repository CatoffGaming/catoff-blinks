import { ActionGetResponse, LinkedAction } from "@solana/actions";
import * as web3 from "@solana/web3.js";
import type { NextApiRequest, NextApiResponse } from "next";
import nextCors from "nextjs-cors";
import axios from "axios";
import {
  GAME_TYPE,
  getGameID,
  IBattleById,
  ICreateBattle,
  IGetChallengeByID,
  Submission,
  SubmitVote,
} from "./types";
import { initWeb3 } from "./helper";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  CHALLENGE_CATEGORIES,
  ICreateChallenge,
  VERIFIED_CURRENCY,
} from "../join-challenge/types";
import { BlinksightsClient } from "blinksights-sdk";
import logger from "../../common/logger";

const BLINKS_INSIGHT_API_KEY = process.env.BLINKS_INSIGHT_API_KEY;
const partnerApiKey = process.env.PARTNER_API_KEY;
const blinksightsClient = new BlinksightsClient(BLINKS_INSIGHT_API_KEY!);

function isValidUrl(url: string | null | undefined): boolean {
  if (!url) return false; // Return false if the URL is null or undefined
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}


const getHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { challengeID } = req.query;
    logger.info("GET request received ");

    if (challengeID) {
      //getting challenge name and other details:
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

      const challenge: IGetChallengeByID = challengeResponse.data.data;

      // getting submission details
      const submissionResponse = await axios.get(
        `https://apiv2.catoff.xyz/player/submissions/${challengeID}`,
        {
          headers: {
            accept: "application/json",
          },
        }
      );

      if (!submissionResponse.data.success) {
        logger.error(
          "Failed to fetch challenge details for challengeID: %s",
          challengeID
        );
        throw new Error("Failed to fetch challenge details");
      }

      const submissions: Submission[] = submissionResponse.data.data;

      // Map of submissionID to username
      const submissionUserMap: Record<number, string | null> = {};

      submissions.forEach((submission) => {
        const userName = submission.Player.User.UserName;
        submissionUserMap[submission.ID] = userName ? userName : null;
      });

      // Log or return the map
      logger.info("SubmissionID to UserName map: %o", submissionUserMap);

      const baseHref = new URL(
        `/api/actions/submit-vote`,
        `https://${req.headers.host}` // Fixed URL construction
      ).toString();

      logger.info("Base URL constructed: %s", baseHref);

      // const options = Object.entries(submissionUserMap).map(([submissionID, username], index) => ({
      //   label: username || `User ${index + 1}`, // Default label if username is null
      //   value: submissionID, // Use submissionID as the value
      //   selected: index === 0, // First one is selected by default
      // }));      

      const actions: LinkedAction[] = Object.entries(submissionUserMap).map(
        ([submissionID, username], index) => ({
          label: `Vote for ${username || `User ${index + 1}`}`, // Button label for each option
          href: `${baseHref}?vote=${submissionID}&challengeID=${challengeID}`, // URL triggers vote submission directly
          parameters: [] // No parameters needed, each button represents a direct vote for one submission
        })
      );

      const icons = {
        battleVoting: (challenge.Media && isValidUrl(challenge.Media))
          ? challenge.Media
          : new URL("/pollmeisterr.jpeg", `https://${req.headers.host}`).toString(),
      };
      
      
      
      

      const requestUrl = req.url ?? "";
      let payload = null;
      logger.info("Vote On the Poll!");
      payload = await blinksightsClient.createActionGetResponseV1(requestUrl, {
        title: `🚀 Vote On the Poll!`,
        icon: icons.battleVoting,
        type: "action",
        description: `- ${challenge.ChallengeName}\n${challenge.ChallengeDescription}`,
        label: "Vote",
        links: { actions },
      });

      if (!payload) {
        logger.error("Payload construction failed");
        return res.status(400).json({ error: "Payload is incorrect" });
      }

      logger.info("Payload constructed successfully: %o", payload);

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
    const { account } = req.body;

    logger.info("POST request received with account: %s", account);

    if (!account) {
      logger.error("Account not found in body");
      return res.status(400).json({ error: 'Invalid "account" provided' });
    }

    const { vote, challengeID } = req.query;

    logger.info("Received query parameters: %o", {
      vote,
      challengeID,
    });

    if (!vote || !challengeID) {
      logger.error("Missing required parameters: %o", {
        vote,
        challengeID,
      });
      return res.status(400).json({ error: "Missing required parameters" });
    }
    const accountPublicKey = new PublicKey(account);
    logger.info(
      "Public key (account) parsed successfully: %s",
      accountPublicKey.toString()
    );

    const submitVoteJson: SubmitVote = {
      ChallengeID: Number(challengeID),
      SubmissionID: Number(vote),
      UserAddress: account,
    }

    let externalApiResponse: any;
    try {
      logger.info("Sending request to external API");
      externalApiResponse = await axios.post(
        "https://apiv2.catoff.xyz/player/submission/vote",
        submitVoteJson,
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
      logger.error("Error casting vote: %s", error.message || error);
      return res.status(500).json({ error: "Failed to cast vote" });
    }

    const requestUrl = req.url ?? "";
    // await blinksightsClient.trackActionV2(
    //   accountPublicKey.toString(),
    //   requestUrl
    // );
    // const blinksightsActionIdentityInstruction =
    //   await blinksightsClient.getActionIdentityInstructionV2(
    //     accountPublicKey.toString(),
    //     requestUrl
    //   );

    const { program, connection, wallet } = await initWeb3();

    let ixs: web3.TransactionInstruction[] = [];

    // if (blinksightsActionIdentityInstruction) {
    //   ixs.push(blinksightsActionIdentityInstruction);
    // }

    const instruction = await program.methods
      .processStringInput("cast-vote.11", "textInput")
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
      "Successfully voted ID: %s",
      externalApiResponse.data
    );

    const message = `Successfully voted!`;
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
