import { MongoClient } from "mongodb";

let clientPromise;

export async function getDb() {
  if (!clientPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI environment variable not set");
    const client = new MongoClient(uri);
    clientPromise = client.connect();
  }
  const client = await clientPromise;
  return client.db("offeros");
}

export default function getClientPromise() { return clientPromise; }

