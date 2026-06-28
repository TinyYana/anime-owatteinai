import { api } from "./api";
import type { WatchSession } from "../../shared/types";

/**
 * One-tap "看完一集": logs a completed watch session. The server advances the
 * tracking row's currentEpisode on completion, so this is the 3-second update.
 */
export function markEpisodeWatched(
  animeId: string,
  episodeNumber: number,
  sourceLinkId?: string | null,
) {
  return api.post<WatchSession>("/api/my/watch-sessions", {
    animeId,
    episodeNumber,
    sourceLinkId: sourceLinkId ?? null,
    completed: true,
  });
}
