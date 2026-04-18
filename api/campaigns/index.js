import { getDb } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";

async function handler(req, res) {
  const db = await getDb();

  if (req.method === "GET") {
    try {
      const campaigns = await db.collection("campaigns").find({ status: { $ne: "archived" } }).sort({ updatedAt: -1 }).toArray();
      const offerCounts = await db.collection("offers").aggregate([
        { $group: { _id: "$campaignId", count: { $sum: 1 } } }
      ]).toArray();
      const countMap = Object.fromEntries(offerCounts.map(c => [c._id.toString(), c.count]));
      const result = campaigns.map(c => ({ ...c, offerCount: countMap[c._id.toString()] || 0 }));
      return res.status(200).json(result);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "POST") {
    try {
      const { name, marginPct } = req.body || {};
      if (!name) return res.status(400).json({ error: "Campaign name required" });
      const doc = {
        name,
        marginPct: marginPct || 30,
        status: "draft",
        createdBy: req.user.id,
        lastModifiedBy: req.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const result = await db.collection("campaigns").insertOne(doc);
      return res.status(201).json({ ...doc, _id: result.insertedId });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler);
