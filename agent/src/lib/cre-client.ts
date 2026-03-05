/**
 * CRE Client for Mastra Agent Integration
 * 
 * This module provides a client interface for the Mastra agent to interact with
 * CRE workflows without duplicating logic. It exports functions that directly
 * use the CRE workflow logic for real APY fetching and human consensus reading.
 */

import {
	bytesToHex,
	encodeCallMsg,
	EVMClient,
	getNetwork,
	LATEST_BLOCK_NUMBER,
	type Runtime,
} from '@chainlink/cre-sdk'
import { type Address, decodeFunctionResult, encodeFunctionData, type Hex, zeroAddress, createPublicClient, http } from 'viem'
import { sepolia, baseSepolia } from 'viem/chains'
import { MockPool } from './abi/MockPool'
import { HumanConsensus } from './abi/HumanConsensus'

// Keep these for any remaining CRE workflow usage outside this module
export type { } // placeholder to avoid unused import warnings
const SECONDS_PER_YEAR = BigInt(31_536_000)
const RAY = BigInt(10) ** BigInt(27)
const WAD = BigInt(10) ** BigInt(18)
const WAD_TO_RAY_MULTIPLIER = BigInt(10) ** BigInt(9)

/** Math helpers */
export const aprInRAYToAPR = (aprRay: bigint): number => {
	return Number(aprRay) / Number(RAY)
}

export const aprInRAYToAPY = (aprRay: bigint): number => {
	const apr = aprInRAYToAPR(aprRay)
	const apy = Math.exp(apr) - 1
	return apy
}

/** Types matching CRE workflow */
export interface EVMConfig {
	chainName: string
	protocol: 'aave-v3' | 'compound-v3' | 'morpho-vault'
	poolAddress: string
	assetAddress: string
	protocolSmartWalletAddress: string
	gasLimit: string
	humanPoolId?: string
	humanConsensusCount?: number
	manualAPRRay?: string
}

export interface Pool {
	chainName: string
	protocol: string
	APR: bigint
	APY: number
	protocolSmartWalletAddress: string
	balance: bigint
}

export interface ScoredPool extends Pool {
	effectiveAPY: number
	verifiedBoostBps: number
	consensusBoostBps: number
	humanConsensusCount: number
}

export interface YieldData {
	bestPool: {
		chainName: string
		protocol: string
		aprRay: string
		apy: number
		effectiveAPY: number
		verifiedBoostBps: number
		consensusBoostBps: number
		humanConsensusCount: number
		protocolSmartWalletAddress: string
	}
	rankedPools: Array<{
		chainName: string
		protocol: string
		aprRay: string
		apy: number
		effectiveAPY: number
		verifiedBoostBps: number
		consensusBoostBps: number
		humanConsensusCount: number
		protocolSmartWalletAddress: string
		balance: string
	}>
	humanBoost: {
		verifiedBoostBps: number
		consensusWeightBpsPer100Humans: number
	}
	person1Contracts: {
		worldIdGate: string
		veraYieldVault: string
		mandateStorage: string
		humanConsensus: string
		humanConsensusChainName?: string
	}
}

/** Get network and EVM client for a chain */
function getNetworkForChain(chainName: string) {
	return getNetwork({
		chainFamily: 'evm',
		chainSelectorName: chainName,
		isTestnet: true,
	})
}

function getEvmClientForChain(evmCfg: EVMConfig) {
	const network = getNetworkForChain(evmCfg.chainName)
	if (!network) {
		throw new Error(
			`Chain configuration not found for ${evmCfg.chainName}. Check your CRE project.yaml.`,
		)
	}
	return new EVMClient(network.chainSelector.selector)
}

