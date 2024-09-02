import axios from "axios";

export function Responsify<T>(
  req: Promise<ApiResponse<T>>,
  panic: boolean = false
): Promise<T | ApiResponse<T>> {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await req;

      if (!response.success) {
        if (panic) {
          // Throw an error if panic is true and success is false
          reject(new Error(response.message));
        } else {
          // Return the entire response body if success is false and panic is false
          resolve(response);
        }
      } else {
        // If success is true, return the data
        resolve(response.data);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Handle Axios errors
        reject(error);
      } else {
        // Handle unexpected errors
        reject(new Error("Unexpected error occurred."));
      }
    }
  });
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export enum CHALLENGE_STATE {
  UPCOMING = "UPCOMING",
  ONGOING = "ONGOING",
  PROCESSING = "PROCESSING",
  PAYINGOUT = "PAYINGOUT",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  NO_WINNER = "NO_WINNER",
  NO_WINNER_PAYINGOUT = "NO_WINNER_PAYINGOUT",
  CANCELLED_PAYINGOUT = "CANCELLED_PAYINGOUT",
}

export enum ONCHAIN_STATE {
  TO_BE_MINTED = "TO_BE_MINTED",
  MINTED = "MINTED",
  UPDATED = "UPDATED",
  TRANSFERRED = "TRANSFERRED",
  CANCELLED = "CANCELLED",
  NO_WINNER = "NO_WINNER",
}

export enum VERIFIED_CURRENCY {
  CREDITS = "CREDITS",
  USDC = "USDC",
  SOL = "SOL",
  BONK = "BONK",
  SEND = "SEND",
}

export enum CHALLENGE_CATEGORIES {
  FITNESS = "Fitness",
  ART = "Art",
  TRAVEL = "Travel",
  ADVENTURE = "Adventure",
  LIFESTYLE = "Lifestyle",
  GAMING = "Gaming",
  SPORTS = "Sports",
  SOCIAL_MEDIA = "Social Media",
  EVENT = "Event",
  RANDOM = "Random",
}

export enum PARTICIPATION_TYPE {
  ZERO_VS_ONE = 0,
  ONE_VS_ONE = 1,
  NVN = 2,
}

export enum GAME_TYPE {
  STEPS = 0,
  CALORIES = 1,
  DIGITAL_PROOF = 2,
  VALIDATOR = 3,
  VOTING = 4,
}

export enum ParticipationTypeMultiToken {
  SIDE_BET = "SideBet",
  JOIN_CHALLENGE = "JoinChallenge",
}

export enum NotificationMedium {
  APP_NOTIF = "APP_NOTIF",
  PUSH_NOTIF = "PUSH_NOTIF",
  EMAIL = "EMAIL",
}

export enum NOTIFICATION_TYPE {
  SIGNUP = "SIGNUP",
  CHALLENGE_CREATED = "CHALLENGE_CREATED",
  CHALLENGE_JOINED_SELF = "CHALLENGE_JOINED_SELF",
  CHALLENGE_JOINED_PLAYER = "CHALLENGE_JOINED_PLAYER",
  CHALLENGE_JOINED_CREATOR = "CHALLENGE_JOINED_CREATOR",
  CHALLENGE_MAX_PARTICIPATION_REACHED_CREATOR = "CHALLENGE_MAX_PARTICIPATION_REACHED_CREATOR",
  CHALLENGE_MAX_PARTICIPATION_REACHED_PLAYER = "CHALLENGE_MAX_PARTICIPATION_REACHED_PLAYER",
  CHALLENGE_CANCELLED_SELF = "CHALLENGE_CANCELLED_SELF",
  CHALLENGE_CANCELLED_PLAYER = "CHALLENGE_CANCELLED_PLAYER",
  CHALLENGE_STARTED_SELF = "CHALLENGE_STARTED_SELF",
  CHALLENGE_STARTED_PLAYER = "CHALLENGE_STARTED_PLAYER",
  CHALLENGE_ENDED_SELF = "CHALLENGE_ENDED_SELF",
  CHALLENGE_ENDED_PLAYER = "CHALLENGE_ENDED_PLAYER",
  CHALLENGE_SETTLED_WITH_NO_WINNER = "CHALLENGE_SETTLED_WITH_NO_WINNER",
  CHALLENGE_SETTLED_WITH_NO_WINNER_CREATOR = "CHALLENGE_SETTLED_WITH_NO_WINNER_CREATOR",
  CHALLENGE_SETTLED_WITH_WINNER_SELF = "CHALLENGE_SETTLED_WITH_WINNER_SELF",
  CHALLENGE_SETTLED_WITH_WINNER_CREATOR = "CHALLENGE_SETTLED_WITH_WINNER_CREATOR",
  CHALLENGE_SETTLED_WITH_WINNER = "CHALLENGE_SETTLED_WITH_WINNER",
  WITHDRAW_REQUEST = "WITHDRAW_REQUEST",
  WITHDRAW_SUCCESS = "WITHDRAW_SUCCESS",
  WITHDRAW_FAILED = "WITHDRAW_FAILED",
  DEPOSIT_REQUEST = "DEPOSIT_REQUEST",
  DEPOSIT_SUCCESS = "DEPOSTI_SUCCESS",
  DEPOSIT_FAILED = "DEPOSIT_FAILED",
}

