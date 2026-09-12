import path from 'path';
import dns from 'node:dns';
import net from 'node:net';
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
// records for outbound APIs (e.g. wger.de) without actually routing IPv6.
// dns.setDefaultResultOrder alone isn't enough: Node's Happy-Eyeballs
// (autoSelectFamily) still races the IPv4 and IPv6 candidates against each
// other with a short (~250ms) per-attempt timeout, and real round-trip
// latency to some outbound APIs exceeds that budget even on the address
// that actually works — so both attempts get abandoned even though an
// unraced connection succeeds fine within a second. Disabling the race
// entirely means Node just uses the first (now IPv4, thanks to the line
// above) resolved address with a normal connect timeout instead.
dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamily(false);

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