/** Read APR from Aave protocol */
function readAaveAPRRay(
	runtime: Runtime<any>,
	evmCfg: EVMConfig,
	evmClient: EVMClient,
): bigint {
	const callData = encodeFunctionData({
		abi: MockPool,
		functionName: 'getReserveData',
		args: [evmCfg.assetAddress as Hex],
	})

	const callResult = evmClient
		.callContract(runtime, {
			call: encodeCallMsg({
				from: zeroAddress,
				to: evmCfg.poolAddress as Address,
				data: callData,
			}),
			blockNumber: LATEST_BLOCK_NUMBER,
		})
		.result()

	const reserveData = decodeFunctionResult({
		abi: MockPool,
		functionName: 'getReserveData',
		data: bytesToHex(callResult.data),
	})

	return reserveData.currentLiquidityRate as bigint
}

/** Read APR from Compound protocol */
function readCompoundAPRRay(
	runtime: Runtime<any>,
	evmCfg: EVMConfig,
	evmClient: EVMClient,
): bigint {
	try {
		const cometAbi = [
			{
				type: 'function',
				name: 'totalSupply',
				inputs: [],
				outputs: [{ type: 'uint256' }],
				stateMutability: 'view',
			},
			{
				type: 'function',
				name: 'totalBorrow',
				inputs: [],
				outputs: [{ type: 'uint256' }],
				stateMutability: 'view',
			},
			{
				type: 'function',
				name: 'getSupplyRate',
				inputs: [{ name: 'utilization', type: 'uint256' }],
				outputs: [{ type: 'uint64' }],
				stateMutability: 'view',
			},
		] as const

		// ---------- totalSupply ----------
		const supplyCall = encodeFunctionData({
			abi: cometAbi,
			functionName: 'totalSupply',
		})

		const supplyResult = evmClient
			.callContract(runtime, {
				call: encodeCallMsg({
					from: zeroAddress,
					to: evmCfg.poolAddress as Address,
					data: supplyCall,
				}),
				blockNumber: LATEST_BLOCK_NUMBER,
			})
			.result()

		const totalSupply = decodeFunctionResult({
			abi: cometAbi,
			functionName: 'totalSupply',
			data: bytesToHex(supplyResult.data),
		}) as bigint

		// ---------- totalBorrow ----------
		const borrowCall = encodeFunctionData({
			abi: cometAbi,
			functionName: 'totalBorrow',
		})

		const borrowResult = evmClient
			.callContract(runtime, {
				call: encodeCallMsg({
					from: zeroAddress,
					to: evmCfg.poolAddress as Address,
					data: borrowCall,
				}),
				blockNumber: LATEST_BLOCK_NUMBER,
			})
			.result()

		const totalBorrow = decodeFunctionResult({
			abi: cometAbi,
			functionName: 'totalBorrow',
			data: bytesToHex(borrowResult.data),
		}) as bigint

		if (totalSupply === BigInt(0)) {
			runtime.log(`Compound pool empty, returning APR=0`)
			return BigInt(0)
		}

		// utilization scaled to 1e18
		const utilization = (totalBorrow * BigInt(1000000000000000000)) / totalSupply

		// ---------- supplyRate ----------
		const rateCall = encodeFunctionData({
			abi: cometAbi,
			functionName: 'getSupplyRate',
			args: [utilization],
		})

		const rateResult = evmClient
			.callContract(runtime, {
				call: encodeCallMsg({
					from: zeroAddress,
					to: evmCfg.poolAddress as Address,
					data: rateCall,
				}),
				blockNumber: LATEST_BLOCK_NUMBER,
			})
			.result()

		const supplyRatePerSecondWad = decodeFunctionResult({
			abi: cometAbi,
			functionName: 'getSupplyRate',
			data: bytesToHex(rateResult.data),
		}) as bigint

		// convert to annual rate
		const annualRateWad = supplyRatePerSecondWad * SECONDS_PER_YEAR

		// convert WAD → RAY
		const annualRateRay = annualRateWad * WAD_TO_RAY_MULTIPLIER

		runtime.log(
			`Compound rate [${evmCfg.chainName}] totalSupply=${totalSupply} totalBorrow=${totalBorrow} utilization=${utilization} APR_RAY=${annualRateRay}`,
		)

		return annualRateRay
	} catch (error) {
		runtime.log(
			`Compound adapter fallback [${evmCfg.chainName}] failed: ${
				error instanceof Error ? error.message : String(error)
			}`,
		)

		if (evmCfg.manualAPRRay) {
			const aprRay = BigInt(evmCfg.manualAPRRay)
			runtime.log(`Using manualAPRRay fallback=${aprRay}`)
			return aprRay
		}

		// Fallback to Aave-style read
		return readAaveAPRRay(runtime, evmCfg, evmClient)
	}
}

