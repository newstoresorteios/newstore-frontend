const { spawnSync } = require("node:child_process");

const env = { ...process.env };
delete env.PUBLIC_URL;

const result = spawnSync(
  process.execPath,
  [require.resolve("react-scripts/bin/react-scripts.js"), "build"],
  {
    env,
    stdio: "inherit",
  }
);

if (result.error) {
  console.error("Falha ao iniciar o build:", result.error.message);
}

process.exit(typeof result.status === "number" ? result.status : 1);
