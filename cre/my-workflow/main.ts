import {
	bytesToHex,
	type CronPayload,
	cre,
	encodeCallMsg,
	EVMClient,
	getNetwork,
	hexToBase64,
	LATEST_BLOCK_NUMBER,
	Runner,
	type Runtime,
	TxStatus,
} from '@chainlink/cre-sdk'
import { type Address, decodeFunctionResult, encodeAbiParameters, encodeFunctionData, formatUnits, Hex, parseAbiParameters, zeroAddress } from 'viem'
import { z } from 'zod'
import { HumanConsensus, MockPool } from '../contracts/abi'

const SUPPORTED_PROTOCOLS = ['aave-v3', 'compound-v3', 'morpho-vault'] as const
const protocolSchema = z.enum(SUPPORTED_PROTOCOLS)
type Protocol = (typeof SUPPORTED_PROTOCOLS)[number]

const configSchema = z.object({
	schedule: z.string(),
	minBPSDeltaForRebalance: z.number().min(0),
	humanBoost: z.object({
		verifiedBoostBps: z.number().min(0),
		consensusWeightBpsPer100Humans: z.number().min(0),
	}),
	person1Contracts: z.object({
		worldIdGate: z.string(),
		veraYieldVault: z.string(),
		mandateStorage: z.string(),
		humanConsensus: z.string(),
		humanConsensusChainName: z.string().optional(),
	}),
	evms: z.array(
		z.object({
			protocol: protocolSchema,
			assetAddress: z.string(),
			poolAddress: z.string(),
			protocolSmartWalletAddress: z.string(),
			chainName: z.string(),
			gasLimit: z.string(),
			manualAPRRay: z.string().optional(),
			humanPoolId: z.string().optional(),
			humanConsensusCount: z.number().min(0).optional(),
		}),
	),
})

type Config = z.infer<typeof configSchema>
type EVMConfig = z.infer<typeof configSchema.shape.evms.element>

/** ===== Math Helpers ===== **/

// Converts APR (in RAY units) to floating APR
const aprInRAYToAPR = (apr: bigint): number => parseFloat(formatUnits(apr, 27))

// Converts APR (in RAY units) to APY (compounded)
const aprInRAYToAPY = (apr: bigint): number => Math.exp(parseFloat(formatUnits(apr, 27))) - 1

// Convert APR diff (RAY) to basis points (divide by 1e23)
const RAY_TO_BPS_DIVISOR = 100000000000000000000000n // 1e23
const aprDiffToBps = (diffRay: bigint): bigint => diffRay / RAY_TO_BPS_DIVISOR
const WAD_TO_RAY_MULTIPLIER = 1000000000n // 1e9
const SECONDS_PER_YEAR = 31536000n
const bpsToPct = (bps: number): number => bps / 10000
const pctDiffToBps = (maxPct: number, curPct: number): number =>
	Math.max(0, Math.round((maxPct - curPct) * 10000))

/** ===== Domain Types ===== **/

type Pool = {
	chainName: string
	protocol: Protocol
	APR: bigint
	APY: number
	protocolSmartWalletAddress: string
	balance: bigint
}

type ScoredPool = Pool & {
	humanConsensusCount: number
	verifiedBoostBps: number
	consensusBoostBps: number
	effectiveAPY: number
}

/** ===== EVM/Contract Helpers ===== **/

const getEvmClientForChain = (evmCfg: EVMConfig) => {
	const network = getNetwork({
		chainFamily: 'evm',
		chainSelectorName: evmCfg.chainName,
		isTestnet: true,
	})
	if (!network) {
		throw new Error(`Network not found for chain selector name: ${evmCfg.chainName}`)
	}
	return new cre.capabilities.EVMClient(network.chainSelector.selector)
}

const readCurrentLiquidityRate = (
	runtime: Runtime<Config>,
	evmCfg: EVMConfig,
	evmClient: EVMClient,
): bigint => {
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
			blockNumber: LATEST_BLOCK_NUMBER, // warn: use finalized or safe in prod
		})
		.result()

	const reserveData = decodeFunctionResult({
		abi: MockPool,
		functionName: 'getReserveData',
		data: bytesToHex(callResult.data),
	})

	return reserveData.currentLiquidityRate as bigint
}

