
import ClickEvent from "../models/ClickEvent.js";

export async function getLinkAnalytics(req, res, next) {
  try {
    const { code } = req.params;

    const totalClicks = await ClickEvent.countDocuments({
      shortCode: code,
    });
 
    return res.status(200).json({
      shortCode: code,
      totalClicks,
    });
  } catch (error) {
    next(error);
  }
}
