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

import { BlinksightsClient } from 'blinksights-sdk';

const blinksightsClient = new BlinksightsClient('8c98cb26fd3e663e7dee7e48fc5ef93ec668747cac489d6999308a4c38872f7a');

const getHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { challengeID } = req.query;

    console.log("Extracted challengeID:", challengeID);

    if (challengeID) {
      // Ensure absolute URL for fetching challenge details
      const challengeResponse = await axios.get(
        `https://apiv2.catoff.xyz/challenge/${challengeID}`,
        {
          headers: {
            accept: "application/json",
          },
        }
      );
      if (!challengeResponse.data.success) {
        throw new Error("Failed to fetch challenge details");
      }

      const challenge: IChallengeById = challengeResponse.data.data;

      console.log("here");

      const baseHref = new URL(
        `/api/actions/join-challenge`,
        `https://${req.headers.host}`
      ).toString();

      console.log(baseHref);

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

      const requestUrl = req.url ?? '';

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

      console.log("Payload constructed successfully:", payload);

      await blinksightsClient.trackRenderV1(requestUrl, payload);

      res.status(200).json(payload);
    } else if (!challengeID) {
      const baseHref = new URL(
        `/api/actions/join-challenge`,
        `https://${req.headers.host}`
      ).toString();

      console.log(baseHref);

      const actions: LinkedAction[] = [
        {
          label: "Join Catoff Challenge", // button text
          href: `${baseHref}?method={method}&value={value}`, // Fixed template literal
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
              name: "value", // field name
              label: "Paste the link/SLUG/Challenge ID", // text input placeholder
            },
          ],
        },
      ];

      const iconUrl = new URL(
        "/logo.png",
        `https://${req.headers.host}`
      ).toString();

      const requestUrl = req.url ?? '';

      const payload: ActionGetResponse = await blinksightsClient.createActionGetResponseV1(requestUrl, {
        title: "Join Challenges",
        icon: iconUrl,
        type: "action",
        description: `🚀 Join the Action!\n- Enter thrilling IRL or in-game Challenges\n- Compete in high-stakes dares, duels, and multiplayer showdowns\n- Who will rise or crack under pressure? Join the fun, win big! 🎯🔥`,
        label: "Join",
        links: {
          actions: actions,
        },
      });

      await blinksightsClient.trackRenderV1(requestUrl, payload);

      res.status(200).json(payload);
    }
  } catch (err) {
    console.error("Error in getHandler:", err);
    res.status(400).json({ error: "An unknown error occurred" });
  }
};

const postHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const account = new PublicKey(req.body?.account);
    if (!account) {
      console.error("account not found in body");
      res.status(400).json({ error: 'Invalid "account" provided' });
    }
    let challengeId: number | null = req.query.challengeId
      ? Number(req.query.challengeId)
      : null;
    console.log("here2");

    if (challengeId) {
      console.log("Query Challenge ID:", challengeId);
    } else {
      const method: JOIN_CHALLENGE_METHOD = req.query
        .method as JOIN_CHALLENGE_METHOD;
      const value: string = req.query.value as string;
      switch (method) {
        case JOIN_CHALLENGE_METHOD.CHALLENGE_ID: {
          console.log("here1");
          challengeId = parseInt(value);
          break;
        }
        case JOIN_CHALLENGE_METHOD.LINK: {
          // Extract the challenge ID from the link.
          const linkParts = value.split("/");
          const idFromLink = linkParts[linkParts.length - 1];
          challengeId = parseInt(idFromLink);
          if (isNaN(challengeId)) {
            throw new Error("Invalid challenge ID in link");
          }
          break;
        }
        case JOIN_CHALLENGE_METHOD.SLUG: {
          const challengeResponse = await axios.get(
            `https://apiV2.catoff.xyz/challenge/share/${value}`,
            {
              headers: {
                accept: "application/json",
              },
            }
          );
          if (!challengeResponse.data.success) {
            throw new Error("Failed to fetch challenge details");
          }

          // Extract the challenge ID from the returned link.
          const link = challengeResponse.data.data.Link;
          const linkParts = link.split("/");
          challengeId = parseInt(linkParts[linkParts.length - 1]);
          if (isNaN(challengeId)) {
            throw new Error("Invalid challenge ID in link from slug");
          }

          break;
        }
        default:
          throw new Error("Invalid method provided for joining challenge");
      }
    }

    const challengeResponse = await axios.get(
      `https://apiv2.catoff.xyz/challenge/${challengeId}`,
      {
        headers: {
          accept: "application/json",
        },
      }
    );
    if (!challengeResponse.data.success) {
      throw new Error("Failed to fetch challenge details");
    }

    const challenge: IChallengeById = challengeResponse.data.data;

    const requestUrl = req.url ?? '';
    await blinksightsClient.trackActionV2(account.toString(), requestUrl);
    const blinksightsActionIdentityInstruction = await blinksightsClient.getActionIdentityInstructionV2(account.toString(), requestUrl);

    const { program, connection, wallet } = await initWeb3();

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

    if (challenge.Currency === "SOL") {
      web3Participate = {
        wallet,
        connection,
        playerId: new BN(0),
        challengeId: new BN(challenge.ChallengeID),
        amount: new BN(challenge.Wager * 10 ** 9),
        currency: challenge.Currency,
      };

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

      web3Participate = {
        wallet,
        connection,
        playerId: new BN(0),
        challengeId: new BN(challenge.ChallengeID),
        amount: new BN(challenge.Wager),
        currency: challenge.Currency,
      };

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
      throw new Error("user Token account not found");
    }

    if (!escrowTokenAccount) {
      throw new Error("escrow Token account not found");
    }

    console.log("Participate Instruction Accounts:", {
      user: account.toString(),
      userTokenAccount: userTokenAccount.toString(),
      escrowTokenAccount: escrowTokenAccount.toString(),
      escrowAccount: web3Constants.escrowAccountPublicKey.toString(),
      systemProgram: SystemProgram.programId.toString(),
      tokenProgram: web3Constants.TOKEN_PROGRAM_ID.toString(),
    });

    const instruction = await program.methods
      .participate(
        web3Participate.currency,
        web3Participate.amount,
        web3Participate.challengeId,
        web3Participate.playerId,
        { joinChallenge: {} }
      )
      .accounts({
        user: new PublicKey(account),
        userTokenAccount: userTokenAccount,
        escrowTokenAccount: escrowTokenAccount,
        escrowAccount: web3Constants.escrowAccountPublicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: web3Constants.TOKEN_PROGRAM_ID,
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
    const message = `Congratulations! You've joined the challenge`;
    return res.status(200).send({ transaction: base64Transaction, message });
  } catch (err) {
    console.error("An error occurred", err);
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
