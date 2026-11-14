import { makeServer } from "./node/app.ts";
const host = process.env.HALO_HOST ?? "127.0.0.1";
if (
  !["127.0.0.1", "localhost", "::1"].includes(host) &&
  !process.env.HALO_API_TOKEN
)
  throw Error("Non-loopback hosting requires HALO_API_TOKEN");
const app = await makeServer({
  dbPath: process.env.HALO_DB_PATH,
  apiToken: process.env.HALO_API_TOKEN,
  apiKey: process.env.AI_API_KEY,
  model: process.env.HALO_MODEL,
});
await app.listen({ port: Number(process.env.HALO_PORT ?? 3001), host });
process.stdout.write(
  `HALO API: http://${host}:${process.env.HALO_PORT ?? 3001}/docs\n`,
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
