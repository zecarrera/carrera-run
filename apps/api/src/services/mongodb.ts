import { MongoClient } from "mongodb";

let clientPromise: Promise<MongoClient> | null = null;

async function getMongoClient(): Promise<MongoClient> {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  if (!clientPromise) {
    // Enable TLS only for remote (Atlas) connections — local mongodb:// URIs
    // don't use TLS and will fail if tls:true is forced.
    const useTls = mongoUri.startsWith("mongodb+srv://");
    const client = new MongoClient(mongoUri, { tls: useTls });
    clientPromise = client.connect();
  }

  return clientPromise;
}

export async function getDatabase() {
  const databaseName = process.env.MONGODB_DB_NAME ?? "carrera_run";
  const client = await getMongoClient();
  return client.db(databaseName);
}