const readCompoundAPRRay = (
	runtime: Runtime<Config>,
	evmCfg: EVMConfig,
	evmClient: EVMClient,
): bigint => {
	try {
		const utilizationAbi = [
			{
				type: 'function',
				name: 'getUtilization',
				inputs: [],
				outputs: [{ name: '', type: 'uint256' }],
				stateMutability: 'view',
			},
		] as const

		const utilizationCallData = encodeFunctionData({
			abi: utilizationAbi,
			functionName: 'getUtilization',
		})

		const utilizationResult = evmClient
			.callContract(runtime, {
				call: encodeCallMsg({
					from: zeroAddress,
					to: evmCfg.poolAddress as Address,
					data: utilizationCallData,
				}),
				blockNumber: LATEST_BLOCK_NUMBER,
			})
			.result()

		const utilization = decodeFunctionResult({
			abi: utilizationAbi,
			functionName: 'getUtilization',
			data: bytesToHex(utilizationResult.data),
		}) as bigint

		const supplyRateAbi = [
			{
				type: 'function',
				name: 'getSupplyRate',
				inputs: [{ name: 'utilization', type: 'uint256' }],
				outputs: [{ name: '', type: 'uint256' }],
				stateMutability: 'view',
			},
		] as const

		const supplyRateCallData = encodeFunctionData({
			abi: supplyRateAbi,
			functionName: 'getSupplyRate',
			args: [utilization],
		})

		const supplyRateResult = evmClient
			.callContract(runtime, {
				call: encodeCallMsg({
					from: zeroAddress,
					to: evmCfg.poolAddress as Address,
					data: supplyRateCallData,
				}),
				blockNumber: LATEST_BLOCK_NUMBER,
			})
			.result()

		const supplyRatePerSecondWad = decodeFunctionResult({
			abi: supplyRateAbi,
			functionName: 'getSupplyRate',
			data: bytesToHex(supplyRateResult.data),
		}) as bigint

		const annualRateWad = supplyRatePerSecondWad * SECONDS_PER_YEAR
		const annualRateRay = annualRateWad * WAD_TO_RAY_MULTIPLIER

		runtime.log(
			`Compound rate [${evmCfg.chainName}] utilization=${utilization}, supplyRatePerSecondWad=${supplyRatePerSecondWad}, annualRateRay=${annualRateRay}`,
		)

		return annualRateRay
	} catch (error) {
		runtime.log(
			`Compound adapter fallback [${evmCfg.chainName}] primary call failed: ${error instanceof Error ? error.message : String(error)}`,
		)

		if (evmCfg.manualAPRRay) {
			const aprRay = BigInt(evmCfg.manualAPRRay)
			runtime.log(
				`Compound adapter fallback [${evmCfg.chainName}] using manualAPRRay=${aprRay}`,
			)
			return aprRay
		}

		runtime.log(
			`Compound adapter fallback [${evmCfg.chainName}] using Aave-style reserve data read from pool`,
		)
		return readCurrentLiquidityRate(runtime, evmCfg, evmClient)
	}
}

const readMorphoAPRRay = (
	runtime: Runtime<Config>,
	evmCfg: EVMConfig,
): bigint => {
	if (!evmCfg.manualAPRRay) {
		throw new Error(
			`Morpho adapter requires manualAPRRay for now (chain ${evmCfg.chainName}). Provide it in config until Morpho onchain rate ABI is integrated.`,
		)
	}

	const aprRay = BigInt(evmCfg.manualAPRRay)
	runtime.log(`Morpho fallback APR [${evmCfg.chainName}] from config manualAPRRay=${aprRay}`)
	return aprRay
}

const readAPRRayForProtocol = (
	runtime: Runtime<Config>,
	evmCfg: EVMConfig,
	evmClient: EVMClient,
): bigint => {
	switch (evmCfg.protocol) {
		case 'aave-v3':
			return readCurrentLiquidityRate(runtime, evmCfg, evmClient)
		case 'compound-v3':
			return readCompoundAPRRay(runtime, evmCfg, evmClient)
		case 'morpho-vault':
			return readMorphoAPRRay(runtime, evmCfg)
		default:
			throw new Error(`Unsupported protocol for APY read: ${evmCfg.protocol}`)
	}
}

