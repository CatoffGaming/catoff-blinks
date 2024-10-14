import { GenericError } from "./error"; 

const parseRelativeTime = (time: string): number => {
  const timeSegments = time.split(/[\s&-]/); // Split on whitespace, `&`, or `-`
  let totalMilliseconds = 0;

  timeSegments.forEach((segment) => {
    const matches = segment.match(/^(\d+)([smhd])$/);
    if (!matches) {
      throw new GenericError(`Invalid time format for segment: ${segment}`, 400);
    }

    const value = parseInt(matches[1], 10);
    const unit = matches[2];

    let segmentMilliseconds = 0;
    switch (unit) {
      case "s":
        segmentMilliseconds = value * 1000; // seconds to milliseconds
        break;
      case "m":
        segmentMilliseconds = value * 60 * 1000; // minutes to milliseconds
        break;
      case "h":
        segmentMilliseconds = value * 60 * 60 * 1000; // hours to milliseconds
        break;
      case "d":
        segmentMilliseconds = value * 24 * 60 * 60 * 1000; // days to milliseconds
        break;
      default:
        throw new GenericError(`Invalid time unit: ${unit}`, 400);
    }

    totalMilliseconds += segmentMilliseconds;
  });

  return totalMilliseconds;
};

export const calculateTimeRange = (
  startTime: string,
  duration: string,
): { startDate: number; endDate: number } => {
  let startDate: number;

  // Check if startTime is a relative time (e.g., "5h&5m")
  if (/^(\d+[smhd][\s&-]?)+$/.test(startTime)) {
    // If startTime is relative, calculate it from the current time
    startDate = Date.now() + parseRelativeTime(startTime);
  } else {
    // Otherwise, parse it as an absolute date
    startDate = Date.parse(startTime);
    if (isNaN(startDate)) {
      throw new GenericError("Invalid start time format", 400);
    }
  }

  // Parse duration as a relative time
  const durationInMs = parseRelativeTime(duration);
  const endDate = startDate + durationInMs;

  return { startDate, endDate };
};
