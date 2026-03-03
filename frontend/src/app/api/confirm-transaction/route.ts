import { NextRequest, NextResponse } from 'next/server';
import { MiniAppSendTransactionSuccessPayload } from '@worldcoin/minikit-js';

interface IRequestPayload {
  payload: MiniAppSendTransactionSuccessPayload;
}

/**
 * Retrieves transaction details from World App
 * Read More: https://docs.world.org/mini-apps/commands/send-transaction#alternative-verifying-the-transaction
 */
export async function POST(req: NextRequest) {
  try {
    const { payload } = (await req.json()) as IRequestPayload;

    const response = await fetch(
      `https://developer.worldcoin.org/api/v2/minikit/transaction/${payload.transaction_id}?app_id=${process.env.NEXT_PUBLIC_APP_ID}&type=transaction`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.DEV_PORTAL_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch transaction' },
        { status: 400 }
      );
    }

    const transaction = await response.json();
    return NextResponse.json(transaction);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
