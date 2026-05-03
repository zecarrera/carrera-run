export type ActivityType = "Run" | "Strength" | "Flexibility";
export type VideoRole = "warm-up" | "cool-down" | "general";

export interface VideoRecommendation {
  videoId: string;
  title: string;
  channelName: string;
  role: VideoRole;
}

interface CuratedVideo extends VideoRecommendation {
  /** Estimated video duration in minutes — used for duration-aware selection. */
  durationMinutes: number;
}

/** Static curated list used as fallback when YOUTUBE_API_KEY is not set. */
const CURATED_VIDEOS: CuratedVideo[] = [
  // ── Run warm-ups ──────────────────────────────────────────────────────────
  {
    videoId: "bXhpzCGJSbc",
    title: "10-Minute Pre-Run Warm Up Routine",
    channelName: "The Run Experience",
    role: "warm-up",
    durationMinutes: 10,
  },
  {
    videoId: "taFBHDz0Cjk",
    title: "5-Minute Dynamic Warm Up Before Running",
    channelName: "Sage Running",
    role: "warm-up",
    durationMinutes: 5,
  },
  {
    videoId: "V0rR9Gi8D8I",
    title: "Pre-Run Warm Up | Dynamic Stretches for Runners",
    channelName: "James Dunne",
    role: "warm-up",
    durationMinutes: 8,
  },

  // ── Run cool-downs ────────────────────────────────────────────────────────
  {
    videoId: "5-tDBcMIkD8",
    title: "Post-Run Cool Down & Stretching Routine",
    channelName: "The Run Experience",
    role: "cool-down",
    durationMinutes: 15,
  },
  {
    videoId: "d_oHRhBHiOM",
    title: "10-Minute Post-Run Stretching Routine",
    channelName: "Sage Running",
    role: "cool-down",
    durationMinutes: 10,
  },
  {
    videoId: "R29M4SsoB4A",
    title: "Cool Down Stretches for Runners",
    channelName: "James Dunne",
    role: "cool-down",
    durationMinutes: 8,
  },

  // ── Strength ──────────────────────────────────────────────────────────────
  {
    videoId: "lmxFv8fS0Ow",
    title: "Strength Training for Runners — Full Routine",
    channelName: "Strength Running",
    role: "general",
    durationMinutes: 25,
  },
  {
    videoId: "8rQcUVQhq-4",
    title: "Runner-Specific Strength Workout",
    channelName: "The Run Experience",
    role: "general",
    durationMinutes: 20,
  },
  {
    videoId: "P-kxBRlxqhA",
    title: "Strength Exercises Every Runner Should Do",
    channelName: "James Dunne",
    role: "general",
    durationMinutes: 15,
  },

  // ── Flexibility ───────────────────────────────────────────────────────────
  {
    videoId: "L_xrDAtykMI",
    title: "Yoga for Runners — Full Flexibility Routine",
    channelName: "Yoga With Adriene",
    role: "general",
    durationMinutes: 30,
  },
  {
    videoId: "sTANio_2E0Q",
    title: "Hip Flexor Stretches for Runners",
    channelName: "James Dunne",
    role: "general",
    durationMinutes: 10,
  },
  {
    videoId: "7m9TUm5dn0k",
    title: "Flexibility Routine to Improve Running Form",
    channelName: "Sage Running",
    role: "general",
    durationMinutes: 15,
  },
];

/** Keywords used when calling the YouTube Data API v3 for each type + role. */
const YOUTUBE_QUERIES: Record<ActivityType, Record<VideoRole, string>> = {
  Run: {
    "warm-up": "pre-run warm up routine for runners",
    "cool-down": "post-run cool down stretching routine",
    general: "running training tips",
  },
  Strength: {
    "warm-up": "warm up strength training runners",
    "cool-down": "cool down after strength training runners",
    general: "strength training for runners workout",
  },
  Flexibility: {
    "warm-up": "warm up flexibility routine",
    "cool-down": "cool down flexibility stretching",
    general: "flexibility stretching routine for runners",
  },
};

