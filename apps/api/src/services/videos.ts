export type ActivityType = "Run" | "Strength" | "Flexibility";
export type VideoRole = "warm-up" | "cool-down" | "general";

export interface VideoRecommendation {
  videoId: string;
  title: string;
  channelName: string;
  role: VideoRole;
}

/** Static curated list used as fallback when YOUTUBE_API_KEY is not set. */
const CURATED_VIDEOS: VideoRecommendation[] = [
  // ── Run warm-ups ──────────────────────────────────────────────────────────
  {
    videoId: "bXhpzCGJSbc",
    title: "10-Minute Pre-Run Warm Up Routine",
    channelName: "The Run Experience",
    role: "warm-up",
  },
  {
    videoId: "taFBHDz0Cjk",
    title: "5-Minute Dynamic Warm Up Before Running",
    channelName: "Sage Running",
    role: "warm-up",
  },
  {
    videoId: "V0rR9Gi8D8I",
    title: "Pre-Run Warm Up | Dynamic Stretches for Runners",
    channelName: "James Dunne",
    role: "warm-up",
  },

  // ── Run cool-downs ────────────────────────────────────────────────────────
  {
    videoId: "5-tDBcMIkD8",
    title: "Post-Run Cool Down & Stretching Routine",
    channelName: "The Run Experience",
    role: "cool-down",
  },
  {
    videoId: "d_oHRhBHiOM",
    title: "10-Minute Post-Run Stretching Routine",
    channelName: "Sage Running",
    role: "cool-down",
  },
  {
    videoId: "R29M4SsoB4A",
    title: "Cool Down Stretches for Runners",
    channelName: "James Dunne",
    role: "cool-down",
  },

  // ── Strength ──────────────────────────────────────────────────────────────
  {
    videoId: "lmxFv8fS0Ow",
    title: "Strength Training for Runners — Full Routine",
    channelName: "Strength Running",
    role: "general",
  },
  {
    videoId: "8rQcUVQhq-4",
    title: "Runner-Specific Strength Workout",
    channelName: "The Run Experience",
    role: "general",
  },
  {
    videoId: "P-kxBRlxqhA",
    title: "Strength Exercises Every Runner Should Do",
    channelName: "James Dunne",
    role: "general",
  },

  // ── Flexibility ───────────────────────────────────────────────────────────
  {
    videoId: "L_xrDAtykMI",
    title: "Yoga for Runners — Full Flexibility Routine",
    channelName: "Yoga With Adriene",
    role: "general",
  },
  {
    videoId: "sTANio_2E0Q",
    title: "Hip Flexor Stretches for Runners",
    channelName: "James Dunne",
    role: "general",
  },
  {
    videoId: "7m9TUm5dn0k",
    title: "Flexibility Routine to Improve Running Form",
    channelName: "Sage Running",
    role: "general",
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
): Promise<VideoRecommendation | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({
      part: "snippet",
      q: query,
      type: "video",
      maxResults: "5",
      key: apiKey,
      ...(channelFilter ? { q: `${query} ${channelFilter}` } : {}),
    });

    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
    if (!response.ok) return null;

    const data = (await response.json()) as YouTubeApiResponse;
    const item = data.items?.[0];

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
): VideoRecommendation | null {
  const candidates = CURATED_VIDEOS.filter((v) =>
    activityType === "Run" ? v.role === role : v.role === "general",
  );

  if (preferredChannels.length > 0) {
    const normalised = preferredChannels.map((c) => c.toLowerCase());
    const preferred = candidates.filter((v) =>
      normalised.some((ch) => v.channelName.toLowerCase().includes(ch)),
    );
    if (preferred.length > 0) return preferred[0];
    if (!allowOtherChannels) return null;
  }

  return candidates[0] ?? null;
}

/**
 * Returns video recommendations for a given activity type.
 * - Run: returns up to 2 items — [warm-up, cool-down]
 * - Strength / Flexibility: returns 1 item
 *
 * Strategy (per recommendation slot):
 * 1. If YOUTUBE_API_KEY is set, search YouTube filtered by preferred channels
 * 2. Fall back to the static curated list
 */
export async function getVideoRecommendations(
  activityType: ActivityType,
  preferredChannels: string[],
  allowOtherChannels: boolean,
): Promise<VideoRecommendation[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (activityType === "Run") {
    const roles: VideoRole[] = ["warm-up", "cool-down"];
    const results: VideoRecommendation[] = [];

    for (const role of roles) {
      let video: VideoRecommendation | null = null;

      if (apiKey) {
        const query = YOUTUBE_QUERIES.Run[role];
        if (preferredChannels.length > 0) {
          // Try each preferred channel
          for (const channel of preferredChannels) {
            video = await searchYouTube(query, channel);
            if (video) {
              video.role = role;
              video.channelName = channel;
              break;
            }
          }
          if (!video && allowOtherChannels) {
            video = await searchYouTube(query);
            if (video) video.role = role;
          }
        } else {
          video = await searchYouTube(query);
          if (video) video.role = role;
        }
      }

      if (!video) {
        video = pickFromCurated("Run", role, preferredChannels, allowOtherChannels);
      }

      if (video) results.push(video);
    }

    return results;
  }

  // Strength / Flexibility — one general video
  let video: VideoRecommendation | null = null;

  if (apiKey) {
    const query = YOUTUBE_QUERIES[activityType].general;
    if (preferredChannels.length > 0) {
      for (const channel of preferredChannels) {
        video = await searchYouTube(query, channel);
        if (video) {
          video.role = "general";
          video.channelName = channel;
          break;
        }
      }
      if (!video && allowOtherChannels) {
        video = await searchYouTube(query);
        if (video) video.role = "general";
      }
    } else {
      video = await searchYouTube(query);
      if (video) video.role = "general";
    }
  }

  if (!video) {
    video = pickFromCurated(activityType, "general", preferredChannels, allowOtherChannels);
  }

  return video ? [video] : [];
}
