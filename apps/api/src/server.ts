import dotenv from "dotenv";
import { resolve } from "node:path";
import app from "./app.js";

dotenv.config({ path: resolve(process.cwd(), ".env") });
dotenv.config({ path: resolve(process.cwd(), "../../.env") });

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