/** Read APR from Morpho protocol */
function readMorphoAPRRay(
	runtime: Runtime<any>,
	evmCfg: EVMConfig,
): bigint {
	if (!evmCfg.manualAPRRay) {
		throw new Error(
			`Morpho adapter requires manualAPRRay for now (chain ${evmCfg.chainName}).`,
		)
	}

	const aprRay = BigInt(evmCfg.manualAPRRay)
	runtime.log(`Morpho fallback APR [${evmCfg.chainName}] from config manualAPRRay=${aprRay}`)
	return aprRay
}

/** Read APR for any supported protocol */
export function readAPRRayForProtocol(
	runtime: Runtime<any>,
	evmCfg: EVMConfig,
	evmClient: EVMClient,
): bigint {
	switch (evmCfg.protocol) {
		case 'aave-v3':
			return readAaveAPRRay(runtime, evmCfg, evmClient)
		case 'compound-v3':
			return readCompoundAPRRay(runtime, evmCfg, evmClient)
		case 'morpho-vault':
			return readMorphoAPRRay(runtime, evmCfg)
		default:
			throw new Error(`Unsupported protocol for APY read: ${evmCfg.protocol}`)
	}
}

/** Read human consensus count from HumanConsensus contract */
export function readHumanConsensusCount(
	runtime: Runtime<any>,
	humanConsensusAddress: string,
	humanConsensusChainName: string,
	evmCfg: EVMConfig,
): number {
	const fallbackCount = evmCfg.humanConsensusCount ?? 0

	if (!evmCfg.humanPoolId) {
		runtime.log(
			`HumanConsensus fallback [${evmCfg.chainName}/${evmCfg.protocol}] missing humanPoolId, using configured count=${fallbackCount}`,
		)
		return fallbackCount
	}

	const network = getNetworkForChain(humanConsensusChainName)

	if (!network) {
		runtime.log(
			`HumanConsensus fallback [${evmCfg.chainName}/${evmCfg.protocol}] unknown chain ${humanConsensusChainName}, using configured count=${fallbackCount}`,
		)
		return fallbackCount
	}

	try {
		const evmClient = new EVMClient(network.chainSelector.selector)
		const callData = encodeFunctionData({
			abi: HumanConsensus,
			functionName: 'getHumanCount',
			args: [evmCfg.humanPoolId],
		})

		const callResult = evmClient
			.callContract(runtime, {
				call: encodeCallMsg({
					from: zeroAddress,
					to: humanConsensusAddress as Address,
					data: callData,
				}),
				blockNumber: LATEST_BLOCK_NUMBER,
			})
			.result()

		const decoded = decodeFunctionResult({
			abi: HumanConsensus,
			functionName: 'getHumanCount',
			data: bytesToHex(callResult.data),
		}) as bigint

		const count = Number(decoded)
		runtime.log(
			`HumanConsensus onchain [${evmCfg.chainName}/${evmCfg.protocol}] poolId=${evmCfg.humanPoolId} count=${count}`,
		)
		return Number.isFinite(count) ? count : fallbackCount
	} catch (error) {
		runtime.log(
			`HumanConsensus fallback [${evmCfg.chainName}/${evmCfg.protocol}] onchain read failed: ${error instanceof Error ? error.message : String(error)}. Using configured count=${fallbackCount}`,
		)
		return fallbackCount
	}
}