/** Maps an activity duration to YouTube's videoDuration filter bucket. */
function toYouTubeDurationFilter(
  durationMinutes: number | undefined,
  defaultFilter: "short" | "medium" | "long" = "medium",
): "short" | "medium" | "long" {
  if (durationMinutes === undefined) return defaultFilter;
  if (durationMinutes <= 4) return "short";
  if (durationMinutes <= 20) return "medium";
  return "long";
}

/** Fisher-Yates shuffle — returns a new shuffled copy of the array. */
function shuffled<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface YouTubeApiItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
  };
}

interface YouTubeApiResponse {
  items?: YouTubeApiItem[];
  error?: { message?: string };
}

async function searchYouTube(
  query: string,
  channelFilter?: string,
  videoDuration?: "short" | "medium" | "long",
  excludeIds: string[] = [],
): Promise<VideoRecommendation | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({
      part: "snippet",
      q: channelFilter ? `${query} ${channelFilter}` : query,
      type: "video",
      maxResults: "10",
      key: apiKey,
      ...(videoDuration ? { videoDuration } : {}),
    });

    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
    if (!response.ok) return null;

    const data = (await response.json()) as YouTubeApiResponse;
    const items = data.items ?? [];

    // Pick the first result not already shown to the user.
    const item = excludeIds.length > 0
      ? items.find((i) => i.id?.videoId && !excludeIds.includes(i.id.videoId) && i.snippet?.title)
      : items[0];

    if (!item?.id?.videoId || !item.snippet?.title) return null;

    return {
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelName: item.snippet.channelTitle ?? channelFilter ?? "YouTube",
      role: "general",
    };
  } catch {
    return null;
  }
}

function pickFromCurated(
  activityType: ActivityType,
  role: VideoRole,
  preferredChannels: string[],
  allowOtherChannels: boolean,
  activityDurationMinutes?: number,
  excludeIds: string[] = [],
): VideoRecommendation | null {
  const candidates = CURATED_VIDEOS.filter(
    (v) => (activityType === "Run" ? v.role === role : v.role === "general") && !excludeIds.includes(v.videoId),
  );

  // Helper: pick the candidate closest in duration, breaking ties randomly.
  const pickClosest = (pool: CuratedVideo[]): CuratedVideo => {
    if (activityDurationMinutes === undefined || activityType === "Run") {
      return pool[Math.floor(Math.random() * pool.length)];
    }
    const minDiff = Math.min(...pool.map((v) => Math.abs(v.durationMinutes - activityDurationMinutes)));
    const closest = pool.filter((v) => Math.abs(v.durationMinutes - activityDurationMinutes) === minDiff);
    return closest[Math.floor(Math.random() * closest.length)];
  };

  if (preferredChannels.length > 0) {
    const normalised = preferredChannels.map((c) => c.toLowerCase());
    const preferred = candidates.filter((v) =>
      normalised.some((ch) => v.channelName.toLowerCase().includes(ch)),
    );
    if (preferred.length > 0) return pickClosest(preferred);
    if (!allowOtherChannels) return null;
  }

  return candidates.length > 0 ? pickClosest(candidates) : null;
}

/**
 * Counts how many more unique recommendations remain in the curated list per role,
 * after the given set of video IDs have already been shown.
 */
function computeRemainingByRole(activityType: ActivityType, excludeIds: string[]): Record<string, number> {
  if (activityType === "Run") {
    return {
      "warm-up": CURATED_VIDEOS.filter((v) => v.role === "warm-up" && !excludeIds.includes(v.videoId)).length,
      "cool-down": CURATED_VIDEOS.filter((v) => v.role === "cool-down" && !excludeIds.includes(v.videoId)).length,
    };
  }
  return {
    general: CURATED_VIDEOS.filter((v) => v.role === "general" && !excludeIds.includes(v.videoId)).length,
  };
}