const readBalanceInPool = (
	runtime: Runtime<Config>,
	evmCfg: EVMConfig,
	evmClient: EVMClient,
): bigint => {
	const callData = encodeFunctionData({
		abi: MockPool,
		functionName: 'balanceOf',
		args: [evmCfg.protocolSmartWalletAddress as Hex, evmCfg.assetAddress as Hex],
	})

	const callResult = evmClient
		.callContract(runtime, {
			call: encodeCallMsg({
				from: zeroAddress,
				to: evmCfg.poolAddress as Address,
				data: callData,
			}),
			blockNumber: LATEST_BLOCK_NUMBER, // warn: use finalized or safe in prod
		})
		.result()

	const decoded = decodeFunctionResult({
		abi: MockPool,
		functionName: 'balanceOf',
		data: bytesToHex(callResult.data),
	})

	return decoded as bigint
}

const buildPoolForChain = (
	runtime: Runtime<Config>,
	evmCfg: EVMConfig,
): Pool => {
	runtime.log(
		`Reading APY for protocol ${evmCfg.protocol} on chain ${evmCfg.chainName} | pool ${evmCfg.poolAddress} | asset ${evmCfg.assetAddress}`,
	)

	const evmClient = getEvmClientForChain(evmCfg)

	const currentLiquidityRate = readAPRRayForProtocol(runtime, evmCfg, evmClient)
	runtime.log(`APR in RAY [${evmCfg.chainName}/${evmCfg.protocol}]: ${currentLiquidityRate}`)

	const balanceInPool = readBalanceInPool(runtime, evmCfg, evmClient)
	runtime.log(`Balance in pool [${evmCfg.chainName}]: ${balanceInPool}`)

	const apy = aprInRAYToAPY(currentLiquidityRate)
	const apr = aprInRAYToAPR(currentLiquidityRate)
	runtime.log(
		`Supply yield [${evmCfg.chainName}] APY%: ${(apy * 100).toFixed(6)}, APR%: ${(apr * 100).toFixed(6)}`,
	)

	return {
		chainName: evmCfg.chainName,
		protocol: evmCfg.protocol,
		APR: currentLiquidityRate,
		APY: apy,
		protocolSmartWalletAddress: evmCfg.protocolSmartWalletAddress,
		balance: balanceInPool,
	}
}

const findBestPool = (pools: Pool[], log: (m: string) => void): Pool => {
	let best: Pool | null = null
	for (const p of pools) {
		if (!best || p.APR > best.APR) {
			best = p
		} else if (p.APR === best.APR) {
			log(`Found tie in APY between ${best.chainName}/${best.protocol} and ${p.chainName}/${p.protocol}, keeping existing best.`)
		}
	}
	if (!best || best.APR <= 0n) throw new Error('Best APY unset or <= 0')
	return best
}

const scorePoolForVerifiedHumans = (
	pool: Pool,
	humanConsensusCount: number,
	config: Config,
	runtime: Runtime<Config>,
): ScoredPool => {
	const verifiedBoostBps = config.humanBoost.verifiedBoostBps
	const consensusBoostBps = Math.round(
		(humanConsensusCount / 100) * config.humanBoost.consensusWeightBpsPer100Humans,
	)
	const effectiveAPY = pool.APY + bpsToPct(verifiedBoostBps + consensusBoostBps)

	runtime.log(
		`Human boost [${pool.chainName}/${pool.protocol}] baseAPY%=${(pool.APY * 100).toFixed(4)} verifiedBoostBps=${verifiedBoostBps} consensusCount=${humanConsensusCount} consensusBoostBps=${consensusBoostBps} effectiveAPY%=${(effectiveAPY * 100).toFixed(4)}`,
	)

	return {
		...pool,
		humanConsensusCount,
		verifiedBoostBps,
		consensusBoostBps,
		effectiveAPY,
	}
}

const findBestScoredPool = (pools: ScoredPool[], log: (m: string) => void): ScoredPool => {
	let best: ScoredPool | null = null
	for (const p of pools) {
		if (!best || p.effectiveAPY > best.effectiveAPY) {
			best = p
		} else if (best && p.effectiveAPY === best.effectiveAPY) {
			log(
				`Found tie in effective APY between ${best.chainName}/${best.protocol} and ${p.chainName}/${p.protocol}, keeping existing best.`,
			)
		}
	}
	if (!best || best.effectiveAPY <= 0) throw new Error('Best effective APY unset or <= 0')
	return best
}

