import { NextRequest, NextResponse } from 'next/server';
import {
  MiniAppPaymentSuccessPayload,
} from '@worldcoin/minikit-js';

interface IRequestPayload {
  payload: MiniAppPaymentSuccessPayload;
}

/**
 * Verifies payment from World App
 * IMPORTANT: Always verify payments in your backend
 * Read More: https://docs.world.org/mini-apps/commands/pay#verifying-the-payment
 */
export async function POST(req: NextRequest) {
  const { payload } = (await req.json()) as IRequestPayload;

  // IMPORTANT: Here we should fetch the reference you created in /initiate-payment
  // to ensure the transaction we are verifying is the same one we initiated
  // const reference = await getReferenceFromDB(payload.reference);

  try {
    // 1. Check that the transaction we received from the mini app is the same one we sent
    // For now, we'll skip DB check for the template
    if (payload.reference) {
      const response = await fetch(
        `https://developer.worldcoin.org/api/v2/minikit/transaction/${payload.transaction_id}?app_id=${process.env.NEXT_PUBLIC_APP_ID}&type=payment`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${process.env.DEV_PORTAL_API_KEY}`,
          },
        }
      );

      if (!response.ok) {
        return NextResponse.json(
          { success: false, error: 'Failed to verify transaction' },
          { status: 400 }
        );
      }

      const transaction = await response.json();

      // 2. Here we optimistically confirm the transaction.
      //    Otherwise, you can poll until the transaction_status == mined
      if (
        transaction.reference === payload.reference &&
        transaction.transaction_status !== 'failed'
      ) {
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.json(
          { success: false, error: 'Transaction verification failed' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: 'Invalid reference' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error confirming payment:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
