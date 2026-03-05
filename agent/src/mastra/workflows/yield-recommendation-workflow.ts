import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { getYieldRecommendation } from '../../lib/cre-client';

// Load configuration from environment
const WORLD_ID_GATE = process.env.WORLD_ID_GATE_ADDRESS!
const VERA_YIELD_VAULT = process.env.VERA_YIELD_VAULT_ADDRESS!
const MANDATE_STORAGE = process.env.MANDATE_STORAGE_ADDRESS!
const HUMAN_CONSENSUS = process.env.HUMAN_CONSENSUS_ADDRESS!

// CRE configuration matching /cre/my-workflow/config.json
const CRE_CONFIG = {
	evms: [
		{
			chainName: 'ethereum-testnet-sepolia',
			protocol: 'aave-v3' as const,
			poolAddress: '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951',
			assetAddress: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8',
			protocolSmartWalletAddress: '0xA08c284a0Ade4867cbdcf8090245FD520F8778c6',
			gasLimit: '1000000',
			humanPoolId: 'aave-sepolia-usdc',
			humanConsensusCount: 847,
		},
		{
			chainName: 'ethereum-testnet-sepolia-base-1',
			protocol: 'compound-v3' as const,
			poolAddress: '0x61490650AbaA31393464C3f34E8B29cd1C44118E',
			assetAddress: '0x036CbD53842c5426634e7929541ec2318F3dCf7e',
			protocolSmartWalletAddress: '0x11e32bc5BDAD3ecD98c7217CF3B88dA9a0Ff2D7A',
			gasLimit: '1000000',
			humanPoolId: 'compound-base-sepolia-usdc',
			humanConsensusCount: 412,
		},
	],
	humanBoost: {
		verifiedBoostBps: 140, // 1.4% boost for verified humans
		consensusWeightBpsPer100Humans: 6, // 0.06% per 100 humans
	},
	person1Contracts: {
		worldIdGate: WORLD_ID_GATE,
		veraYieldVault: VERA_YIELD_VAULT,
		mandateStorage: MANDATE_STORAGE,
		humanConsensus: HUMAN_CONSENSUS,
		humanConsensusChainName: 'ethereum-testnet-sepolia',
	},
}

const yieldDataSchema = z.object({
  protocols: z.array(
    z.object({
      name: z.string(),
      chain: z.string(),
      baseAPY: z.number(),
      effectiveAPY: z.number(),
      verifiedHumans: z.number(),
      verifiedBoostBps: z.number(),
      consensusBoostBps: z.number(),
    })
  ),
});

const recommendationSchema = z.object({
  bestProtocol: z.string(),
  chain: z.string(),
  baseAPY: z.number(),
  effectiveAPY: z.number(),
  humanCount: z.number(),
  verifiedBoost: z.number(),
  consensusBoost: z.number(),
  reasoning: z.string(),
  alternatives: z.array(
    z.object({
      protocol: z.string(),
      chain: z.string(),
      effectiveAPY: z.number(),
    })
  ),
});

const fetchYieldData = createStep({
  id: 'fetch-yield-data',
  description: 'Fetches real-time APY and human consensus data from blockchain via CRE workflows',
  inputSchema: z.object({
    asset: z.string().default('USDC'),
    userAmount: z.number().optional().describe('User deposit amount in USD'),
  }),
  outputSchema: yieldDataSchema,
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }

    console.log('[Workflow] Fetching yield data from CRE...');

    // Call CRE client to get real blockchain data
    const yieldData = await getYieldRecommendation(CRE_CONFIG);

    // Transform CRE data to workflow schema
    const protocols = yieldData.rankedPools.map((pool: any) => ({
      name: pool.protocol,
      chain: pool.chainName,
      baseAPY: pool.apy,
      effectiveAPY: pool.effectiveAPY,
      verifiedHumans: pool.humanConsensusCount,
      verifiedBoostBps: pool.verifiedBoostBps,
      consensusBoostBps: pool.consensusBoostBps,
    }));

    console.log(`[Workflow] Fetched ${protocols.length} protocols from CRE`);

    return { protocols };
  },
});

