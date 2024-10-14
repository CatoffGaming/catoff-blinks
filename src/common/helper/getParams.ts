import { GenericError } from "./error";
import logger from "../logger";
import { StatusCodes } from "http-status-codes";

export function getRequestParam<T>(
  requestUrl: URL,
  param: string,
  required: boolean = true,
  validValues?: T[],
  defaultValue?: T,
): T {
  let value = requestUrl.searchParams.get(param);

  // Use default if parameter not provided
  if (value === null && defaultValue !== undefined) {
    logger.info(
      `[getRequestParam] Parameter "${param}" not provided, using default value: ${defaultValue}`,
    );
    return defaultValue;
  }

  // Error if required parameter is missing
  if (required && value === null) {
    logger.error(`[getRequestParam] Missing required parameter: "${param}"`);
    throw new GenericError(
      `Missing required parameter: ${param}`,
      StatusCodes.BAD_REQUEST,
    );
  }

  // Type conversion based on the inferred type of T or parameter content
  let finalValue: T;
  if (
    typeof defaultValue === "number" ||
    (validValues && typeof validValues[0] === "number") ||
    !isNaN(Number(value))
  ) {
    const numValue = Number(value);
    if (isNaN(numValue)) {
      logger.error(
        `[getRequestParam] Parameter "${param}" is not a valid number`,
      );
      throw new GenericError(
        `Parameter "${param}" must be a valid number`,
        StatusCodes.BAD_REQUEST,
      );
    }
    finalValue = numValue as T;
  } else if (
    typeof defaultValue === "boolean" ||
    (validValues && typeof validValues[0] === "boolean")
  ) {
    finalValue = (value === "true") as T;
  } else {
    finalValue = value as T;
  }

  // Validate against validValues if specified
  if (validValues && !validValues.includes(finalValue)) {
    logger.error(
      `[getRequestParam] Invalid value for parameter: "${param}". Received: ${finalValue}. Expected one of: ${validValues.join(
        ", ",
      )}`,
    );
    throw new GenericError(
      `Invalid value for parameter: ${param}. Expected one of: ${validValues.join(
        ", ",
      )}`,
      StatusCodes.BAD_REQUEST,
    );
  }

  // Log and return the retrieved or converted value
  logger.info(
    `[getRequestParam] Retrieved parameter "${param}": ${finalValue}`,
  );
  return finalValue;
}

export const validateParameters = (
  paramName: any,
  condition: any,
  errorMsg: any,
) => {
  if (!condition) {
    logger.error(`[${paramName}] ${errorMsg}`);
    throw new GenericError(
      `[${paramName}] ${errorMsg}`,
      StatusCodes.BAD_REQUEST,
    );
  }
};
