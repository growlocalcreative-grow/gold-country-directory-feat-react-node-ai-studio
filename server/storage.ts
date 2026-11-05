import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { Storage } from "@google-cloud/storage";
import type { Config } from "./config.js";
import { ApiFailure } from "./auth.js";
export const imageKeyPattern = /^businesses\/[a-f0-9]{32}\.jpg$/;
export async function cleanImage(input: Buffer) {
  if (input.length > 5 * 1024 * 1024)
    throw new ApiFailure(
      400,
      "invalid_image",
      "Please choose an image smaller than 5 MB.",
    );
  try {
    const image = sharp(input, {
      limitInputPixels: 20_000_000,
      animated: false,
      failOn: "warning",
    });
    const metadata = await image.metadata();
    if (
      !["jpeg", "png", "webp"].includes(metadata.format || "") ||
      !metadata.width ||
      !metadata.height ||
      metadata.width * metadata.height > 20_000_000
    )
      throw new Error("Invalid image");
    return await image
      .rotate()
      .resize({
        width: 2000,
        height: 2000,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 88 })
      .toBuffer();
  } catch {
    throw new ApiFailure(
      400,
      "invalid_image",
      "Please upload a valid JPEG, PNG, or WebP image below 20 megapixels.",
    );
  }
}
export class MediaStorage {
  private gcs?: Storage;
  constructor(private config: Config) {
    if (config.storageBucket) this.gcs = new Storage();
  }
  private cloudKey(key: string) {
    return `${this.config.storagePrefix.replace(/\/$/, "")}/${key.split("/")[1]}`;
  }
  async write(input: Buffer) {
    const content = await cleanImage(input);
    const key = `businesses/${randomUUID().replaceAll("-", "")}.jpg`;
    if (this.gcs)
      await this.gcs
        .bucket(this.config.storageBucket)
        .file(this.cloudKey(key))
        .save(content, {
          resumable: false,
          contentType: "image/jpeg",
          metadata: { cacheControl: "public,max-age=31536000,immutable" },
        });
    else {
      await fs.mkdir(path.join(this.config.mediaRoot, "businesses"), {
        recursive: true,
        mode: 0o700,
      });
      await fs.writeFile(path.join(this.config.mediaRoot, key), content, {
        flag: "wx",
        mode: 0o600,
      });
    }
    return { key, url: `/media/${key}` };
  }
  async read(key: string): Promise<Buffer> {
    if (!imageKeyPattern.test(key))
      throw new ApiFailure(404, "not_found", "Image not found.");
    try {
      return this.gcs
        ? (
            await this.gcs
              .bucket(this.config.storageBucket)
              .file(this.cloudKey(key))
              .download()
          )[0]
        : await fs.readFile(path.join(this.config.mediaRoot, key));
    } catch {
      throw new ApiFailure(404, "not_found", "Image not found.");
    }
  }
}
