import { getDb } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";

async function handler(req, res) {
  const db = await getDb();

  if (req.method === "GET") {
    const { campaignId } = req.query;
    if (!campaignId) return res.status(400).json({ error: "campaignId required" });
    try {
      const offers = await db.collection("offers").find({ campaignId }).sort({ createdAt: 1 }).toArray();
      return res.status(200).json(offers);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "POST") {
    try {
      const { campaignId, ...offerData } = req.body || {};
      if (!campaignId) return res.status(400).json({ error: "campaignId required" });
      if (!offerData.name) return res.status(400).json({ error: "Offer name required" });

      const doc = {
        ...offerData,
        campaignId,
        createdBy: req.user.id,
        lastModifiedBy: req.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const result = await db.collection("offers").insertOne(doc);

      await db.collection("campaigns").updateOne(
        { _id: (await import("mongodb")).ObjectId.createFromHexString(campaignId) },
        { $set: { updatedAt: new Date(), lastModifiedBy: req.user.id } }
      );

      return res.status(201).json({ ...doc, _id: result.insertedId });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler);
