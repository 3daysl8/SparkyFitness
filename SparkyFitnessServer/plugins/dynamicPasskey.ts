import { mergeSchema } from 'better-auth/db';
import {
  APIError,
  createAuthEndpoint,
  freshSessionMiddleware,
  getSessionFromCtx,
  sessionMiddleware,
} from 'better-auth/api';
import { defineErrorCodes } from 'better-auth';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { setSessionCookie } from 'better-auth/cookies';
import { generateRandomString } from 'better-auth/crypto';
import * as z from 'zod';
import type { PasskeyOptions } from '@better-auth/passkey';
import type { BetterAuthPlugin } from 'better-auth';

export const PASSKEY_ERROR_CODES = {
  CHALLENGE_NOT_FOUND: 'Challenge not found',
  YOU_ARE_NOT_ALLOWED_TO_REGISTER_THIS_PASSKEY:
    'You are not allowed to register this passkey',
  FAILED_TO_VERIFY_REGISTRATION: 'Failed to verify registration',
  PASSKEY_NOT_FOUND: 'Passkey not found',
  AUTHENTICATION_FAILED: 'Authentication failed',
  UNABLE_TO_CREATE_SESSION: 'Unable to create session',
  FAILED_TO_UPDATE_PASSKEY: 'Failed to update passkey',
  PREVIOUSLY_REGISTERED: 'Previously registered',
  REGISTRATION_CANCELLED: 'Registration cancelled',
  AUTH_CANCELLED: 'Auth cancelled',
  UNKNOWN_ERROR: 'Unknown error',
} as const;

export const errorCodes = defineErrorCodes(PASSKEY_ERROR_CODES);

/**
 * Extracts and derives the WebAuthn RP ID dynamically per-request.
 * Matches the actual incoming origin / host so passkey registration and
 * verification succeed seamlessly across Tailscale hostnames (e.g.
 * sparkyfitness.tail854f4e.ts.net), local network IPs, and localhost without
 * single-origin startup lock-in.
 */
export function getDynamicRpID(
  ctx: {
    headers?: Headers | null;
    getHeader?: (name: string) => string | undefined;
  },
  fallback?: string
): string {
  // 1. Try Origin header first: e.g. "https://sparkyfitness.tail854f4e.ts.net"
  const origin =
    ctx.headers?.get('origin') ||
    (typeof ctx.getHeader === 'function' ? ctx.getHeader('origin') : undefined);
  if (origin && origin !== 'null') {
    try {
      const parsed = new URL(origin);
      if (parsed.hostname) return parsed.hostname;
    } catch {
      // Fall through
    }
  }

  // 2. Try X-Forwarded-Host or Host header: e.g. "sparkyfitness.tail854f4e.ts.net:8080"
  const forwardedHost =
    ctx.headers?.get('x-forwarded-host') ||
    (typeof ctx.getHeader === 'function'
      ? ctx.getHeader('x-forwarded-host')
      : undefined);
  if (forwardedHost) {
    return forwardedHost.split(':')[0].trim();
  }

  const host =
    ctx.headers?.get('host') ||
    (typeof ctx.getHeader === 'function' ? ctx.getHeader('host') : undefined);
  if (host) {
    return host.split(':')[0].trim();
  }

  // 3. Fall back to configured fallback or localhost
  return fallback || 'localhost';
}

const generatePasskeyQuerySchema = z
  .object({
    authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
    name: z.string().optional(),
  })
  .optional();

const generatePasskeyRegistrationOptions = (
  opts: PasskeyOptions,
  { maxAgeInSeconds }: { maxAgeInSeconds: number }
) =>
  createAuthEndpoint(
    '/passkey/generate-register-options',
    {
      method: 'GET',
      use: [freshSessionMiddleware],
      query: generatePasskeyQuerySchema,
    },
    async (ctx: any) => {
      const { session } = ctx.context;
      const userPasskeys = await ctx.context.adapter.findMany({
        model: 'passkey',
        where: [
          {
            field: 'userId',
            value: session.user.id,
          },
        ],
      });
      const userID = new TextEncoder().encode(
        generateRandomString(32, 'a-z', '0-9')
      );
      const rpID = getDynamicRpID(ctx, opts.rpID);

      const options = await generateRegistrationOptions({
        rpName: opts.rpName || ctx.context.appName || 'SparkyFitness',
        rpID,
        userID,
        userName: ctx.query?.name || session.user.email || session.user.id,
        userDisplayName: session.user.email || session.user.id,
        attestationType: 'none',
        excludeCredentials: userPasskeys.map((p: any) => ({
          id: p.credentialID,
          transports: p.transports?.split(','),
        })),
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred',
          ...(opts.authenticatorSelection || {}),
          ...(ctx.query?.authenticatorAttachment
            ? { authenticatorAttachment: ctx.query.authenticatorAttachment }
            : {}),
        },
      });

      const verificationToken = generateRandomString(32);
      const webAuthnCookie = ctx.context.createAuthCookie(
        opts.advanced?.webAuthnChallengeCookie || 'better-auth-passkey'
      );
      await ctx.setSignedCookie(
        webAuthnCookie.name,
        verificationToken,
        ctx.context.secret,
        {
          ...webAuthnCookie.attributes,
          maxAge: maxAgeInSeconds,
        }
      );
      const expirationTime = new Date(Date.now() + maxAgeInSeconds * 1000);
      await ctx.context.internalAdapter.createVerificationValue({
        identifier: verificationToken,
        value: JSON.stringify({
          expectedChallenge: options.challenge,
          userData: { id: session.user.id },
        }),
        expiresAt: expirationTime,
      });

      return ctx.json(options, { status: 200 });
    }
  );

