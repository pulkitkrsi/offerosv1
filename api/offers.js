import { getDb } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";
import { ObjectId } from "mongodb";

async function handler(req, res) {
  const db = await getDb();
  const { id, campaignId } = req.query;

  // Single offer operations: /api/offers?id=xxx
  if (id) {
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid offer ID" });
    const oid = new ObjectId(id);

    if (req.method === "GET") {
      const offer = await db.collection("offers").findOne({ _id: oid });
      if (!offer) return res.status(404).json({ error: "Offer not found" });
      return res.status(200).json(offer);
    }

    if (req.method === "PUT") {
      const updates = req.body || {};
      delete updates._id; delete updates.campaignId; delete updates.createdBy; delete updates.createdAt;
      updates.lastModifiedBy = req.user.id;
      updates.updatedAt = new Date();
      const result = await db.collection("offers").findOneAndUpdate({ _id: oid }, { $set: updates }, { returnDocument: "after" });
      if (!result) return res.status(404).json({ error: "Offer not found" });
      if (result.campaignId) {
        try { await db.collection("campaigns").updateOne({ _id: new ObjectId(result.campaignId) }, { $set: { updatedAt: new Date(), lastModifiedBy: req.user.id } }); } catch {}
      }
      return res.status(200).json(result);
    }

    if (req.method === "DELETE") {
      const offer = await db.collection("offers").findOne({ _id: oid });
      if (!offer) return res.status(404).json({ error: "Offer not found" });
      await db.collection("offers").deleteOne({ _id: oid });
      await db.collection("simulations").deleteMany({ offerId: id });
      if (offer.campaignId) {
        try { await db.collection("campaigns").updateOne({ _id: new ObjectId(offer.campaignId) }, { $set: { updatedAt: new Date(), lastModifiedBy: req.user.id } }); } catch {}
      }
      return res.status(200).json({ ok: true });
    }
  }

  // List offers: GET /api/offers?campaignId=xxx
  if (req.method === "GET") {
    if (!campaignId) return res.status(400).json({ error: "campaignId required" });
    try {
      const offers = await db.collection("offers").find({ campaignId }).sort({ createdAt: 1 }).toArray();
      return res.status(200).json(offers);
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // Create offer: POST /api/offers
  if (req.method === "POST") {
    try {
      const { campaignId: cid, ...offerData } = req.body || {};
      if (!cid) return res.status(400).json({ error: "campaignId required" });
      if (!offerData.name) return res.status(400).json({ error: "Offer name required" });
      const doc = { ...offerData, campaignId: cid, createdBy: req.user.id, lastModifiedBy: req.user.id, createdAt: new Date(), updatedAt: new Date() };
      const result = await db.collection("offers").insertOne(doc);
      try { await db.collection("campaigns").updateOne({ _id: new ObjectId(cid) }, { $set: { updatedAt: new Date(), lastModifiedBy: req.user.id } }); } catch {}
      return res.status(201).json({ ...doc, _id: result.insertedId });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler);
