// Quick script to get Aave V3 Pool address from PoolAddressesProvider
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';

const POOL_ADDRESSES_PROVIDER = '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951';

const client = createPublicClient({
  chain: sepolia,
  transport: http('https://eth-sepolia.g.alchemy.com/v2/demo'),
});

const poolAddressesProviderAbi = [
  {
    type: 'function',
    name: 'getPool',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
];

async function getPoolAddress() {
  try {
    const poolAddress = await client.readContract({
      address: POOL_ADDRESSES_PROVIDER,
      abi: poolAddressesProviderAbi,
      functionName: 'getPool',
    });
    
    console.log('✅ Aave V3 Pool Address (Sepolia):', poolAddress);
    console.log('\nUpdate your config with:');
    console.log('  poolAddress:', poolAddress);
    console.log('  assetAddress: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 (USDC)');
  } catch (error) {
    console.error('❌ Error fetching Pool address:', error.message);
  }
}

getPoolAddress();