const generatePasskeyAuthenticationOptions = (
  opts: PasskeyOptions,
  { maxAgeInSeconds }: { maxAgeInSeconds: number }
) =>
  createAuthEndpoint(
    '/passkey/generate-authenticate-options',
    {
      method: 'GET',
    },
    async (ctx: any) => {
      const session = await getSessionFromCtx(ctx);
      let userPasskeys: any[] = [];
      if (session) {
        userPasskeys = await ctx.context.adapter.findMany({
          model: 'passkey',
          where: [
            {
              field: 'userId',
              value: session.user.id,
            },
          ],
        });
      }

      const rpID = getDynamicRpID(ctx, opts.rpID);
      const options = await generateAuthenticationOptions({
        rpID,
        userVerification: 'preferred',
        ...(userPasskeys.length
          ? {
              allowCredentials: userPasskeys.map((p: any) => ({
                id: p.credentialID,
                transports: p.transports?.split(','),
              })),
            }
          : {}),
      });

      const data = {
        expectedChallenge: options.challenge,
        userData: { id: session?.user.id || '' },
      };
      const verificationToken = generateRandomString(32);
      const webAuthnCookie = ctx.context.createAuthCookie(
        opts.advanced?.webAuthnChallengeCookie || 'better-auth-passkey'
      );
      await ctx.setSignedCookie(
        webAuthnCookie.name,
        verificationToken,
        ctx.context.secret,
        {
          ...webAuthnCookie.attributes,
          maxAge: maxAgeInSeconds,
        }
      );
      const expirationTime = new Date(Date.now() + maxAgeInSeconds * 1000);
      await ctx.context.internalAdapter.createVerificationValue({
        identifier: verificationToken,
        value: JSON.stringify(data),
        expiresAt: expirationTime,
      });

      return ctx.json(options, { status: 200 });
    }
  );

const verifyPasskeyRegistrationBodySchema = z.object({
  response: z.any(),
  name: z.string().optional(),
});

const verifyPasskeyRegistration = (options: PasskeyOptions) =>
  createAuthEndpoint(
    '/passkey/verify-registration',
    {
      method: 'POST',
      body: verifyPasskeyRegistrationBodySchema,
      use: [freshSessionMiddleware],
    },
    async (ctx: any) => {
      const origin = options?.origin || ctx.headers?.get('origin') || '';
      if (!origin) {
        throw APIError.from(
          'BAD_REQUEST',
          errorCodes.FAILED_TO_VERIFY_REGISTRATION
        );
      }
      const resp = ctx.body.response;
      const cookieName =
        options.advanced?.webAuthnChallengeCookie || 'better-auth-passkey';
      const webAuthnCookie = ctx.context.createAuthCookie(cookieName);
      const verificationToken = await ctx.getSignedCookie(
        webAuthnCookie.name,
        ctx.context.secret
      );
      if (!verificationToken) {
        throw APIError.from('BAD_REQUEST', errorCodes.CHALLENGE_NOT_FOUND);
      }
      const data =
        await ctx.context.internalAdapter.findVerificationValue(
          verificationToken
        );
      if (!data) {
        throw APIError.from('BAD_REQUEST', errorCodes.CHALLENGE_NOT_FOUND);
      }
      const { expectedChallenge, userData } = JSON.parse(data.value);
      if (userData.id !== ctx.context.session.user.id) {
        throw APIError.from(
          'UNAUTHORIZED',
          errorCodes.YOU_ARE_NOT_ALLOWED_TO_REGISTER_THIS_PASSKEY
        );
      }
      try {
        const expectedRPID = getDynamicRpID(ctx, options.rpID);
        const { verified, registrationInfo } = await verifyRegistrationResponse(
          {
            response: resp,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID,
            requireUserVerification: false,
          }
        );
        if (!verified || !registrationInfo) {
          throw APIError.from(
            'BAD_REQUEST',
            errorCodes.FAILED_TO_VERIFY_REGISTRATION
          );
        }
        const { aaguid, credentialDeviceType, credentialBackedUp, credential } =
          registrationInfo;
        const pubKey = isoBase64URL.fromBuffer(credential.publicKey);
        const newPasskey = {
          name: ctx.body.name,
          userId: userData.id,
          credentialID: credential.id,
          publicKey: pubKey,
          counter: credential.counter,
          deviceType: credentialDeviceType,
          transports: resp.response?.transports?.join(','),
          backedUp: credentialBackedUp,
          createdAt: new Date(),
          aaguid,
        };
        const newPasskeyRes = await ctx.context.adapter.create({
          model: 'passkey',
          data: newPasskey,
        });
        await ctx.context.internalAdapter.deleteVerificationByIdentifier(
          verificationToken
        );
        return ctx.json(newPasskeyRes, { status: 200 });
      } catch (e) {
        ctx.context.logger.error('Failed to verify registration', e);
        throw APIError.from(
          'INTERNAL_SERVER_ERROR',
          errorCodes.FAILED_TO_VERIFY_REGISTRATION
        );
      }
    }
  );

