import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiOptions,
} from "cloudinary";
import config from "@/config";

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: config.cloudinary.secure,
});

class CloudinaryService {
  private readonly baseFolderPath = `Bhandara/`;
  private readonly uploadPreset = config.cloudinary.uploadPreset;

  async uploadFile({
    bucket,
    path,
    base64FileData,
    mimeType,
    options = {},
  }: {
    bucket: string;
    path: string;
    base64FileData: string;
    mimeType: string;
    options?: UploadApiOptions;
  }): Promise<UploadApiResponse> {
    const fileData = `data:${mimeType};base64,${base64FileData}`;

    const res = await cloudinary.uploader.upload(fileData, {
      folder: bucket,
      public_id: path,
      resource_type: "image",
      ...options,
    });
    return res;
  }

  async deleteFile(publicId: string) {
    try {
      const res = await cloudinary.uploader.destroy(publicId, {
        invalidate: true,
      });
      return { data: res, error: null };
    } catch (error) {
      return { data: null as any, error };
    }
  }

  getPublicUrl(publicId: string, options: Record<string, any> = {}) {
    return cloudinary.url(publicId, { secure: true, ...options });
  }

  getSignedUploadParams({
    bucket,
    path,
    resourceType,
    rid,
  }: {
    bucket: string;
    path: string;
    resourceType: string;
    rid: string;
  }) {
    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign: Record<string, any> = {
      timestamp,
      folder: `${this.baseFolderPath}${bucket}`,
      public_id: path,
      upload_preset: "bhandara",
      context: `rid=${rid}`,
    };
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      config.cloudinary.apiSecret
    );

    const url = `https://api.cloudinary.com/v1_1/${config.cloudinary.cloudName}/${resourceType}/upload`;

    const params = new URLSearchParams({
      ...paramsToSign,
      signature,
      // Cloudinary API key is not a secret and is safe to expose
      // in client side direct upload parameters
      api_key: config.cloudinary.apiKey,
    });
    return {
      signedURL: `${url}?${params.toString()}`,
      path: paramsToSign?.public_id,
    };
  }
}

export default CloudinaryService;
