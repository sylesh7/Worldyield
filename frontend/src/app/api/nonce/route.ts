import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Generates a nonce for SIWE (Sign-In With Ethereum) authentication
 * The nonce must be at least 8 alphanumeric characters
 * Read More: https://docs.world.org/mini-apps/commands/wallet-auth#creating-the-nonce
 */
export async function GET(req: NextRequest) {
  // Expects only alphanumeric characters
  const nonce = crypto.randomUUID().replace(/-/g, '');

  // The nonce should be stored somewhere that is not tamperable by the client
  // Optionally you can HMAC the nonce with a secret key stored in your environment
  cookies().set('siwe', nonce, { secure: true });

  return NextResponse.json({ nonce });
}
