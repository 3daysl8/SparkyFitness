export const generalKeys = {
  announcement: ['announcement'] as const,
  githubStars: (owner: string, repo: string) =>
    ['github', owner, repo, 'stars'] as const,
};
