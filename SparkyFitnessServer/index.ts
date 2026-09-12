import path from 'path';
import dns from 'node:dns';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { loadSecrets } from './utils/secretLoader.js';
import { runPreflightChecks } from './utils/preflightChecks.js';
import { configureOutboundProxy } from './utils/outboundProxy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../.env') });
loadSecrets();
configureOutboundProxy();

// Some hosts (this app's own Docker deployment included) advertise IPv6 DNS
// records for outbound APIs (e.g. wger.de) without actually routing IPv6,
// so an unqualified dns.lookup() can hand fetch()/undici an unreachable
// address and hang until timeout instead of falling back to IPv4. This is
// the Node-recommended fix, not a workaround specific to one provider.
dns.setDefaultResultOrder('ipv4first');

try {
  runPreflightChecks();
} catch (error) {
  console.error(
    'PreflightChecks failed due to missing environment variables.',
    error
  );
  // eslint-disable-next-line n/no-process-exit
  process.exit(1);
}

console.log('Starting server...');
try {
  await import('./SparkyFitnessServer.js');
} catch (error) {
  console.error('Failed to start the server module:', error);
  // eslint-disable-next-line n/no-process-exit
  process.exit(1);
}
