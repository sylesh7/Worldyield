'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

const VerifyButtonDynamic = dynamic(
  () => import('./WorldIDVerify').then((m) => m.VerifyButton),
  { ssr: false },
);

export default function WorldIDVerifyWrapper() {
  const [nullifier, setNullifier] = useState<string | null>(null);

  if (nullifier) {
    return (
      <div className="flex flex-col items-center gap-4 p-8 rounded-2xl border border-green-400 bg-green-50 text-center max-w-md">
        <div className="text-4xl">✅</div>
        <h2 className="text-xl font-semibold text-green-700">Verified Human</h2>
        <p className="text-sm text-gray-500 break-all font-mono">{nullifier}</p>
      </div>
    );
  }

  return <VerifyButtonDynamic onVerified={setNullifier} />;
}
