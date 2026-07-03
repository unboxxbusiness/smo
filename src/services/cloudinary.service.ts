import { v2 as cloudinary } from "cloudinary";
import { getSettingValue } from "@/utils/settings";

export class CloudinaryService {
  private static async configure() {
    const cloudName = await getSettingValue("cloudinary_cloud_name", "CLOUDINARY_CLOUD_NAME");
    const apiKey = await getSettingValue("cloudinary_api_key", "CLOUDINARY_API_KEY");
    const apiSecret = await getSettingValue("cloudinary_api_secret", "CLOUDINARY_API_SECRET");

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error("Cloudinary API credentials are not configured.");
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }

  static async uploadBuffer(buffer: Buffer, mimeType: string): Promise<{ url: string; publicId: string }> {
    await this.configure();
    const base64Data = buffer.toString("base64");
    const fileUri = `data:${mimeType};base64,${base64Data}`;

    const res = await cloudinary.uploader.upload(fileUri, {
      folder: "social-media-platform",
    });

    return {
      url: res.secure_url,
      publicId: res.public_id,
    };
  }

  static async deleteAsset(publicId: string): Promise<boolean> {
    await this.configure();
    const res = await cloudinary.uploader.destroy(publicId);
    return res.result === "ok";
  }
}