/** Score pool with human verification boost */
export function scorePoolForVerifiedHumans(
	pool: Pool,
	humanConsensusCount: number,
	verifiedBoostBps: number,
	consensusWeightBpsPer100Humans: number,
	runtime: Runtime<any>,
): ScoredPool {
	const consensusBoostBps = Math.round(
		(humanConsensusCount / 100) * consensusWeightBpsPer100Humans,
	)

	const totalBoostBps = verifiedBoostBps + consensusBoostBps
	const totalBoostPct = totalBoostBps / 10000
	const effectiveAPY = pool.APY + totalBoostPct

	runtime.log(
		`Scored pool [${pool.chainName}/${pool.protocol}] baseAPY=${(pool.APY * 100).toFixed(4)}%, humans=${humanConsensusCount}, verifiedBoost=${verifiedBoostBps}bps, consensusBoost=${consensusBoostBps}bps, effectiveAPY=${(effectiveAPY * 100).toFixed(4)}%`,
	)

	return {
		...pool,
		effectiveAPY,
		verifiedBoostBps,
		consensusBoostBps,
		humanConsensusCount,
	}
}

/** Map CRE chain name → viem public client */
function getViemClientForChain(chainName: string) {
	if (chainName.includes('base')) {
		return createPublicClient({ chain: baseSepolia, transport: http('https://sepolia.base.org') })
	}
	// default: ethereum sepolia
	return createPublicClient({ chain: sepolia, transport: http('https://ethereum-sepolia.publicnode.com') })
}

/** Read Aave v3 liquidityRate directly via viem */
async function readAaveAPRRayViem(evmCfg: EVMConfig): Promise<bigint> {
	const client = getViemClientForChain(evmCfg.chainName)
	const reserveData = await client.readContract({
		address: evmCfg.poolAddress as Address,
		abi: MockPool,
		functionName: 'getReserveData',
		args: [evmCfg.assetAddress as Hex],
	}) as any
	return reserveData.currentLiquidityRate as bigint
}

const COMET_ABI = [
	{ type: 'function', name: 'totalSupply',   inputs: [],                                 outputs: [{ type: 'uint256' }], stateMutability: 'view' },
	{ type: 'function', name: 'totalBorrow',   inputs: [],                                 outputs: [{ type: 'uint256' }], stateMutability: 'view' },
	{ type: 'function', name: 'getSupplyRate', inputs: [{ name: 'utilization', type: 'uint256' }], outputs: [{ type: 'uint64' }], stateMutability: 'view' },
] as const

/** Read Compound v3 supply rate directly via viem */
async function readCompoundAPRRayViem(evmCfg: EVMConfig): Promise<bigint> {
	try {
		const client = getViemClientForChain(evmCfg.chainName)
		const [totalSupply, totalBorrow] = await Promise.all([
			client.readContract({ address: evmCfg.poolAddress as Address, abi: COMET_ABI, functionName: 'totalSupply' }) as Promise<bigint>,
			client.readContract({ address: evmCfg.poolAddress as Address, abi: COMET_ABI, functionName: 'totalBorrow' }) as Promise<bigint>,
		])
		if (totalSupply === BigInt(0)) return BigInt(0)
		const utilization = (totalBorrow * BigInt('1000000000000000000')) / totalSupply
		const supplyRatePerSecond = await client.readContract({
			address: evmCfg.poolAddress as Address,
			abi: COMET_ABI,
			functionName: 'getSupplyRate',
			args: [utilization],
		}) as bigint
		const annualRateRay = supplyRatePerSecond * SECONDS_PER_YEAR * WAD_TO_RAY_MULTIPLIER
		return annualRateRay
	} catch {
		if (evmCfg.manualAPRRay) return BigInt(evmCfg.manualAPRRay)
		return BigInt(0)
	}
}

/**
 * Simplified interface for Mastra agent to fetch yield data.
 * Uses viem publicClient instead of CRE EVMClient — works outside CRE workflow runtime.
 */
