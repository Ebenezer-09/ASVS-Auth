require("dotenv").config();

const { createApp } = require("./src/app");
const { port } = require("./src/config/env");

const app = createApp();
const server = app.listen(port, () => {
  console.log(`Express server listening on http://localhost:${port}`);
});

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close(async (error) => {
    try {
      await app.locals.closeDatabase();
      if (error) throw error;
    } catch (closeError) {
      console.error("Échec de la fermeture du serveur :", closeError);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
