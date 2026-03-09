import { PASSPORT_HTTP_STATUS } from './status-codes';

export const PASSPORT_HTTP_ERROR_CATALOG = {
  unauthorized: {
    status: PASSPORT_HTTP_STATUS.unauthorized,
    message: 'Unauthorized.'
  },
  grpcUpgradeRequired: {
    status: PASSPORT_HTTP_STATUS.upgradeRequired,
    message: 'Use gRPC channel for this endpoint.',
    hint: 'Connect to JULIA_AGENT_GRPC_PORT using AgentControlService.Connect stream.'
  },
  invalidCreateEnrollmentTokenPayload: {
    status: PASSPORT_HTTP_STATUS.badRequest,
    message: 'Invalid enroll-token payload.'
  },
  missingEnrollFields: {
    status: PASSPORT_HTTP_STATUS.badRequest,
    message: 'agent_id and enrollment_token are required.'
  },
  enrollmentTokenInvalid: {
    status: PASSPORT_HTTP_STATUS.unauthorized,
    message: 'Enrollment token is invalid or expired.'
  },
  missingRefreshFields: {
    status: PASSPORT_HTTP_STATUS.badRequest,
    message: 'agent_id and refresh_token are required.'
  },
  refreshTokenInvalid: {
    status: PASSPORT_HTTP_STATUS.unauthorized,
    message: 'Refresh token is invalid or expired.'
  },
  missingTokenId: {
    status: PASSPORT_HTTP_STATUS.badRequest,
    message: 'token_id is required.'
  }
} as const;

export type PassportHttpErrorKey = keyof typeof PASSPORT_HTTP_ERROR_CATALOG;
