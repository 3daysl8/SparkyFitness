import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Database } from 'lucide-react';
import AddExternalProviderForm from './AddExternalProviderForm';
import ExternalProviderList from './ExternalProviderList';
import GarminConnectSettings from './GarminConnectSettings';

export interface ExternalDataProvider {
  id: string;
  provider_name: string;
  provider_type: string;
  app_id: string | null;
  app_key: string | null;
  yazio_client_id?: string | null;
  yazio_client_secret?: string | null;
  is_active: boolean;
  availability_error?: string;
  base_url: string | null;
  user_id?: string;
  visibility: 'private' | 'public' | 'family';
  is_public?: boolean;
  is_strictly_private?: boolean;
  categories?: string[];
  required_fields?: string[];
  field_labels?: Record<string, string>;
  last_sync_at?: string;
  sync_frequency?: 'hourly' | 'daily' | 'manual';
  has_token?: boolean;
  garmin_connect_status?: 'linked' | 'connected' | 'disconnected';
  garmin_last_status_check?: string | null;
  garmin_token_expires?: string | null;
  withings_last_sync_at?: string | null;
  withings_token_expires?: string | null;
  fitbit_last_sync_at?: string | null;
  fitbit_token_expires?: string | null;
  oura_last_sync_at?: string | null;
  oura_token_expires?: string | null;
  polar_last_sync_at?: string | null;
  polar_token_expires?: string | null;
  hevy_last_sync_at?: string | null;
  hevy_connect_status?: 'connected' | 'disconnected';
  strava_last_sync_at?: string | null;
  strava_token_expires?: string | null;
  googlehealth_last_sync_at?: string | null;
  googlehealth_token_expires?: string | null;
  sort_order?: number;
  supports_barcode?: boolean;
}

const ExternalProviderSettings = () => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showGarminMfaInputFromAddForm, setShowGarminMfaInputFromAddForm] =
    useState(false);
  const [garminClientStateFromAddForm, setGarminClientStateFromAddForm] =
    useState<string | null>(null);

  const handleAddProviderSuccess = () => {
    setShowAddForm(false);
  };

  const handleGarminMfaRequiredFromAddForm = (clientState: string) => {
    setShowGarminMfaInputFromAddForm(true);
    setGarminClientStateFromAddForm(clientState);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Wearable & Fitness Data Providers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AddExternalProviderForm
            showAddForm={showAddForm}
            setShowAddForm={setShowAddForm}
            onAddSuccess={handleAddProviderSuccess}
            onGarminMfaRequired={handleGarminMfaRequiredFromAddForm}
          />

          {showGarminMfaInputFromAddForm && garminClientStateFromAddForm && (
            <GarminConnectSettings
              key={garminClientStateFromAddForm || 'default'}
              initialClientState={garminClientStateFromAddForm}
              onMfaComplete={() => {
                setShowGarminMfaInputFromAddForm(false);
                setGarminClientStateFromAddForm(null);
              }}
            />
          )}

          <ExternalProviderList showAddForm={showAddForm} />
        </CardContent>
      </Card>
    </div>
  );
};

export default ExternalProviderSettings;
