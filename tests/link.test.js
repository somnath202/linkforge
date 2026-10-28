
import "dotenv/config";

import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import request from "supertest";
import mongoose from "mongoose";

import app from "../src/app.js";
import Url from "../src/models/Url.js";
 
beforeAll(async () => {
  const uri = process.env.TEST_MONGODB_URI;

  if (!uri) {
    throw new Error("TEST_MONGODB_URI is missing from .env");
  }

  // Safety check: refuse to run against another database.
  const databaseName = new URL(uri).pathname.slice(1).split("?")[0];

  if (databaseName !== "linkforge_automated_test") {
    throw new Error(
      `Unsafe test database: ${databaseName}. Expected linkforge_automated_test.`
    );
  }

  await mongoose.connect(uri);
});

beforeEach(async () => {
  // Delete only URL records in the dedicated test database.
  await Url.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe("LinkForge API", () => {
  it("creates a short URL for a valid destination", async () => {
    const response = await request(app)
      .post("/api/v1/links")
      .send({ originalUrl: "https://github.com" });

    expect(response.status).toBe(201);
    expect(response.body.shortCode).toBeTruthy();
    expect(response.body.shortUrl).toContain(response.body.shortCode);

    const savedUrl = await Url.findOne({
      shortCode: response.body.shortCode,
    });

    expect(savedUrl).not.toBeNull();
    expect(savedUrl.originalUrl).toBe("https://github.com/");
  });

  it("rejects a missing URL", async () => {
    const response = await request(app)
      .post("/api/v1/links")
      .send({});

    expect(response.status).toBe(400);
  });

  it("rejects a malformed URL", async () => {
    const response = await request(app)
      .post("/api/v1/links")
      .send({ originalUrl: "not-a-url" });

    expect(response.status).toBe(400);
  });

  it("rejects unsupported URL protocols", async () => {
    const response = await request(app)
      .post("/api/v1/links")
      .send({ originalUrl: "javascript:alert(1)" });

    expect(response.status).toBe(400);
  });

  it("returns 404 for an unknown short code", async () => {
    const response = await request(app).get("/unknown123");

    expect(response.status).toBe(404);
  });

  it("redirects an existing short URL", async () => {
    const savedUrl = await Url.create({
      originalUrl: "https://github.com/",
      shortCode: "test123",
    });

    const response = await request(app).get(`/${savedUrl.shortCode}`);

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("https://github.com/");
  });
});
