import { createBackendApp } from "./app";
import { getEnv } from "./config/env";

const env = getEnv();
const app = createBackendApp({ env });

app.listen(env.port, () => {
  console.log(
    `[StudyMate AI Backend] Server listening on http://localhost:${env.port} (${env.nodeEnv})`,
  );
});
