import "express-session";
import type { StravaAthlete, StravaTokenSet } from "./strava.js";

declare module "express-session" {
  interface SessionData {
    strava?: {
      tokens: StravaTokenSet;
      athlete?: StravaAthlete;
    };
  }
}

export {};