const verifyPasskeyAuthenticationBodySchema = z.object({
  response: z.record(z.any(), z.any()),
});

const verifyPasskeyAuthentication = (options: PasskeyOptions) =>
  createAuthEndpoint(
    '/passkey/verify-authentication',
    {
      method: 'POST',
      body: verifyPasskeyAuthenticationBodySchema,
    },
    async (ctx: any) => {
      const origin = options?.origin || ctx.headers?.get('origin') || '';
      if (!origin) {
        throw new APIError('BAD_REQUEST', { message: 'origin missing' });
      }
      const resp = ctx.body.response;
      const cookieName =
        options.advanced?.webAuthnChallengeCookie || 'better-auth-passkey';
      const webAuthnCookie = ctx.context.createAuthCookie(cookieName);
      const verificationToken = await ctx.getSignedCookie(
        webAuthnCookie.name,
        ctx.context.secret
      );
      if (!verificationToken) {
        throw APIError.from('BAD_REQUEST', errorCodes.CHALLENGE_NOT_FOUND);
      }
      const data =
        await ctx.context.internalAdapter.findVerificationValue(
          verificationToken
        );
      if (!data) {
        throw APIError.from('BAD_REQUEST', errorCodes.CHALLENGE_NOT_FOUND);
      }
      const { expectedChallenge } = JSON.parse(data.value);
      const passkeyRecord = await ctx.context.adapter.findOne({
        model: 'passkey',
        where: [
          {
            field: 'credentialID',
            value: resp.id,
          },
        ],
      });
      if (!passkeyRecord) {
        throw APIError.from('UNAUTHORIZED', errorCodes.PASSKEY_NOT_FOUND);
      }
      try {
        const expectedRPID = getDynamicRpID(ctx, options.rpID);
        const verification = await verifyAuthenticationResponse({
          response: resp,
          expectedChallenge,
          expectedOrigin: origin,
          expectedRPID,
          credential: {
            id: passkeyRecord.credentialID,
            publicKey: isoBase64URL.toBuffer(passkeyRecord.publicKey),
            counter: passkeyRecord.counter,
            transports: passkeyRecord.transports?.split(','),
          },
          requireUserVerification: false,
        });
        const { verified } = verification;
        if (!verified) {
          throw APIError.from('UNAUTHORIZED', errorCodes.AUTHENTICATION_FAILED);
        }
        await ctx.context.adapter.update({
          model: 'passkey',
          where: [
            {
              field: 'id',
              value: passkeyRecord.id,
            },
          ],
          update: { counter: verification.authenticationInfo.newCounter },
        });
        const s = await ctx.context.internalAdapter.createSession(
          passkeyRecord.userId
        );
        if (!s) {
          throw APIError.from(
            'INTERNAL_SERVER_ERROR',
            errorCodes.UNABLE_TO_CREATE_SESSION
          );
        }
        const user = await ctx.context.internalAdapter.findUserById(
          passkeyRecord.userId
        );
        if (!user) {
          throw new APIError('INTERNAL_SERVER_ERROR', {
            message: 'User not found',
          });
        }
        await setSessionCookie(ctx, {
          session: s,
          user,
        });
        await ctx.context.internalAdapter.deleteVerificationByIdentifier(
          verificationToken
        );
        return ctx.json({ session: s }, { status: 200 });
      } catch (e) {
        ctx.context.logger.error('Failed to verify authentication', e);
        throw APIError.from('BAD_REQUEST', errorCodes.AUTHENTICATION_FAILED);
      }
    }
  );

