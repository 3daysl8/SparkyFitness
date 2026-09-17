import { describe, expect, it } from 'vitest';
import {
  getDynamicRpID,
  dynamicPasskey,
  PASSKEY_ERROR_CODES,
} from '../plugins/dynamicPasskey.js';

describe('dynamicPasskey plugin', () => {
  describe('getDynamicRpID', () => {
    it('extracts hostname from Origin header (Tailscale domain)', () => {
      const ctx = {
        headers: new Headers({
          origin: 'https://sparkyfitness.tail854f4e.ts.net',
        }),
      };
      expect(getDynamicRpID(ctx)).toBe('sparkyfitness.tail854f4e.ts.net');
    });

    it('extracts hostname from Origin header with custom port', () => {
      const ctx = {
        headers: new Headers({
          origin: 'http://100.103.152.66:3010',
        }),
      };
      expect(getDynamicRpID(ctx)).toBe('100.103.152.66');
    });

    it('extracts hostname from X-Forwarded-Host header', () => {
      const ctx = {
        headers: new Headers({
          'x-forwarded-host': 'sparkyfitness.tail854f4e.ts.net:8080',
        }),
      };
      expect(getDynamicRpID(ctx)).toBe('sparkyfitness.tail854f4e.ts.net');
    });

    it('extracts hostname from Host header', () => {
      const ctx = {
        headers: new Headers({
          host: '100.103.152.66:3010',
        }),
      };
      expect(getDynamicRpID(ctx)).toBe('100.103.152.66');
    });

    it('falls back to provided fallback when no headers exist', () => {
      const ctx = {
        headers: new Headers(),
      };
      expect(getDynamicRpID(ctx, 'custom-fallback.com')).toBe(
        'custom-fallback.com'
      );
    });

    it('falls back to localhost when no headers or fallback are provided', () => {
      const ctx = {};
      expect(getDynamicRpID(ctx)).toBe('localhost');
    });

    it('works with getHeader helper function', () => {
      const ctx = {
        getHeader: (name: string) => {
          if (name === 'origin') return 'https://my-domain.com';
          return undefined;
        },
      };
      expect(getDynamicRpID(ctx)).toBe('my-domain.com');
    });
  });

  describe('dynamicPasskey plugin definition', () => {
    it('creates passkey plugin structure with all endpoints', () => {
      const plugin = dynamicPasskey({
        rpName: 'SparkyFitness',
      });

      expect(plugin.id).toBe('passkey');
      expect(plugin.endpoints).toBeDefined();
      expect(
        plugin.endpoints?.generatePasskeyRegistrationOptions
      ).toBeDefined();
      expect(
        plugin.endpoints?.generatePasskeyAuthenticationOptions
      ).toBeDefined();
      expect(plugin.endpoints?.verifyPasskeyRegistration).toBeDefined();
      expect(plugin.endpoints?.verifyPasskeyAuthentication).toBeDefined();
      expect(plugin.endpoints?.listPasskeys).toBeDefined();
      expect(plugin.endpoints?.deletePasskey).toBeDefined();
      expect(plugin.endpoints?.updatePasskey).toBeDefined();
      expect(plugin.schema).toBeDefined();
    });

    it('exposes all passkey error codes', () => {
      expect(PASSKEY_ERROR_CODES.CHALLENGE_NOT_FOUND).toBe(
        'Challenge not found'
      );
      expect(PASSKEY_ERROR_CODES.PASSKEY_NOT_FOUND).toBe('Passkey not found');
      expect(PASSKEY_ERROR_CODES.AUTHENTICATION_FAILED).toBe(
        'Authentication failed'
      );
    });
  });
});
