import { getLatestAnnouncement } from '@/api/general';
import { generalKeys } from '@/api/keys/general';
import { useQuery } from '@tanstack/react-query';

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