export enum GENDER {
  MALE = "male",
  FEMALE = "female",
  OTHER = "others",
  UNKNOWN = "unknown",
}

export enum WALLET_TYPES {
  OKTO = "OKTO",
  EXTERNAL = "EXTERNAL",
}

export enum AdditionalNotificationType {
  OKTO = "OKTO",
}

export enum REFUND_STATE {
  NOT_ELIGIBLE = "NOT_ELIGIBLE",
  ELIGIBLE = "ELIGIBLE",
  REFUND_PROCESSING = "REFUND_PROCESSING",
  REFUNDED = "REFUNDED",
}

export enum WITHDRAW_STATE {
  CREATE = "CREATE",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
}

export interface Challenge {
  ChallengeID: number;
  ChallengeName: string;
  ChallengeDescription: string;
  ChallengeCreator: User;
  ChallengePublicKey: string | null;
  StartDate: number | null;
  EndDate: number | null;
  Game: Game;
  State: CHALLENGE_STATE;
  PaymentProcessed: boolean;
  Winners: Player[];
  MaxParticipants: number;
  Players: PlayerWithDetails[];
  Media: string | null;
  NFTMedia: string | null;
  Wager: number;
  Target: number | null;
  Unit: string | null;
  Category: CHALLENGE_CATEGORIES | null;
  Notifications: Notification[];
  AllowSideBets: boolean;
  SideBetsWager: number;
  Slug: string | null;
  IsPrivate: boolean;
  AssetAddresses: string[];
  OnChainState: ONCHAIN_STATE;
  Currency: VERIFIED_CURRENCY;
  createdAt: string;
  updatedAt: string;
}

export interface Game {
  GameID: number;
  GameName: string;
  ParticipationType: PARTICIPATION_TYPE | null;
  GameType: GAME_TYPE;
  GameDescription: string;
  Challenges: Challenge[];
  createdAt: string;
  updatedAt: string;
}