const listPasskeys = createAuthEndpoint(
  '/passkey/list-user-passkeys',
  {
    method: 'GET',
    use: [sessionMiddleware],
  },
  async (ctx: any) => {
    const passkeys = await ctx.context.adapter.findMany({
      model: 'passkey',
      where: [
        {
          field: 'userId',
          value: ctx.context.session.user.id,
        },
      ],
    });
    return ctx.json(passkeys, { status: 200 });
  }
);

const deletePasskeyBodySchema = z.object({
  id: z.string(),
});

const deletePasskey = createAuthEndpoint(
  '/passkey/delete-passkey',
  {
    method: 'POST',
    body: deletePasskeyBodySchema,
    use: [sessionMiddleware],
  },
  async (ctx: any) => {
    const passkeyRecord = await ctx.context.adapter.findOne({
      model: 'passkey',
      where: [
        {
          field: 'id',
          value: ctx.body.id,
        },
      ],
    });
    if (!passkeyRecord) {
      throw APIError.from('NOT_FOUND', errorCodes.PASSKEY_NOT_FOUND);
    }
    if (passkeyRecord.userId !== ctx.context.session.user.id) {
      throw new APIError('UNAUTHORIZED');
    }
    await ctx.context.adapter.delete({
      model: 'passkey',
      where: [
        {
          field: 'id',
          value: passkeyRecord.id,
        },
      ],
    });
    return ctx.json({ status: true });
  }
);

const updatePassKeyBodySchema = z.object({
  id: z.string(),
  name: z.string(),
});

const updatePasskey = createAuthEndpoint(
  '/passkey/update-passkey',
  {
    method: 'POST',
    body: updatePassKeyBodySchema,
    use: [sessionMiddleware],
  },
  async (ctx: any) => {
    const passkeyRecord = await ctx.context.adapter.findOne({
      model: 'passkey',
      where: [
        {
          field: 'id',
          value: ctx.body.id,
        },
      ],
    });
    if (!passkeyRecord) {
      throw APIError.from('NOT_FOUND', errorCodes.PASSKEY_NOT_FOUND);
    }
    if (passkeyRecord.userId !== ctx.context.session.user.id) {
      throw APIError.from(
        'UNAUTHORIZED',
        errorCodes.YOU_ARE_NOT_ALLOWED_TO_REGISTER_THIS_PASSKEY
      );
    }
    const updatedPasskey = await ctx.context.adapter.update({
      model: 'passkey',
      where: [
        {
          field: 'id',
          value: ctx.body.id,
        },
      ],
      update: { name: ctx.body.name },
    });
    if (!updatedPasskey) {
      throw APIError.from(
        'INTERNAL_SERVER_ERROR',
        errorCodes.FAILED_TO_UPDATE_PASSKEY
      );
    }
    return ctx.json({ passkey: updatedPasskey }, { status: 200 });
  }
);

const defaultPasskeySchema = {
  passkey: {
    fields: {
      name: {
        type: 'string' as const,
        required: false,
      },
      publicKey: {
        type: 'string' as const,
        required: true,
      },
      userId: {
        type: 'string' as const,
        references: {
          model: 'user',
          field: 'id',
        },
        required: true,
        index: true,
      },
      credentialID: {
        type: 'string' as const,
        required: true,
        index: true,
      },
      counter: {
        type: 'number' as const,
        required: true,
      },
      deviceType: {
        type: 'string' as const,
        required: true,
      },
      backedUp: {
        type: 'boolean' as const,
        required: true,
      },
      transports: {
        type: 'string' as const,
        required: false,
      },
      createdAt: {
        type: 'date' as const,
        required: false,
      },
      aaguid: {
        type: 'string' as const,
        required: false,
      },
    },
  },
};

const MAX_AGE_IN_SECONDS = 300;

export const dynamicPasskey = (options?: PasskeyOptions): BetterAuthPlugin => {
  const opts: PasskeyOptions = {
    origin: null,
    ...options,
    advanced: {
      webAuthnChallengeCookie: 'better-auth-passkey',
      ...options?.advanced,
    },
  };
  return {
    id: 'passkey',
    endpoints: {
      generatePasskeyRegistrationOptions: generatePasskeyRegistrationOptions(
        opts,
        {
          maxAgeInSeconds: MAX_AGE_IN_SECONDS,
        }
      ),
      generatePasskeyAuthenticationOptions:
        generatePasskeyAuthenticationOptions(opts, {
          maxAgeInSeconds: MAX_AGE_IN_SECONDS,
        }),
      verifyPasskeyRegistration: verifyPasskeyRegistration(opts),
      verifyPasskeyAuthentication: verifyPasskeyAuthentication(opts),
      listPasskeys,
      deletePasskey,
      updatePasskey,
    },
    schema: mergeSchema(defaultPasskeySchema, options?.schema),
    $ERROR_CODES: defineErrorCodes(PASSKEY_ERROR_CODES),
    options,
  } as unknown as BetterAuthPlugin;
};
