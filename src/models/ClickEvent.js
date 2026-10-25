
import mongoose from "mongoose";

const clickEventSchema = new mongoose.Schema(
  {
    shortCode: {
      type: String,
      required: true,
      index: true,
    },

    clickedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },

    referrer: {
      type: String,
      default: null,
    },
 
    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    versionKey: false,
  }
);

const ClickEvent = mongoose.model(
  "ClickEvent",
  clickEventSchema
);

export default ClickEvent;
