import { Client } from 'pg';

async function testPort(port: number) {
  const client = new Client({ connectionString: `postgresql://restate:${port}/` });
  try {
    await client.connect();
    console.log(`SUCCESS ON PORT ${port}`);
    await client.end();
  } catch (e: any) {
    console.log(`FAILED ON PORT ${port}: ${e.message}`);
  }
}

async function main() {
  await testPort(9001);
  await testPort(9070);
  await testPort(9071);
  await testPort(8080);
}
main();
