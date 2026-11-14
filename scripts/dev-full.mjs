import { spawn } from "node:child_process";
const children = ["server", "dev"].map((script) =>
  spawn("npm", ["run", script], {
    stdio: "inherit",
    shell: process.platform === "win32",
  }),
);
const stop = () => children.forEach((p) => p.kill());
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, stop);
children.forEach((p) =>
  p.on("exit", (code) => {
    stop();
    process.exitCode = code ?? 1;
  }),
);
