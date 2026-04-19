import { getDb } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";
import { ObjectId } from "mongodb";

async function handler(req, res) {
  const db = await getDb();
  const { id } = req.query;

  // Single campaign operations: /api/campaigns?id=xxx
  if (id) {
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid campaign ID" });
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
  }

  // List campaigns: GET /api/campaigns
  if (req.method === "GET") {
    try {
      const campaigns = await db.collection("campaigns").find({ status: { $ne: "archived" } }).sort({ updatedAt: -1 }).toArray();
      const offerCounts = await db.collection("offers").aggregate([{ $group: { _id: "$campaignId", count: { $sum: 1 } } }]).toArray();
      const countMap = Object.fromEntries(offerCounts.map(c => [c._id.toString(), c.count]));
      const result = campaigns.map(c => ({ ...c, offerCount: countMap[c._id.toString()] || 0 }));
      return res.status(200).json(result);
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // Create campaign: POST /api/campaigns
  if (req.method === "POST") {
    try {
      const { name, marginPct } = req.body || {};
      if (!name) return res.status(400).json({ error: "Campaign name required" });
      const doc = { name, marginPct: marginPct || 30, status: "draft", createdBy: req.user.id, lastModifiedBy: req.user.id, createdAt: new Date(), updatedAt: new Date() };
      const result = await db.collection("campaigns").insertOne(doc);
      return res.status(201).json({ ...doc, _id: result.insertedId });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler);
