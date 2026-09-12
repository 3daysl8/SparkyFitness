export const generalKeys = {
  githubVersion: ['githubVersion'] as const,
  announcement: ['announcement'] as const,
  githubStars: (owner: string, repo: string) =>
    ['github', owner, repo, 'stars'] as const,
};