export interface VideoRecommendationsResult {
  recommendations: VideoRecommendation[];
  /**
   * Per-role count of remaining unique recommendations in the curated list.
   * null = unlimited (YouTube API is active).
   */
  remainingByRole: Record<string, number> | null;
}

/**
 * Returns video recommendations for a given activity type.
 * - Run: returns up to 2 items — [warm-up, cool-down]
 * - Strength / Flexibility: returns 1 item
 *
 * Strategy (per recommendation slot):
 * 1. If YOUTUBE_API_KEY is set, search YouTube filtered by a randomly chosen
 *    preferred channel (channels are shuffled per request for variety).
 * 2. Fall back to the static curated list, picking the video closest in
 *    duration to the planned activity (random among ties).
 */
export async function getVideoRecommendations(
  activityType: ActivityType,
  preferredChannels: string[],
  allowOtherChannels: boolean,
  activityDurationMinutes?: number,
  excludeIds: string[] = [],
  roleFilter?: VideoRole,
): Promise<VideoRecommendationsResult> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  // Shuffle channels once per request so each call may try a different channel first.
  const channels = shuffled(preferredChannels);

  if (activityType === "Run") {
    // If a specific role is requested, only process that one; otherwise process both.
    const roles: VideoRole[] = roleFilter ? [roleFilter] : ["warm-up", "cool-down"];
    const results: VideoRecommendation[] = [];

    for (const role of roles) {
      let video: VideoRecommendation | null = null;

      if (apiKey) {
        const query = YOUTUBE_QUERIES.Run[role];
        // Run warm-up/cool-down videos are always short-to-medium length regardless of run distance.
        const durationFilter = toYouTubeDurationFilter(undefined, "medium");
        if (channels.length > 0) {
          for (const channel of channels) {
            video = await searchYouTube(query, channel, durationFilter, excludeIds);
            if (video) {
              video.role = role;
              video.channelName = channel;
              break;
            }
          }
          if (!video && allowOtherChannels) {
            video = await searchYouTube(query, undefined, durationFilter, excludeIds);
            if (video) video.role = role;
          }
        } else {
          video = await searchYouTube(query, undefined, durationFilter, excludeIds);
          if (video) video.role = role;
        }
      }

      if (!video) {
        video = pickFromCurated("Run", role, preferredChannels, allowOtherChannels, undefined, excludeIds);
      }

      if (video) results.push(video);
    }

    const allExcluded = [...excludeIds, ...results.map((v) => v.videoId)];
    const remainingByRole = apiKey ? null : computeRemainingByRole("Run", allExcluded);

    return { recommendations: results, remainingByRole };
  }

  // Strength / Flexibility — one general video
  let video: VideoRecommendation | null = null;

  if (apiKey) {
    const query = YOUTUBE_QUERIES[activityType].general;
    const durationFilter = toYouTubeDurationFilter(activityDurationMinutes);
    if (channels.length > 0) {
      for (const channel of channels) {
        video = await searchYouTube(query, channel, durationFilter, excludeIds);
        if (video) {
          video.role = "general";
          video.channelName = channel;
          break;
        }
      }
      if (!video && allowOtherChannels) {
        video = await searchYouTube(query, undefined, durationFilter, excludeIds);
        if (video) video.role = "general";
      }
    } else {
      video = await searchYouTube(query, undefined, durationFilter, excludeIds);
      if (video) video.role = "general";
    }
  }

  if (!video) {
    video = pickFromCurated(activityType, "general", preferredChannels, allowOtherChannels, activityDurationMinutes, excludeIds);
  }

  const recommendations = video ? [video] : [];
  const allExcluded = [...excludeIds, ...recommendations.map((v) => v.videoId)];
  const remainingByRole = apiKey ? null : computeRemainingByRole(activityType, allExcluded);

  return { recommendations, remainingByRole };
}
