import type React from 'react';
import { debug } from '@/utils/logging';
import { useAuth } from '@/hooks/useAuth';
import { usePreferences } from '@/contexts/PreferencesContext';
import MainLayout from '@/layouts/MainLayout';

const Index: React.FC = () => {
  const { loading: authLoading } = useAuth();
  const { loggingLevel } = usePreferences();
  debug(loggingLevel, 'Index: Component rendered.');

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-xl text-white">Loading...</p>
      </div>
    );
  }

  return <MainLayout />;
};

export default Index;
