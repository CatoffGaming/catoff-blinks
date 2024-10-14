import {
  ActionPostResponse,
  createPostResponse,
  ActionGetResponse,
  ActionPostRequest,
  createActionHeaders,
  ActionError,
  LinkedAction,
} from "@solana/actions";
import * as web3 from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import { StatusCodes } from "http-status-codes";

import { initWeb3 } from "@/common/helper/helper";
import {
  CLUSTER_TYPES,
  ICreateTransaction,
  PARTICIPATION_TYPE,
  VERIFIED_CURRENCY,
} from "@/common/types";
import { ONCHAIN_CONFIG } from "@/common/helper/cluster.helper";
import { getRequestParam, validateParameters } from "@/common/helper/getParams";
import { GenericError } from "@/common/helper/error";
import logger from "@/common/logger";
import { jsonResponse } from "@/common/helper/responseMaker";
import { calculateTimeRange } from "@/common/helper/parseRelativeTime";
import { createTransaction } from "@/common/helper/transaction.helper";

// create the standard headers for this route (including CORS)
const headers = createActionHeaders();

export const GET = async (req: Request) => {
  try {
    logger.info("GET request received");
    const requestUrl = new URL(req.url);
    const clusterurl = getRequestParam<CLUSTER_TYPES>(
      requestUrl,
      "clusterurl",
      false,
      Object.values(CLUSTER_TYPES),
      CLUSTER_TYPES.DEVNET,
    );
    const participationtype = getRequestParam<PARTICIPATION_TYPE>(
      requestUrl,
      "participationtype",
      true,
      [0, 1, 2],
    );

    const actions: LinkedAction[] = [
      {
        type: "transaction",
        label: "Create a catoff challenge",
        // href: `/api/actions/create-challenge?clusterurl=${clusterurl}&participationtype=${participationtype}&name={name}&token={token}&wager={wager}&target={target}&startTime={startTime}&duration={duration}`,
        href: `/api/actions/create-challenge?clusterurl=${clusterurl}&participationtype=${participationtype}&name={name}&token={token}&wager={wager}&startTime={startTime}&duration={duration}`,
        parameters: [
          {
            name: "name",
            label: "Name your challenge",
            required: true,
          },
          {
            name: "token",
            label: "Choose token",
            type: "radio",
            required: true,
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
                label: VERIFIED_CURRENCY.BONK,
                value: VERIFIED_CURRENCY.BONK,
              },
            ],
          },
          {
            name: "wager",
            label: "Set wager amount",
            required: true,
          },
          // {
          //   name: "target",
          //   label: "Target (0 for non-fitness challenges)",
          //   required: true,
          // },
          {
            name: "startTime",
            label: "Starting time of the challenge. eg: 5m, 1h, 2d...",
            required: true,
          },
          {
            name: "duration",
            label: "Duration of the challenge. eg: 5m, 1h, 2d...",
            required: true,
          },
        ],
      },
    ];

    const basicUrl =
      process.env.IS_PROD === "prod"
        ? "https://join.catoff.xyz"
        : new URL(req.url).origin;

    const icons = {
      dare: new URL("/dare.png", basicUrl).toString(),
      peer: new URL("/peer.png", basicUrl).toString(),
      multi: new URL("/multi.png", basicUrl).toString(),
    };

    let payload: ActionGetResponse;

    switch (Number(participationtype)) {
      case 0:
        logger.info("Creating payload for IRL Dares");
        payload = {
          title: `🚀 Create IRL Dares:`,
          icon: icons.dare,
          type: "action",
          description: `- Make daring IRL challenges for friends\n- Wager on who will step up or back down\n- Spectators can join with side bets and raise the stakes. Who will rise to the challenge? Dare, compete, win big! 💪🔥`,
          label: "Create",
          links: { actions },
        };
        break;
      case 1:
        logger.info("Creating payload for 1v1 Duel challenges");
        payload = {
          title: `🚀 Duel On!`,
          icon: icons.peer,
          type: "action",
          description: `- Ignite 1v1 showdowns in fitness, sports, skills, or games\n- Wager on every clash in real-time\n- Spectators fuel the fire with side bets. Who will emerge victorious? Step up, compete, win! 🥊🔥🕹️🔥`,
          label: "Create",
          links: { actions },
        };
        break;
      case 2:
        logger.info("Creating payload for multiplayer challenges");
        payload = {
          title: `🚀 Battle Royale!`,
          icon: icons.multi,
          type: "action",
          description: `- Launch multiplayer challenges from fitness to cooking to creativity\n- Wagers are pooled for high stakes and bigger winnings\n- Spectators sidebet on top contenders. Who will outlast and outshine? Gather your crew, compete, win big! 🏆🔥`,
          label: "Create",
          links: { actions },
        };
        break;
      default:
        logger.error("Invalid participation type: %s", participationtype);
        throw new GenericError(
          "Invalid participation type",
          StatusCodes.BAD_REQUEST,
        );
    }

    logger.info("Payload constructed successfully: %o", payload);

    return jsonResponse(payload, StatusCodes.OK, headers);
  } catch (err) {
    logger.error("An error occurred in GET handler: %s", err);
    let actionError: ActionError = { message: "An unknown error occurred" };
    if (typeof err === "string") actionError.message = err;
    return jsonResponse(actionError, StatusCodes.BAD_REQUEST, headers);
  }
};

