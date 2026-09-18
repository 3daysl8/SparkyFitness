import { apiCall } from './api';

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
