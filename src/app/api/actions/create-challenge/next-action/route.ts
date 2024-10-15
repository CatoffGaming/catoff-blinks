import {
  createActionHeaders,
  NextActionPostRequest,
  ActionError,
  CompletedAction,
} from "@solana/actions";
import { PublicKey } from "@solana/web3.js";

import {
  Challenge,
  CHALLENGE_CATEGORIES,
  CLUSTER_TYPES,
  GAME_TYPE,
  getGameID,
  ICreateChallenge,
  PARTICIPATION_TYPE,
  VERIFIED_CURRENCY,
} from "@/common/types";
import logger from "@/common/logger";
import { getRequestParam } from "@/common/helper/getParams";
import { GenericError } from "@/common/helper/error";
import { IGenerateAIDescription } from "@/common/utils/apiReturn.types";
import {
  createChallenge,
  generateAIDescription,
} from "@/common/utils/api.util";
import { StatusCodes } from "http-status-codes";
import { jsonResponse, Promisify } from "@/common/helper/responseMaker";

// create the standard headers for this route (including CORS)
const headers = createActionHeaders();

export const GET = async (req: Request) => {
  return Response.json({ message: "Method not supported" } as ActionError, {
    status: 403,
    headers,
  });
};
export const OPTIONS = async () => Response.json(null, { headers });

export const POST = async (req: Request) => {
  try {
    const requestUrl = new URL(req.url);
    const clusterurl = getRequestParam<CLUSTER_TYPES>(requestUrl, "clusterurl");
    const participationtype = getRequestParam<PARTICIPATION_TYPE>(
      requestUrl,
      "participationtype",
    );
    const name = getRequestParam<string>(requestUrl, "name");
    const token = getRequestParam<VERIFIED_CURRENCY>(requestUrl, "token");
    const wager = getRequestParam<number>(requestUrl, "wager");
    // const target = getRequestParam<number>(requestUrl, "target");
    const startDate = getRequestParam<number>(requestUrl, "startDate");
    const endDate = getRequestParam<number>(requestUrl, "endDate");

    const body: NextActionPostRequest = await req.json();
    let account: PublicKey;
    try {
      account = new PublicKey(body.account);
    } catch {
      throw new GenericError(
        "Invalid account provided",
        StatusCodes.BAD_REQUEST,
      );
    }

    const { description } = await Promisify<IGenerateAIDescription>(
      generateAIDescription(name, participationtype),
    );

    const gameId = getGameID(participationtype, GAME_TYPE.VALIDATOR);
    if (!gameId) {
      throw new GenericError(
        `Invalid gameId with ParticipationType: ${participationtype} and GameType: ${GAME_TYPE.VALIDATOR}`,
        StatusCodes.BAD_REQUEST,
      );
    }

    const createChallengeJson: ICreateChallenge = {
      ChallengeName: name,
      ChallengeDescription: description,
      StartDate: startDate,
      EndDate: endDate,
      GameID: gameId,
      Wager: wager,
      Target: 0,
      AllowSideBets: true,
      SideBetsWager: wager / 10,
      Unit: "units",
      IsPrivate: false,
      Currency: token,
      ChallengeCategory: CHALLENGE_CATEGORIES.SOCIAL_MEDIA,
      UserAddress: account.toString(),
    };
    const challenge = await Promisify<Challenge>(
      createChallenge(clusterurl, createChallengeJson),
    );
    const basicUrl =
      process.env.IS_PROD === "prod"
        ? "https://join.catoff.xyz"
        : new URL(req.url).origin;
    const icons = {
      dare: new URL("/dare.png", basicUrl).toString(),
      peer: new URL("/peer.png", basicUrl).toString(),
      multi: new URL("/multi.png", basicUrl).toString(),
    };

    //TODO: fix this url
    const message = `Your challenge has been created successfully!\nJoin with blink: https://dial.to/?action=solana-action:https://join.catoff.xyz/api/actions/join-challenge?clusterurl=${clusterurl}&challengeID=${challenge.ChallengeID}\nOpen Catoff App: https://game.catoff.xyz/challenge/${challenge.ChallengeID}`;
    logger.info(`[Create challenge next action] final response: ${message}`);
    const payload: CompletedAction = {
      type: "completed",
      title: "Your challenge has been created successfully!",
      icon:
        participationtype === 0
          ? icons.dare
          : participationtype === 1
          ? icons.peer
          : icons.multi,
      label: "Catoff Challenge Created",
      description: message,
    };

    return jsonResponse(payload, StatusCodes.OK, headers);
  } catch (err) {
    logger.error(err);
    let actionError: ActionError = { message: "An unknown error occurred" };
    if (typeof err == "string") actionError.message = err;
    return jsonResponse(actionError, StatusCodes.BAD_REQUEST, headers);
  }
};