// DO NOT FORGET TO INCLUDE THE `OPTIONS` HTTP METHOD
// THIS WILL ENSURE CORS WORKS FOR BLINKS
export const OPTIONS = async () => Response.json(null, { headers });

export const POST = async (req: Request) => {
  try {
    const requestUrl = new URL(req.url);
    logger.info("POST request received for creating challenge");

    // Validate and retrieve parameters with logging
    const clusterurl = getRequestParam<CLUSTER_TYPES>(
      requestUrl,
      "clusterurl",
      false,
      Object.values(CLUSTER_TYPES),
      CLUSTER_TYPES.DEVNET,
    );
    const participationtype = getRequestParam<PARTICIPATION_TYPE>(
      requestUrl,
      "participationtype",
      true,
      [0, 1, 2],
    );
    const name = getRequestParam<string>(requestUrl, "name", true);
    const token = getRequestParam<VERIFIED_CURRENCY>(
      requestUrl,
      "token",
      true,
      Object.values(VERIFIED_CURRENCY),
      VERIFIED_CURRENCY.SOL,
    );
    const wager = getRequestParam<number>(requestUrl, "wager", true);
    validateParameters("wager", wager > 0, "Wager must be greater than zero");

    // const target = getRequestParam<number>(
    //   requestUrl,
    //   "target",
    //   false,
    //   undefined,
    //   0,
    // );
    // validateParameters("target", target >= 0, "Target must be zero or higher");

    const startTimeStr = getRequestParam<string>(requestUrl, "startTime", true);
    const durationStr = getRequestParam<string>(requestUrl, "duration", true);
    const { startDate, endDate } = calculateTimeRange(
      startTimeStr,
      durationStr,
    );
    // const startTime = parseRelativeTime(startTimeStr);
    // const duration = parseRelativeTime(durationStr);

    // Retrieve request body and validate account
    const body: ActionPostRequest = await req.json();
    let account: PublicKey;
    try {
      account = new PublicKey(body.account);
      logger.info(`Account PublicKey validated: ${account.toString()}`);
    } catch (err) {
      logger.error(`Invalid account public key: ${body.account}`);
      throw new GenericError(
        "Invalid account public key",
        StatusCodes.BAD_REQUEST,
      );
    }

    // Initialize connection and transaction
    const { connection } = await initWeb3(clusterurl);

    const recipientAddr = ONCHAIN_CONFIG[clusterurl].treasuryWallet;
    const recipientPublicKey = new PublicKey(recipientAddr);
    const createTx: ICreateTransaction = {
      accountPublicKey: account,
      recipientPublicKey,
      currency: VERIFIED_CURRENCY.SOL,
      amount: 0.000000001,
      connection,
      cluster: clusterurl,
    };
    const tx = await createTransaction(createTx);

    const { blockhash } = await connection.getLatestBlockhash();
    logger.info("Blockhash: %s", blockhash);

    // Create the transaction and set the user as the payer
    const transaction = new web3.Transaction({
      recentBlockhash: blockhash,
      feePayer: account, // User's wallet pays the fee
    }).add(...tx);

    // const href = `/api/actions/create-challenge/next-action?clusterurl=${clusterurl}&participationtype=${participationtype}&name=${name}&token=${token}&wager=${wager}&target=${target}&startDate=${startDate}&endDate=${endDate}`;
    const href = `/api/actions/create-challenge/next-action?clusterurl=${clusterurl}&participationtype=${participationtype}&name=${name}&token=${token}&wager=${wager}&startDate=${startDate}&endDate=${endDate}`;
    logger.info(`Sending next action for create challenge blinks at: ${href}`);

    // Create response payload
    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        type: "transaction",
        transaction,
        message: "Create Catoff Challenge",
        links: {
          next: {
            type: "post",
            href,
          },
        },
      },
    });
    logger.info("Response payload created successfully");

    return jsonResponse(payload, StatusCodes.OK, headers);
  } catch (err) {
    logger.error("An error occurred in POST handler:", err);
    let actionError: ActionError = { message: "An unknown error occurred" };
    if (typeof err === "string") actionError.message = err;
    else if (err instanceof GenericError) actionError.message = err.message;

    return jsonResponse(actionError, StatusCodes.BAD_REQUEST, headers);
  }
};
