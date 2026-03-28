import { RtcTokenBuilder } from 'agora-access-token';

// Define RtcRole constants ourselves since they're not exported
const RtcRole = {
  PUBLISHER: 1,
  SUBSCRIBER: 2
};

// Agora App ID and App Certificate from environment variables
const appId = process.env.AGORA_APP_ID!;
const appCertificate = process.env.AGORA_APP_CERTIFICATE!;

/**
 * Generate an RTC token for Agora.io video streaming
 * @param channelName The channel (room) name
 * @param uid The user ID (0 means use the user account)
 * @param role The user role (publisher or attendee)
 * @param expireTime How long the token should be valid (in seconds)
 * @param account Optional user account name
 * @returns The generated token
 */
export function generateRtcToken(
  channelName: string,
  uid: number,
  role: 'publisher' | 'audience',
  expireTime = 3600, // Default 1 hour
  account?: string
): string {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expireTime;
  
  // Map our role to Agora roles
  const agoraRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

  // Generate the token
  let token: string;
  
  if (account) {
    // Use account for authentication
    token = RtcTokenBuilder.buildTokenWithAccount(
      appId,
      appCertificate,
      channelName,
      account,
      agoraRole,
      privilegeExpiredTs
    );
  } else {
    // Use uid for authentication
    token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      agoraRole,
      privilegeExpiredTs
    );
  }
  
  return token;
}

/**
 * Generate a unique channel name for Agora.io
 * @param prefix A prefix to identify the channel type
 * @returns A unique channel name
 */
export function generateUniqueChannelName(prefix: string = 'webinar'): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}_${randomString}`;
}