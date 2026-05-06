export type FrameStyle = "signature" | "gallery" | "editorial" | "proof" | "poster" | "pure";

export type ExportSize = "preview" | "social" | "high" | "source";

export type OutputFormat = "image/jpeg" | "image/png";

export interface RenderSettings {
  frameStyle: FrameStyle;
  exportSize: ExportSize;
  outputFormat: OutputFormat;
  quality: number;
  title: string;
  author: string;
  showCamera: boolean;
  showLens: boolean;
  showDate: boolean;
}

export interface ExifDisplay {
  camera: string;
  lens: string;
  focal: string;
  aperture: string;
  shutter: string;
  iso: string;
  date: string;
  settingsLine: string;
}

export interface ExifSummary {
  make?: string;
  model?: string;
  brand: string;
  lens?: string;
  focalLength?: number;
  focalLength35mm?: number;
  fNumber?: number;
  exposureTime?: number;
  iso?: number;
  dateTime?: string;
  orientation?: number;
  display: ExifDisplay;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface RenderResult {
  blob: Blob;
  exif: ExifSummary;
  source: ImageDimensions;
  output: ImageDimensions;
  warnings: string[];
}

export interface RenderRequest {
  id: string;
  type: "render";
  file: File;
  settings: RenderSettings;
  purpose: "preview" | "export";
}

export type WorkerResponse =
  | {
      id: string;
      type: "stage";
      stage: string;
    }
  | {
      id: string;
      type: "done";
      result: RenderResult;
    }
  | {
      id: string;
      type: "error";
      message: string;
    };
