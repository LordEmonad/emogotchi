// The Autocare poker: reads what is due from the machine (a free view) and, only when there is work, sends
// `runPets(vault, pets, max)` per vault from the keeper wallet, with a gas limit taken from a live estimate plus a
// margin (Monad charges the limit, so no blanket numbers). `runPets` has no early exit, so its estimate covers every
// action in the list; never use `run`/`runAll` here, whose gas-guarded scan makes an estimate the amount that does
// nothing. The bounty refunds the keeper. Runs from the Worker's
// cron (index.js `scheduled`) and from tools/autocare-poke.mjs (GitHub Actions, or by hand): same code, same rules.
//
// The keeper key can only ever spend its own gas: the machine pays for care out of the users' vaults, never from
// the caller. Losing this key loses a little gas money and nothing else.
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export const ABI = parseAbi([
  'struct Pet { uint8 col; uint256 id; }',
  'struct Due { address vault; uint8 col; uint256 id; uint8[] actions; }',
  'function due(uint256 startOwner, uint256 count) view returns (Due[] out, uint256 nextOwner)',
  'function ownerCount() view returns (uint256)',
  'function runPets(address vault, Pet[] list, uint256 maxActions) returns (uint256 done)',
  'event Round(address indexed by, uint256 actions, uint256 bounty)',
]);

const MONAD = { id: 143, name: 'Monad', nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 }, rpcUrls: { default: { http: ['https://rpc.monad.xyz'] } } };
const PAGE = 200;          // owners scanned per due() call
const PER_TX = 40;         // pets per runPets transaction: ~180k gas each on a cold day, well under Monad's 30M
const MAX_TX = 10;         // transactions per poke
const GAS_MARGIN = 125n;   // percent of the estimate

/** Everything due right now, grouped by vault. */
export async function readDue(pub, autocare) {
  const byVault = new Map();
  let start = 0n;
  for (let page = 0; page < 50; page++) {
    const [out, next] = await pub.readContract({ address: autocare, abi: ABI, functionName: 'due', args: [start, BigInt(PAGE)] });
    for (const d of out) {
      const list = byVault.get(d.vault) ?? [];
      list.push({ col: d.col, id: d.id, actions: d.actions.length });
      byVault.set(d.vault, list);
    }
    if (next === 0n) break;
    start = next;
  }
  return byVault;
}

/**
 * One poke. Returns a summary. `env`: { AUTOCARE_ADDRESS, AUTOCARE_KEEPER_KEY, RPC_URL? }.
 * Never throws for a vault that fails: it logs and moves on, so one bad estimate cannot stall the rest.
 */
export async function poke(env, log = () => {}) {
  const autocare = env.AUTOCARE_ADDRESS;
  if (!autocare || !env.AUTOCARE_KEEPER_KEY) return { skipped: 'not configured' };
  const rpc = env.RPC_URL || 'https://rpc.monad.xyz';
  const pub = createPublicClient({ chain: MONAD, transport: http(rpc) });
  const account = privateKeyToAccount(env.AUTOCARE_KEEPER_KEY);
  const wallet = createWalletClient({ account, chain: MONAD, transport: http(rpc) });

  const byVault = await readDue(pub, autocare);
  const summary = { vaults: byVault.size, pets: 0, sent: [], failed: [] };
  if (byVault.size === 0) return summary;

  let nonce = await pub.getTransactionCount({ address: account.address, blockTag: 'pending' });
  let txs = 0;
  for (const [vault, pets] of byVault) {
    for (let i = 0; i < pets.length && txs < MAX_TX; i += PER_TX) {
      const slice = pets.slice(i, i + PER_TX);
      const list = slice.map((p) => ({ col: p.col, id: p.id }));
      const maxActions = BigInt(slice.reduce((s, p) => s + p.actions, 0));
      try {
        const est = await pub.estimateContractGas({ address: autocare, abi: ABI, functionName: 'runPets', args: [vault, list, maxActions], account });
        const gas = (est * GAS_MARGIN) / 100n;
        const hash = await wallet.writeContract({ address: autocare, abi: ABI, functionName: 'runPets', args: [vault, list, maxActions], gas, nonce: nonce++ });
        summary.sent.push({ vault, pets: slice.length, actions: Number(maxActions), gas: Number(gas), hash });
        summary.pets += slice.length;
        txs++;
        log(`runPets ${vault} pets=${slice.length} actions=${maxActions} gas=${gas} ${hash}`);
      } catch (e) {
        summary.failed.push({ vault, error: String(e?.shortMessage ?? e).slice(0, 200) });
        log(`failed ${vault}: ${String(e?.shortMessage ?? e).slice(0, 200)}`);
      }
    }
    if (txs >= MAX_TX) break;
  }
  return summary;
}
