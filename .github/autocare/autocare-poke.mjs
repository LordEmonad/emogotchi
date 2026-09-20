// Poke the Autocare machine once: what is due, sent as runPets() per vault. The same code the Worker's cron runs.
//   AUTOCARE_ADDRESS=0x… AUTOCARE_KEEPER_KEY=0x… node tools/autocare-poke.mjs        (RPC_URL optional)
// Meant for the GitHub Actions cron in the Pages repo (tools/autocare-poke.yml) and for running by hand.
import { poke } from './keeper.js';
const s = await poke(process.env, (m) => console.log(new Date().toISOString(), m));
console.log(JSON.stringify(s));
if (s.failed?.length) process.exitCode = 1;
