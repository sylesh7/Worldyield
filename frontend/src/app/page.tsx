import WorldIDVerifyWrapper from '@/components/WorldIDVerifyWrapper';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold">WorldYield</h1>
        <p className="mt-2 text-gray-500">Verified humans earn yield together</p>
      </div>
      <WorldIDVerifyWrapper />
    </main>
  );
}