const analyzeAndRecommend = createStep({
  id: 'analyze-recommend',
  description: 'Analyzes yield data with CRE scoring and provides AI-powered recommendation',
  inputSchema: yieldDataSchema,
  outputSchema: recommendationSchema,
  execute: async ({ inputData, mastra }) => {
    const protocols = inputData?.protocols;

    if (!protocols || protocols.length === 0) {
      throw new Error('No protocol data available');
    }

    console.log('[Workflow] Analyzing protocols...');

    // Protocols are already sorted by effective APY from CRE
    // CRE applies: effectiveAPY = baseAPY + (verifiedBoostBps/10000) + (consensusBoostBps/10000)
    const sorted = [...protocols].sort((a, b) => b.effectiveAPY - a.effectiveAPY);

    const best = sorted[0];
    const alternatives = sorted.slice(1, 3);

    // Generate reasoning based on CRE scoring
    const reasoning = generateReasoning(best, protocols, alternatives);

    console.log(`[Workflow] Best protocol: ${best.name} on ${best.chain} with ${(best.effectiveAPY * 100).toFixed(4)}% effective APY`);

    return {
      bestProtocol: best.name,
      chain: best.chain,
      baseAPY: best.baseAPY,
      effectiveAPY: best.effectiveAPY,
      humanCount: best.verifiedHumans,
      verifiedBoost: best.verifiedBoostBps,
      consensusBoost: best.consensusBoostBps,
      reasoning,
      alternatives: alternatives.map(a => ({
        protocol: a.name,
        chain: a.chain,
        effectiveAPY: a.effectiveAPY,
      })),
    };
  },
});

function generateReasoning(
  best: any,
  allProtocols: any[],
  alternatives: any[]
): string {
  const reasons: string[] = [];

  // Effective APY comparison (includes human boost)
  const secondBest = alternatives[0];
  if (secondBest) {
    const apyDiff = ((best.effectiveAPY - secondBest.effectiveAPY) * 100).toFixed(2);
    if (parseFloat(apyDiff) > 0.5) {
      reasons.push(`${apyDiff}% higher effective APY than next best option (${secondBest.name})`);
    }
  }

  // Human consensus boost explanation
  const verifiedBoostPct = (best.verifiedBoostBps / 100).toFixed(2);
  const consensusBoostPct = (best.consensusBoostBps / 100).toFixed(2);
  
  reasons.push(
    `Base APY of ${(best.baseAPY * 100).toFixed(2)}% boosted to ${(best.effectiveAPY * 100).toFixed(2)}% effective APY`
  );
  
  reasons.push(
    `Verified human boost: +${verifiedBoostPct}% | Consensus boost from ${best.verifiedHumans} humans: +${consensusBoostPct}%`
  );

  // Human confidence signal
  if (best.verifiedHumans > 500) {
    reasons.push(`Strong community trust with ${best.verifiedHumans} verified humans`);
  } else if (best.verifiedHumans > 200) {
    reasons.push(`${best.verifiedHumans} verified humans provide solid confidence`);
  } else {
    reasons.push(`${best.verifiedHumans} verified humans - emerging consensus`);
  }

  return reasons.join('. ') + '.';
}

const notifyUser = createStep({
  id: 'notify-user',
  description: 'Formats and returns the final CRE-powered recommendation to the user',
  inputSchema: recommendationSchema,
  outputSchema: z.object({
    message: z.string(),
    data: recommendationSchema,
  }),
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error('Recommendation data not found');
    }

    const message = formatRecommendation(inputData);

    console.log('[Workflow] Final recommendation ready');

    return {
      message,
      data: inputData,
    };
  },
});

function formatRecommendation(rec: any): string {
  const verifiedBoostPct = (rec.verifiedBoost / 100).toFixed(2);
  const consensusBoostPct = (rec.consensusBoost / 100).toFixed(2);
  
  return `
🎯 **Best Yield: ${rec.bestProtocol} on ${rec.chain}**

📊 Effective APY: ${(rec.effectiveAPY * 100).toFixed(2)}%
   └─ Base APY: ${(rec.baseAPY * 100).toFixed(2)}%
   └─ Verified Boost: +${verifiedBoostPct}%
   └─ Consensus Boost: +${consensusBoostPct}%

👥 Verified Humans: ${rec.humanCount}
💡 Why: ${rec.reasoning}

Alternative Options:
${rec.alternatives.map((alt: any, i: number) => 
  `${i + 1}. ${alt.protocol} (${alt.chain}) - ${(alt.effectiveAPY * 100).toFixed(2)}% effective APY`
).join('\n')}

✨ Powered by Chainlink CRE - Real blockchain data
  `.trim();
}

const yieldRecommendationWorkflow = createWorkflow({
  id: 'yield-recommendation',
  inputSchema: z.object({
    asset: z.string().default('USDC'),
    userAmount: z.number().optional(),
  }),
  outputSchema: z.object({
    message: z.string(),
    data: recommendationSchema,
  }),
})
  .then(fetchYieldData)
  .then(analyzeAndRecommend)
  .then(notifyUser);

yieldRecommendationWorkflow.commit();

export { yieldRecommendationWorkflow };
