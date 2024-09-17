import {
  ActionGetResponse,
  LinkedAction,
} from "@solana/actions";
import axios from "axios";
import logger from "../../common/logger";
import { BlinksightsClient } from 'blinksights-sdk';
import nextCors from "nextjs-cors";

const BLINKS_INSIGHT_API_KEY = process.env.BLINKS_INSIGHT_API_KEY;
const blinksightsClient = new BlinksightsClient(BLINKS_INSIGHT_API_KEY!);

const getHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { challengeID } = req.query;

    logger.info("GET Request received for side-bets/votes with challengeID: %s", challengeID);

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
        logger.error("Failed to fetch challenge details for challengeID: %s", challengeID);
        throw new Error("Failed to fetch challenge details");
      }

      const challenge = challengeResponse.data.data;
      logger.info("Fetched challenge details for challengeID: %s", challengeID);

      const baseHref = new URL(`/api/actions/side-bets`, `https://${req.headers.host}`).toString();

      const actions = challenge.Participants.map((participant: { PlayerID: number, SubmissionID: number }) => ({
        label: `Place Side-Bet on player ${participant.PlayerID}`,
        href: `${baseHref}?submissionId=${participant.SubmissionID}&challengeId=${challengeID}`,
      }));

      const iconUrl = new URL("/logo.png", `https://${req.headers.host}`).toString();

      const payload: ActionGetResponse = {
        title: "Place Your Side Bets or Votes",
        icon: iconUrl,
        description: `Place your side-bets or cast your votes on the challenge participants!`,
        type: "action",
        label: "Place Bet/Vote",
        links: {
          actions: actions,
        },
      };

      logger.info("Payload constructed successfully for side-betting/voting on challengeID: %s", challengeID);

      const requestUrl = req.url ?? '';
      await blinksightsClient.trackRenderV1(requestUrl, payload);

      res.status(200).json(payload);
    } else {
      res.status(400).json({ error: "Missing 'challengeID' parameter" });
    }
  } catch (err) {
    logger.error("Error in side-bet/vote getHandler: %s", err);
    res.status(400).json({ error: "An unknown error occurred" });
  }
};

const postHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    logger.info("POST Request received for side-bet/vote with body: %o", req.body);

    const { account } = req.body;
    const submissionId = req.query.submissionId;
    const challengeId = req.query.challengeId;

    if (!account || !submissionId || !challengeId) {
      return res.status(400).json({ error: '"account", "submissionId", and "challengeId" are required' });
    }

    const accountPublicKey = new PublicKey(account);
    const challengeIdBN = new BN(challengeId);
    const submissionIdBN = new BN(submissionId);

    logger.info("Parsed account: %s, submissionId: %s, challengeId: %s", accountPublicKey.toString(), submissionId, challengeId);

    const challengeResponse = await axios.get(
      `https://apiv2.catoff.xyz/challenge/${challengeId}`,
      {
        headers: {
          accept: "application/json",
        },
      }
    );

    if (!challengeResponse.data.success) {
      logger.error("Failed to fetch challenge details for challengeId: %s", challengeId);
      throw new Error("Failed to fetch challenge details");
    }

    const challenge = challengeResponse.data.data;

    logger.info("Fetched challenge details for side-betting/voting on challengeId: %s", challengeId);

    let TOKEN_MINT_ADDRESS = web3Constants.USDC_MINT_ADDRESS;
    switch (challenge.Currency) {
      case "SOL":
        TOKEN_MINT_ADDRESS = web3Constants.SOL_MINT_ADDRESS;
        break;
      case "BONK":
        TOKEN_MINT_ADDRESS = web3Constants.BONK_MINT_ADDRESS;
        break;
      default:
        break;
    }

    const sideBetAmount = new BN(challenge.Wager).div(new BN(10));

    const userTokenAccount = await getAssociatedTokenAccount(connection, accountPublicKey, TOKEN_MINT_ADDRESS);
    const escrowTokenAccount = await getAssociatedTokenAccount(connection, web3Constants.escrowAccountPublicKey, TOKEN_MINT_ADDRESS);

    if (!userTokenAccount || !escrowTokenAccount) {
      throw new Error("Unable to fetch token accounts");
    }

    const instruction = await program.methods
      .participate("USDC", sideBetAmount, challengeIdBN, submissionIdBN)
      .accounts({
        user: accountPublicKey,
        userTokenAccount: userTokenAccount,
        escrowTokenAccount: escrowTokenAccount,
        escrowAccount: web3Constants.escrowAccountPublicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: web3Constants.TOKEN_PROGRAM_ID,
      })
      .instruction();

    const { blockhash } = await connection.getLatestBlockhash();
    const transaction = new web3.Transaction().add(instruction);
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = accountPublicKey;

    const serializedTransaction = transaction.serialize();
    const base64Transaction = Buffer.from(serializedTransaction).toString("base64");

    const message = `Your side-bet/vote has been placed!`;

    logger.info("Transaction serialized successfully for account: %s", accountPublicKey.toString());

    return res.status(200).send({ transaction: base64Transaction, message });
  } catch (err) {
    logger.error("Error occurred in side-bet/vote postHandler: %s", err);
    let message = "An unknown error occurred";
    if (typeof err === "string") message = err;
    res.status(400).json({ error: message });
  }
};

export default async (req: NextApiRequest, res: NextApiResponse) => {
  await nextCors(req, res, {
    methods: ["GET", "POST"],
    origin: "*", // Change to your frontend URL in production
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
};