const getChainSelectorFor = (chainName: string): bigint => {
	const network = getNetwork({
		chainFamily: 'evm',
		chainSelectorName: chainName,
		isTestnet: true,
	})
	if (!network) {
		throw new Error(`Could not find network for chain ${chainName}`)
	}
	return network.chainSelector.selector
}

const readHumanConsensusCount = (
	runtime: Runtime<Config>,
	config: Config,
	evmCfg: EVMConfig,
): number => {
	const fallbackCount = evmCfg.humanConsensusCount ?? 0
	if (!evmCfg.humanPoolId) {
		runtime.log(
			`HumanConsensus fallback [${evmCfg.chainName}/${evmCfg.protocol}] missing humanPoolId, using configured count=${fallbackCount}`,
		)
		return fallbackCount
	}

	const consensusChain = config.person1Contracts.humanConsensusChainName ?? evmCfg.chainName
	const network = getNetwork({
		chainFamily: 'evm',
		chainSelectorName: consensusChain,
		isTestnet: true,
	})

	if (!network) {
		runtime.log(
			`HumanConsensus fallback [${evmCfg.chainName}/${evmCfg.protocol}] unknown chain ${consensusChain}, using configured count=${fallbackCount}`,
		)
		return fallbackCount
	}

	try {
		const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector)
		const callData = encodeFunctionData({
			abi: HumanConsensus,
			functionName: 'getHumanCount',
			args: [evmCfg.humanPoolId],
		})

		const callResult = evmClient
			.callContract(runtime, {
				call: encodeCallMsg({
					from: zeroAddress,
					to: config.person1Contracts.humanConsensus as Address,
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

const shouldRebalance = (
	maxAPR: bigint,
	curAPR: bigint,
	minBpsDelta: number,
): { ok: boolean; diffBps: bigint } => {
	const diff = maxAPR - curAPR
	const diffBps = aprDiffToBps(diff)
	return { ok: diffBps >= BigInt(minBpsDelta), diffBps }
}

const shouldRebalanceByEffectiveAPY = (
	maxEffectiveAPY: number,
	curEffectiveAPY: number,
	minBpsDelta: number,
): { ok: boolean; diffBps: number } => {
	const diffBps = pctDiffToBps(maxEffectiveAPY, curEffectiveAPY)
	return { ok: diffBps >= minBpsDelta, diffBps }
}

const performRebalance = (
	runtime: Runtime<Config>,
	evmCfg: EVMConfig,
	amount: bigint,
	bestChainSelector: bigint,
	bestProtocolSmartWallet: string,
): void => {
	const evmClient = getEvmClientForChain(evmCfg)

	const reportData = encodeAbiParameters(
		parseAbiParameters("address asset, uint256 amount, uint64 destinationChainSelector, address destinationProtocolSmartWallet"),
		[evmCfg.assetAddress as Hex, amount, bestChainSelector, bestProtocolSmartWallet as Hex]
	)

	const reportResponse = runtime
		.report({
			encodedPayload: hexToBase64(reportData),
			encoderName: 'evm',
			signingAlgo: 'ecdsa',
			hashingAlgo: 'keccak256',
		})
		.result()

	const resp = evmClient
		.writeReport(runtime, {
			receiver: evmCfg.protocolSmartWalletAddress,
			report: reportResponse,
			gasConfig: {
				gasLimit: evmCfg.gasLimit,
			},
		})
		.result()

	if (resp.txStatus !== TxStatus.SUCCESS) {
		throw new Error(`Failed to write report: ${resp.errorMessage || resp.txStatus}`)
	}

	const txHash = resp.txHash || new Uint8Array(32)
	runtime.log(
		`Write report transaction succeeded on ${evmCfg.chainName} txHash: ${bytesToHex(txHash)}`,
	)
}

/** ===== Orchestration ===== **/

const doHighestSupplyAPY = (runtime: Runtime<Config>): string => {
	const config = runtime.config
	runtime.log(
		`Using Person 1 contracts | WorldIDGate: ${config.person1Contracts.worldIdGate} | VeraYieldVault: ${config.person1Contracts.veraYieldVault} | MandateStorage: ${config.person1Contracts.mandateStorage} | HumanConsensus: ${config.person1Contracts.humanConsensus}`,
	)

	if (config.evms.length < 2) {
		throw new Error('At least two EVM configurations are required to compare supply APYs')
	}

	runtime.log('Reading supply APYs...')

	// 1) Build pool snapshots for all chains
	const pools: Pool[] = config.evms.map((e) => buildPoolForChain(runtime, e))
	const scoredPools: ScoredPool[] = pools.map((pool) => {
		const evmCfg = config.evms.find(
			(e) => e.chainName === pool.chainName && e.protocol === pool.protocol,
		)
		if (!evmCfg) {
			throw new Error(`EVM config not found for pool ${pool.chainName}/${pool.protocol}`)
		}
		const humanConsensusCount = readHumanConsensusCount(runtime, config, evmCfg)
		return scorePoolForVerifiedHumans(pool, humanConsensusCount, config, runtime)
	})

	// 2) Find best pool by effective APY (base APY + verified boost + consensus boost)
	const bestPool = findBestScoredPool(scoredPools, runtime.log)
	runtime.log(
		`Found best effective APY: ${(bestPool.effectiveAPY * 100).toFixed(6)}% on chain ${bestPool.chainName} protocol ${bestPool.protocol}`,
	)

	const bestChainSelector = getChainSelectorFor(bestPool.chainName)

	// Track new balance and amount rebalanced after rebalances
	let newBestBalance = bestPool.balance
	let totalRebalancedAmount = 0n

	// 3) Rebalance from suboptimal pools
	for (const evmCfg of config.evms) {
		if (evmCfg.chainName === bestPool.chainName) continue

		runtime.log(
			`Rebalancing from ${evmCfg.chainName} -> ${bestPool.chainName} (selector ${bestChainSelector})`,
		)

		const evmClient = getEvmClientForChain(evmCfg)
		const balance = readBalanceInPool(runtime, evmCfg, evmClient)

		if (balance === 0n) {
			runtime.log(`No balance to rebalance on chain ${evmCfg.chainName}, skipping.`)
			continue
		}

		const curPool = scoredPools.find(
			(p) => p.chainName === evmCfg.chainName && p.protocol === evmCfg.protocol,
		)
		if (!curPool) throw new Error(`Pool info not found for chain ${evmCfg.chainName}`)

		const { ok, diffBps } = shouldRebalanceByEffectiveAPY(
			bestPool.effectiveAPY,
			curPool.effectiveAPY,
			config.minBPSDeltaForRebalance,
		)

		if (!ok) {
			runtime.log(
				`APY diff below threshold: diff=${diffBps}, min=${config.minBPSDeltaForRebalance} → skipping.`,
			)
			continue
		}

		runtime.log(
			`Rebalancing supply from ${evmCfg.chainName} to ${bestPool.chainName} | balance=${balance}`,
		)

		performRebalance(
			runtime,
			evmCfg,
			balance,
			bestChainSelector,
			bestPool.protocolSmartWalletAddress,
		)

		newBestBalance += balance
		totalRebalancedAmount += balance
	}

	runtime.log(
		`Rebalancing complete | Old balance: ${bestPool.balance} | New balance: ${newBestBalance} | Amount rebalanced: ${totalRebalancedAmount} | Chain: ${bestPool.chainName}`,
	)

	return JSON.stringify({
		timestamp: new Date().toISOString(),
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
				balance: pool.balance.toString(),
			}))
			.sort((a, b) => b.effectiveAPY - a.effectiveAPY),
		rebalance: {
			totalRebalancedAmount: totalRebalancedAmount.toString(),
			newBestBalance: newBestBalance.toString(),
			minBPSDeltaForRebalance: config.minBPSDeltaForRebalance,
		},
		humanBoost: config.humanBoost,
		person1Contracts: config.person1Contracts,
	})
}

/** ===== Workflow ===== **/

const onCronTrigger = (runtime: Runtime<Config>, payload: CronPayload): string => {
	if (!payload.scheduledExecutionTime) {
		throw new Error('Scheduled execution time is required')
	}
	runtime.log('Running CronTrigger for supply APY rebalance')
	return doHighestSupplyAPY(runtime)
}

const initWorkflow = (config: Config) => {
	const cron = new cre.capabilities.CronCapability()
	return [
		cre.handler(
			cron.trigger({
				schedule: config.schedule,
			}),
			onCronTrigger,
		),
	]
}

export async function main() {
	const runner = await Runner.newRunner<Config>({ configSchema })
	await runner.run(initWorkflow)
}

main()
