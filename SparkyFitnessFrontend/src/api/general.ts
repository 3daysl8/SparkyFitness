import { apiCall } from './api';
export interface GitHubRepoResponse {
  stargazers_count: number;
}
export const getGitHubRepo = async (
  owner: string,
  repo: string
): Promise<GitHubRepoResponse> => {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status}`);
  }

  return response.json() as Promise<GitHubRepoResponse>;
};

export interface AnnouncementInfo {
  id: string;
  active: boolean;
  title: string;
  message: string;
  publishedAt?: string;
  htmlUrl?: string;
}

export const getLatestAnnouncement = async (): Promise<AnnouncementInfo> => {
  return apiCall('/announcement/current', {
    method: 'GET',
  });
};
