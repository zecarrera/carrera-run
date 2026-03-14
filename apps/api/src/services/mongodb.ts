import { MongoClient } from "mongodb";

const mongoUri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB_NAME ?? "carrera_run";

let clientPromise: Promise<MongoClient> | null = null;

async function getMongoClient(): Promise<MongoClient> {
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  if (!clientPromise) {
    const client = new MongoClient(mongoUri);
    clientPromise = client.connect();
  }

  return clientPromise;
}

export async function getDatabase() {
  const client = await getMongoClient();
  return client.db(databaseName);
}