export interface Player {
  PlayerID: number;
  Submission: Submission | null;
  User: User;
  Challenge: Challenge;
  WinningChallenge: Challenge | null;
  Value: number | null;
  Device: string | null;
  DeviceDataSource: string | null;
  PlayerPublicKey: string | null;
  VariableDescription: string | null;
  IsActive: boolean | null;
  Betters: Better[];
  TxHash: string | null;
  IsOnChainVerified: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerWithDetails extends Player {
  rank: number;
  pastChallengesWon: number;
  pastChallengesLost: number;
  bio: string | null;
}

export interface User {
  UserID: number;
  Email: string | null;
  UserName: string | null;
  Wallets: Wallet[];
  WalletAddress: string | null;
  Bio: string | null;
  Tag: string | null;
  Credits: number;
  InvestedCredits: number | null;
  ProfilePicture: string | null;
  CoverHexCode: string | null;
  Gender: GENDER | null;
  Transactions: Transaction[];
  SentTransactions: Transaction[];
  UserConfig: UserConfig | null;
  CreatedChallenges: Challenge[];
  Players: Player[];
  WithdrawRequests: WithdrawRequest[];
  DepositRequests: DepositRequest[];
  Notifications: Notification[];
  VotedSubmissions: Submission[];
  Betters: Better[];
  createdAt: string;
  updatedAt: string;
}

export interface Better {
  ID: number;
  Player: Player;
  User: User;
  IsOnChainVerified: boolean | null;
  TxHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Submission {
  ID: number;
  MediaUrls: string[];
  IsValid: boolean;
  Player: Player;
  Voters: User[];
  VotedWallets: string[];
  NumberOfVotes: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  ID: number;
  Title: string | null;
  Description: string | null;
  Type: NOTIFICATION_TYPE;
  Challenge: Challenge | null;
  User: User | null;
  WithdrawRequest: WithdrawRequest | null;
  DepositRequest: DepositRequest | null;
  MediaUrl: string | null;
  IsRead: boolean;
  createdAt: string;
}

export interface Wallet {
  ID: number;
  PublicKey: string;
  Type: WALLET_TYPES;
  AirDrop: AirDrop;
  User: User;
  createdAt: string;
  updatedAt: string;
}

export interface AirDrop {
  sendTx: string;
  usdcTx: string;
  bonkTx: string;
}

export interface WithdrawRequest {
  ID: number;
  User: User;
  Amount: number;
  Currency: string;
  JobID: number | null;
  Status: WITHDRAW_STATE;
  TxHash: string | null;
  FailureReason: string | null;
  Notifications: Notification[];
  createdAt: string;
  updatedAt: string;
}

export interface DepositRequest {
  ID: number;
  User: User;
  Amount: number;
  Currency: string;
  JobID: string | null;
  Status: string;
  TxHash: string | null;
  FailureReason: string | null;
  Notifications: Notification[];
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  TxID: number;
  TxHash: string | null;
  ToUser: User | null;
  FromUser: User | null;
  TokenAmount: string | null;
  Token: string | null;
  CreditAmount: number | null;
  Description: string | null;
  RefundState: REFUND_STATE;
  FailureReason: string | null;
  Timestamp: number;
}

export interface UserConfig {
  ID: number;
  User: User;
  PlatformRefreshToken: string | null;
  GoogleRefreshToken: string | null;
  OktoRefreshToken: string | null;
  OktoDeviceToken: string | null;
  OktoAuthToken: string | null;
  IdToken: string | null;
  Devices: string[];
  DataStreams: string[];
  DefaultDevice: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  UserID: number;
  Email: string | null;
  UserName: string | null;
  Wallets: Wallet[];
  WalletAddress: string | null;
  Bio: string | null;
  Tag: string | null;
  Credits: number;
  InvestedCredits: number | null;
  ProfilePicture: string | null;
  CoverHexCode: string | null;
  Gender: GENDER | null;
  Transactions: Transaction[];
  SentTransactions: Transaction[];
  UserConfig: UserConfig | null;
  CreatedChallenges: Challenge[];
  Players: Player[];
  WithdrawRequests: WithdrawRequest[];
  DepositRequests: DepositRequest[];
  Notifications: Notification[];
  VotedSubmissions: Submission[];
  Betters: Better[];
  createdAt: string;
  updatedAt: string;
}

export interface IChallengeById {
  ChallengeID: number;
  ChallengeName: string;
  ChallengeDescription: string;
  ChallengePublicKey: string | null;
  StartDate: number;
  EndDate: number;
  State: CHALLENGE_STATE;
  PaymentProcessed: boolean;
  MaxParticipants: number;
  Media: string | null;
  NFTMedia: string | null;
  Wager: number;
  Target: number;
  Unit: string | null;
  Category: CHALLENGE_CATEGORIES;
  AllowSideBets: boolean;
  SideBetsWager: number;
  Slug: string | null;
  IsPrivate: boolean;
  AssetAddresses: string[];
  OnChainState: ONCHAIN_STATE;
  Currency: VERIFIED_CURRENCY;
  ChallengeCreator: User;
  Game: Game;
  ChallengeWinner: User[];
  Players: PlayerWithDetails[];
}

export interface ICreateChallenge {
  ChallengeName: string;
  ChallengeDescription: string;
  StartDate: number;
  EndDate: number;
  GameID: number;
  Wager: number;
  Target: number;
  IsPrivate: boolean; //keep it always false
  Currency: VERIFIED_CURRENCY; //keep it VERIFIED_CURRENCY.SOL
  ChallengeCategory: CHALLENGE_CATEGORIES; //keep it CHALLENGE_CATEGORIES.SOCIAL_MEDIA
  NFTMedia: string; // create using ai -> ipfs
  Media: string; // baad mey
  UserAddress?: string;
}

export enum JOIN_CHALLENGE_METHOD {
  LINK = "LINK",
  SLUG = "SLUG",
  CHALLENGE_ID = "CHALLENGE_ID"
}