export async function getYieldRecommendation(config: {
	evms: EVMConfig[]
	humanBoost: {
		verifiedBoostBps: number
		consensusWeightBpsPer100Humans: number
	}
	person1Contracts: {
		worldIdGate: string
		veraYieldVault: string
		mandateStorage: string
		humanConsensus: string
		humanConsensusChainName?: string
	}
}): Promise<YieldData> {
	const log = (msg: string) => console.log(`[CRE Client] ${msg}`)

	const scoredPools: ScoredPool[] = []

	for (const evmCfg of config.evms) {
		log(`Reading APY for protocol ${evmCfg.protocol} on chain ${evmCfg.chainName}`)

		let aprRay: bigint = BigInt(0)
		try {
			if (evmCfg.protocol === 'aave-v3') {
				aprRay = await readAaveAPRRayViem(evmCfg)
			} else if (evmCfg.protocol === 'compound-v3') {
				aprRay = await readCompoundAPRRayViem(evmCfg)
			} else if (evmCfg.manualAPRRay) {
				aprRay = BigInt(evmCfg.manualAPRRay)
			}
		} catch (err) {
			log(`APY read failed for ${evmCfg.protocol}/${evmCfg.chainName}: ${err instanceof Error ? err.message : String(err)}`)
			if (evmCfg.manualAPRRay) aprRay = BigInt(evmCfg.manualAPRRay)
		}

		const apy = aprInRAYToAPY(aprRay)
		const pool: Pool = {
			chainName: evmCfg.chainName,
			protocol: evmCfg.protocol,
			APR: aprRay,
			APY: apy,
			protocolSmartWalletAddress: evmCfg.protocolSmartWalletAddress,
			balance: BigInt(0),
		}

		// Use configured humanConsensusCount — on-chain read requires CRE runtime
		const humanConsensusCount = evmCfg.humanConsensusCount ?? 0

		const consensusBoostBps = Math.round((humanConsensusCount / 100) * config.humanBoost.consensusWeightBpsPer100Humans)
		const totalBoostBps = config.humanBoost.verifiedBoostBps + consensusBoostBps
		const effectiveAPY = pool.APY + totalBoostBps / 10000

		log(`Scored pool [${pool.chainName}/${pool.protocol}] baseAPY=${(pool.APY * 100).toFixed(4)}% effectiveAPY=${(effectiveAPY * 100).toFixed(4)}%`)

		scoredPools.push({
			...pool,
			effectiveAPY,
			verifiedBoostBps: config.humanBoost.verifiedBoostBps,
			consensusBoostBps,
			humanConsensusCount,
		})
	}

	const bestPool = scoredPools.reduce((best, c) => c.effectiveAPY > best.effectiveAPY ? c : best)
	log(`Best pool: ${bestPool.chainName}/${bestPool.protocol} with ${(bestPool.effectiveAPY * 100).toFixed(4)}% effective APY`)

	return {
		bestPool: {
			chainName: bestPool.chainName,
			protocol: bestPool.protocol,
			aprRay: bestPool.APR.toString(),
			apy: bestPool.APY,
			effectiveAPY: bestPool.effectiveAPY,
			verifiedBoostBps: bestPool.verifiedBoostBps,
			consensusBoostBps: bestPool.consensusBoostBps,
			humanConsensusCount: bestPool.humanConsensusCount,
			protocolSmartWalletAddress: bestPool.protocolSmartWalletAddress,
		},
		rankedPools: scoredPools
			.map((pool) => ({
				chainName: pool.chainName,
				protocol: pool.protocol,
				aprRay: pool.APR.toString(),
				apy: pool.APY,
				effectiveAPY: pool.effectiveAPY,
				verifiedBoostBps: pool.verifiedBoostBps,
				consensusBoostBps: pool.consensusBoostBps,
				humanConsensusCount: pool.humanConsensusCount,
				protocolSmartWalletAddress: pool.protocolSmartWalletAddress,
				balance: '0',
			}))
			.sort((a, b) => b.effectiveAPY - a.effectiveAPY),
		humanBoost: config.humanBoost,
		person1Contracts: config.person1Contracts,
	}
}
