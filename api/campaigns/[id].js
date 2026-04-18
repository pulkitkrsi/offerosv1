import { getDb } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";
import { ObjectId } from "mongodb";

async function handler(req, res) {
  const id = req.query.id;
  if (!id || !ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid campaign ID" });
  const db = await getDb();
  const oid = new ObjectId(id);

  if (req.method === "GET") {
    const campaign = await db.collection("campaigns").findOne({ _id: oid });
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    const offers = await db.collection("offers").find({ campaignId: id }).sort({ createdAt: 1 }).toArray();
    return res.status(200).json({ ...campaign, offers });
  }

  if (req.method === "PUT") {
    const updates = req.body || {};
    delete updates._id;
    updates.lastModifiedBy = req.user.id;
    updates.updatedAt = new Date();
    const result = await db.collection("campaigns").findOneAndUpdate({ _id: oid }, { $set: updates }, { returnDocument: "after" });
    if (!result) return res.status(404).json({ error: "Campaign not found" });
    return res.status(200).json(result);
  }

  if (req.method === "DELETE") {
    await db.collection("campaigns").updateOne({ _id: oid }, { $set: { status: "archived", updatedAt: new Date() } });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler);
