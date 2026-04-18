import { getDb } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";
import { ObjectId } from "mongodb";

async function handler(req, res) {
  const id = req.query.id;
  if (!id || !ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid offer ID" });
  const db = await getDb();
  const oid = new ObjectId(id);

  if (req.method === "GET") {
    const offer = await db.collection("offers").findOne({ _id: oid });
    if (!offer) return res.status(404).json({ error: "Offer not found" });
    return res.status(200).json(offer);
  }

  if (req.method === "PUT") {
    const updates = req.body || {};
    delete updates._id;
    delete updates.campaignId;
    delete updates.createdBy;
    delete updates.createdAt;
    updates.lastModifiedBy = req.user.id;
    updates.updatedAt = new Date();
    const result = await db.collection("offers").findOneAndUpdate({ _id: oid }, { $set: updates }, { returnDocument: "after" });
    if (!result) return res.status(404).json({ error: "Offer not found" });

    if (result.campaignId) {
      await db.collection("campaigns").updateOne(
        { _id: ObjectId.isValid(result.campaignId) ? new ObjectId(result.campaignId) : result.campaignId },
        { $set: { updatedAt: new Date(), lastModifiedBy: req.user.id } }
      );
    }

    return res.status(200).json(result);
  }

  if (req.method === "DELETE") {
    const offer = await db.collection("offers").findOne({ _id: oid });
    if (!offer) return res.status(404).json({ error: "Offer not found" });
    await db.collection("offers").deleteOne({ _id: oid });
    await db.collection("simulations").deleteMany({ offerId: id });

    if (offer.campaignId) {
      await db.collection("campaigns").updateOne(
        { _id: ObjectId.isValid(offer.campaignId) ? new ObjectId(offer.campaignId) : offer.campaignId },
        { $set: { updatedAt: new Date(), lastModifiedBy: req.user.id } }
      );
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler);
