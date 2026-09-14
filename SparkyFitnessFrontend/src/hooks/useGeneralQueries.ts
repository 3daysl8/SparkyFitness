import { getGitHubRepo, getLatestAnnouncement } from '@/api/general';
import { generalKeys } from '@/api/keys/general';
import { useQuery } from '@tanstack/react-query';

interface CachedStarData {
  count: number;
}

const getCacheKey = (owner: string, repo: string) =>
  `github-stars-${owner}-${repo}`;

export const useGitHubStarsQuery = (owner: string, repo: string) => {
  return useQuery<number, Error>({
    queryKey: generalKeys.githubStars(owner, repo),
    queryFn: async () => {
      const data = await getGitHubRepo(owner, repo);
      localStorage.setItem(
        getCacheKey(owner, repo),
        JSON.stringify({ count: data.stargazers_count })
      );
      return data.stargazers_count;
    },
    initialData: () => {
      const cached = localStorage.getItem(getCacheKey(owner, repo));
      if (cached) {
        try {
          const parsed: CachedStarData = JSON.parse(cached);
          return parsed.count;
        } catch (e) {
          return undefined;
        }
      }
      return undefined;
    },
    staleTime: 1000 * 60 * 60 * 24,
    enabled: Boolean(owner && repo),
  });
};

interface UseAnnouncementOptions {
  enabled: boolean;
}

export const useAnnouncementQuery = ({
  enabled = true,
}: UseAnnouncementOptions) => {
  return useQuery({
    queryKey: generalKeys.announcement,
    queryFn: getLatestAnnouncement,
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled,
  });
};
