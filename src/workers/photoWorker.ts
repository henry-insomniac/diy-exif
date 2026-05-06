/// <reference lib="webworker" />

import exifr from "exifr";
import {
  siApple,
  siDji,
  siFujifilm,
  siLeica,
  siNikon,
  siPanasonic,
  siSony
} from "simple-icons";
import type { SimpleIcon } from "simple-icons";
import type {
  ExifDisplay,
  ExifSummary,
  FrameStyle,
  ImageDimensions,
  RenderRequest,
  RenderResult
} from "../types";

const PREVIEW_EDGE = 1800;
const SOCIAL_EDGE = 3000;
const HIGH_EDGE = 5000;
const PREVIEW_MAX_PIXELS = 5_000_000;
const EXPORT_MAX_PIXELS = 95_000_000;
const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif';

interface Palette {
  background: string;
  photoMat: string;
  ink: string;
  muted: string;
  hairline: string;
  accent: string;
}

interface FrameLayout {
  output: ImageDimensions;
  photo: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  footerHeight: number;
  margin: number;
}

interface BrandLogo {
  pattern: RegExp;
  icon?: SimpleIcon;
  label?: string;
  weight?: number;
  tracking?: number;
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

const palettes: Record<FrameStyle, Omit<Palette, "accent">> = {
  signature: {
    background: "#0b0b0c",
    photoMat: "#111113",
    ink: "#f5f5f7",
    muted: "#a1a1a6",
    hairline: "#2c2c2e"
  },
  gallery: {
    background: "#f7f7f8",
    photoMat: "#f7f7f8",
    ink: "#111111",
    muted: "#6e6e73",
    hairline: "#d2d2d7"
  },
  editorial: {
    background: "#f5f5f7",
    photoMat: "#f5f5f7",
    ink: "#111111",
    muted: "#6e6e73",
    hairline: "#c7c7cc"
  },
  proof: {
    background: "#f7f7f8",
    photoMat: "#f7f7f8",
    ink: "#111111",
    muted: "#6e6e73",
    hairline: "#c7c7cc"
  },
  poster: {
    background: "#0b0b0c",
    photoMat: "#111113",
    ink: "#f5f5f7",
    muted: "#a1a1a6",
    hairline: "#2c2c2e"
  },
  pure: {
    background: "#0b0b0c",
    photoMat: "#0b0b0c",
    ink: "#f5f5f7",
    muted: "#a1a1a6",
    hairline: "#2c2c2e"
  }
};

const brandAccents: Array<[RegExp, string]> = [
  [/canon/i, "#111111"],
  [/nikon/i, "#111111"],
  [/sony/i, "#111111"],
  [/fuji|fujifilm/i, "#111111"],
  [/leica/i, "#111111"],
  [/hasselblad/i, "#111111"],
  [/ricoh/i, "#111111"],
  [/apple/i, "#111111"],
  [/dji/i, "#111111"],
  [/panasonic|lumix/i, "#111111"],
  [/olympus|om digital/i, "#111111"],
  [/pentax/i, "#111111"]
];

const cameraBrands: Array<[RegExp, string]> = [
  [/canon/i, "CANON"],
  [/nikon/i, "NIKON"],
  [/sony/i, "SONY"],
  [/fuji|fujifilm/i, "FUJIFILM"],
  [/leica/i, "LEICA"],
  [/hasselblad/i, "HASSELBLAD"],
  [/ricoh/i, "RICOH"],
  [/apple/i, "APPLE"],
  [/dji/i, "DJI"],
  [/panasonic|lumix/i, "PANASONIC"],
  [/olympus/i, "OLYMPUS"],
  [/om digital/i, "OM SYSTEM"],
  [/pentax/i, "PENTAX"]
];

const brandLogos: BrandLogo[] = [
  {
    pattern: /canon/i,
    label: "CANON",
    weight: 650,
    tracking: -0.035
  },
  {
    pattern: /nikon/i,
    icon: siNikon,
    crop: {
      x: 0,
      y: 8.681,
      width: 24.092,
      height: 6.73
    }
  },
  {
    pattern: /sony/i,
    icon: siSony,
    crop: {
      x: -0.001,
      y: 9.888,
      width: 24.001,
      height: 4.224
    }
  },
  {
    pattern: /fuji|fujifilm/i,
    icon: siFujifilm,
    crop: {
      x: 0,
      y: 9.987,
      width: 24,
      height: 4.038
    }
  },
  {
    pattern: /leica/i,
    icon: siLeica,
    crop: {
      x: 0,
      y: 0,
      width: 24,
      height: 24
    }
  },
  {
    pattern: /hasselblad/i,
    label: "HASSELBLAD",
    weight: 560,
    tracking: 0.015
  },
  {
    pattern: /ricoh/i,
    label: "RICOH",
    weight: 650,
    tracking: 0.015
  },
  {
    pattern: /apple/i,
    icon: siApple,
    crop: {
      x: 1.114,
      y: 0,
      width: 20.661,
      height: 24.05
    }
  },
  {
    pattern: /dji/i,
    icon: siDji,
    crop: {
      x: 0,
      y: 4.92,
      width: 24,
      height: 14.168
    }
  },
  {
    pattern: /panasonic|lumix/i,
    icon: siPanasonic,
    crop: {
      x: 0,
      y: 10.161,
      width: 24.017,
      height: 3.703
    }
  },
  {
    pattern: /olympus/i,
    label: "OLYMPUS",
    weight: 600,
    tracking: 0.035
  },
  {
    pattern: /om system/i,
    label: "OM SYSTEM",
    weight: 560,
    tracking: 0.02
  },
  {
    pattern: /pentax/i,
    label: "PENTAX",
    weight: 650,
    tracking: 0.02
  }
];

const ctx = self as DedicatedWorkerGlobalScope;

ctx.onmessage = async (event: MessageEvent<RenderRequest>) => {
  const request = event.data;
  if (request.type !== "render") return;

  try {
    const result = await renderPhoto(request);
    ctx.postMessage({ id: request.id, type: "done", result });
  } catch (error) {
    ctx.postMessage({
      id: request.id,
      type: "error",
      message: error instanceof Error ? error.message : "图片处理失败"
    });
  }
};

async function renderPhoto(request: RenderRequest): Promise<RenderResult> {
  const { file, settings, purpose, id } = request;
  const warnings: string[] = [];

  postStage(id, "读取 EXIF");
  const exif = await readExif(file, warnings);

  postStage(id, "计算尺寸");
  const probedSize = await probeImageSize(file, exif.orientation);

  let bitmap: ImageBitmap;
  let source = probedSize;
  let target: ImageDimensions;

  if (source) {
    target = chooseTargetSize(source, settings.exportSize, purpose, warnings);
    postStage(id, purpose === "preview" ? "解码预览" : "解码原图");
    bitmap = await createBitmap(file, target);
  } else {
    warnings.push("未能快速读取图片尺寸，已改用浏览器解码。");
    postStage(id, "解码图片");
    bitmap = await createBitmap(file);
    source = { width: bitmap.width, height: bitmap.height };
    target = chooseTargetSize(source, settings.exportSize, purpose, warnings);
  }

  if (file.size > 50 * 1024 * 1024 && purpose === "preview") {
    warnings.push("大文件已使用降采样预览，导出时会按所选尺寸重新渲染。");
  }

  postStage(id, "绘制边框");
  const rendered = await composeFrame(bitmap, source, target, exif, settings, purpose, warnings);
  bitmap.close();

  postStage(id, "生成文件");
  return rendered;
}

function postStage(id: string, stage: string) {
  ctx.postMessage({ id, type: "stage", stage });
}

async function readExif(file: File, warnings: string[]): Promise<ExifSummary> {
  try {
    const data = await exifr.parse(file, {
      tiff: true,
      ifd0: {},
      exif: true,
      gps: false,
      interop: false,
      xmp: false,
      translateValues: false,
      pick: [
        "Make",
        "Model",
        "LensMake",
        "LensModel",
        "Lens",
        "FocalLength",
        "FocalLengthIn35mmFormat",
        "FNumber",
        "ExposureTime",
        "ISO",
        "ISOSpeedRatings",
        "PhotographicSensitivity",
        "DateTimeOriginal",
        "CreateDate",
        "ModifyDate",
        "Orientation"
      ]
    });
    return normalizeExif(data ?? {});
  } catch {
    warnings.push("未读取到 EXIF，边框会使用可用的默认信息。");
    return normalizeExif({});
  }
}

function normalizeExif(data: Record<string, unknown>): ExifSummary {
  const make = cleanText(data.Make);
  const model = cleanText(data.Model);
  const lens =
    cleanText(data.LensModel) || cleanText(data.Lens) || cleanText(data.LensMake) || undefined;
  const focalLength = toNumber(data.FocalLength);
  const focalLength35mm = toNumber(data.FocalLengthIn35mmFormat);
  const fNumber = toNumber(data.FNumber);
  const exposureTime = toNumber(data.ExposureTime);
  const iso =
    toNumber(data.ISO) || toNumber(data.ISOSpeedRatings) || toNumber(data.PhotographicSensitivity);
  const dateTime = formatDate(data.DateTimeOriginal || data.CreateDate || data.ModifyDate);
  const orientation = Math.round(toNumber(data.Orientation) || 1);
  const brand = inferBrand([make, model].filter(Boolean).join(" "));
  const camera = formatCamera(brand, make, model);

  const display: ExifDisplay = {
    camera,
    lens: lens || "Unknown lens",
    focal: formatFocal(focalLength, focalLength35mm),
    aperture: formatAperture(fNumber),
    shutter: formatShutter(exposureTime),
    iso: iso ? `ISO ${Math.round(iso)}` : "",
    date: dateTime || "",
    settingsLine: [formatFocal(focalLength), formatAperture(fNumber), formatShutter(exposureTime), iso ? `ISO ${Math.round(iso)}` : ""]
      .filter(Boolean)
      .join("   ")
  };

  return {
    make,
    model,
    brand,
    lens,
    focalLength,
    focalLength35mm,
    fNumber,
    exposureTime,
    iso,
    dateTime,
    orientation,
    display
  };
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
  return cleaned || undefined;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = toNumber(item);
      if (parsed) return parsed;
    }
    return undefined;
  }
  if (typeof value === "string") {
    const ratio = value.match(/^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/);
    if (ratio) {
      const numerator = Number(ratio[1]);
      const denominator = Number(ratio[2]);
      return denominator ? numerator / denominator : undefined;
    }
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function inferBrand(text: string) {
  for (const [pattern, brand] of cameraBrands) {
    if (pattern.test(text)) return brand;
  }
  return cleanText(text)?.split(" ")[0]?.toUpperCase() || "CAMERA";
}

function formatCamera(brand: string, make?: string, model?: string) {
  const rawModel = model || "";
  const cleanedModel = make
    ? rawModel.replace(new RegExp(`^${escapeRegExp(make)}\\s*`, "i"), "").trim()
    : rawModel;
  return [brand, cleanedModel].filter(Boolean).join(" ") || "Unknown camera";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatFocal(focalLength?: number, focalLength35mm?: number) {
  if (!focalLength) return "";
  const base = `${trimNumber(focalLength)}mm`;
  if (focalLength35mm && Math.abs(focalLength35mm - focalLength) > 1) {
    return `${base} · ${Math.round(focalLength35mm)}mm eq`;
  }
  return base;
}

function formatAperture(value?: number) {
  if (!value) return "";
  return `f/${trimNumber(value)}`;
}

function formatShutter(value?: number) {
  if (!value) return "";
  if (value >= 1) return `${trimNumber(value)}s`;
  const denominator = Math.round(1 / value);
  if (denominator <= 0) return "";
  return `1/${denominator}s`;
}

function trimNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function formatDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0")
    ].join(".");
  }
  if (typeof value !== "string") return "";
  const match = value.match(/^(\d{4})[:.-](\d{2})[:.-](\d{2})/);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : value.slice(0, 10);
}

async function probeImageSize(file: File, orientation = 1): Promise<ImageDimensions | null> {
  const type = file.type.toLowerCase();
  if (type.includes("jpeg") || /\.(jpe?g)$/i.test(file.name)) {
    return probeJpegSize(file, orientation);
  }
  if (type.includes("png") || /\.png$/i.test(file.name)) {
    return probePngSize(file);
  }
  return null;
}

async function probeJpegSize(file: File, orientation: number): Promise<ImageDimensions | null> {
  const buffer = await file.slice(0, Math.min(file.size, 8 * 1024 * 1024)).arrayBuffer();
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset + 9 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = view.getUint8(offset + 1);
    offset += 2;

    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0xda) break;
    if (offset + 2 > view.byteLength) break;

    const length = view.getUint16(offset);
    if (length < 2 || offset + length > view.byteLength) break;

    if (isSofMarker(marker)) {
      const height = view.getUint16(offset + 3);
      const width = view.getUint16(offset + 5);
      return orientation >= 5 && orientation <= 8
        ? { width: height, height: width }
        : { width, height };
    }

    offset += length;
  }

  return null;
}

function isSofMarker(marker: number) {
  return (
    marker >= 0xc0 &&
    marker <= 0xcf &&
    ![0xc4, 0xc8, 0xcc].includes(marker)
  );
}

async function probePngSize(file: File): Promise<ImageDimensions | null> {
  const buffer = await file.slice(0, 32).arrayBuffer();
  const view = new DataView(buffer);
  if (
    view.byteLength < 24 ||
    view.getUint32(0) !== 0x89504e47 ||
    view.getUint32(4) !== 0x0d0a1a0a
  ) {
    return null;
  }
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function chooseTargetSize(
  source: ImageDimensions,
  exportSize: string,
  purpose: "preview" | "export",
  warnings: string[]
): ImageDimensions {
  const maxEdge =
    purpose === "preview"
      ? PREVIEW_EDGE
      : exportSize === "high"
        ? HIGH_EDGE
        : exportSize === "source"
          ? Math.max(source.width, source.height)
          : SOCIAL_EDGE;

  const edgeScale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  let width = Math.max(1, Math.round(source.width * edgeScale));
  let height = Math.max(1, Math.round(source.height * edgeScale));

  const maxPixels = purpose === "preview" ? PREVIEW_MAX_PIXELS : EXPORT_MAX_PIXELS;
  const estimated = estimateOutputPixels(width, height);
  if (estimated > maxPixels) {
    const scale = Math.sqrt(maxPixels / estimated);
    width = Math.max(1, Math.floor(width * scale));
    height = Math.max(1, Math.floor(height * scale));
    warnings.push("输出尺寸已按浏览器 Canvas 限制自动收敛。");
  }

  return { width, height };
}

function estimateOutputPixels(width: number, height: number) {
  const edge = Math.max(width, height);
  const estimatedWidth = width + edge * 0.12;
  const estimatedHeight = height + edge * 0.06 + width * 0.16;
  return estimatedWidth * estimatedHeight;
}

async function createBitmap(file: File, target?: ImageDimensions): Promise<ImageBitmap> {
  const options: ImageBitmapOptions = {
    imageOrientation: "from-image"
  };

  if (target) {
    options.resizeWidth = target.width;
    options.resizeHeight = target.height;
    options.resizeQuality = "high";
  }

  try {
    return await createImageBitmap(file, options);
  } catch (error) {
    if (target) return createImageBitmap(file, { imageOrientation: "from-image" });
    throw new Error(
      error instanceof Error
        ? `无法解码图片：${error.message}`
        : "无法解码图片，浏览器可能不支持该格式"
    );
  }
}

async function composeFrame(
  bitmap: ImageBitmap,
  source: ImageDimensions,
  target: ImageDimensions,
  exif: ExifSummary,
  settings: RenderRequest["settings"],
  purpose: "preview" | "export",
  warnings: string[]
): Promise<RenderResult> {
  const palette = getPalette(settings.frameStyle, exif.brand);
  const layout = getFrameLayout(settings.frameStyle, target);
  const { output, photo } = layout;

  const canvas = new OffscreenCanvas(output.width, output.height);
  const canvasContext = canvas.getContext("2d");
  if (!canvasContext) throw new Error("浏览器不支持 OffscreenCanvas");

  canvasContext.imageSmoothingEnabled = true;
  canvasContext.imageSmoothingQuality = "high";
  canvasContext.fillStyle = palette.background;
  canvasContext.fillRect(0, 0, output.width, output.height);

  canvasContext.fillStyle = palette.photoMat;
  canvasContext.fillRect(photo.x, photo.y, photo.width, photo.height);
  canvasContext.drawImage(bitmap, photo.x, photo.y, photo.width, photo.height);
  drawStyleDetails(canvasContext, layout, palette, settings.frameStyle);
  drawFrameMetadata(canvasContext, layout, palette, settings, exif);

  const type = purpose === "preview" ? "image/jpeg" : settings.outputFormat;
  const quality = type === "image/png" ? undefined : settings.quality;
  const blob = await canvas.convertToBlob({ type, quality });

  return {
    blob,
    exif,
    source,
    output,
    warnings
  };
}

function getPalette(style: FrameStyle, brand: string): Palette {
  const accent =
    style === "signature" || style === "poster" || style === "pure"
      ? "#f5f5f7"
      : brandAccents.find(([pattern]) => pattern.test(brand))?.[1] || "#111111";
  return { ...palettes[style], accent };
}

function getFrameLayout(style: FrameStyle, target: ImageDimensions): FrameLayout {
  const edge = Math.max(target.width, target.height);
  const compactFooter = clamp(Math.round(target.width * 0.075), 76, 230);
  const standardFooter = clamp(Math.round(target.width * 0.108), 104, 330);
  const generousFooter = clamp(Math.round(target.width * 0.15), 142, 460);
  const galleryMat = clamp(Math.round(edge * 0.052), 56, 180);
  const posterMat = clamp(Math.round(edge * 0.045), 48, 150);

  if (style === "gallery") {
    const footerHeight = generousFooter;
    return {
      output: {
        width: target.width + galleryMat * 2,
        height: target.height + galleryMat + footerHeight
      },
      photo: {
        x: galleryMat,
        y: galleryMat,
        width: target.width,
        height: target.height
      },
      footerHeight,
      margin: galleryMat
    };
  }

  if (style === "poster") {
    const footerHeight = generousFooter;
    return {
      output: {
        width: target.width + posterMat * 2,
        height: target.height + posterMat + footerHeight
      },
      photo: {
        x: posterMat,
        y: posterMat,
        width: target.width,
        height: target.height
      },
      footerHeight,
      margin: posterMat
    };
  }

  const footerHeight =
    style === "pure" ? compactFooter : style === "editorial" || style === "proof" ? generousFooter : standardFooter;
  return {
    output: {
      width: target.width,
      height: target.height + footerHeight
    },
    photo: {
      x: 0,
      y: 0,
      width: target.width,
      height: target.height
    },
    footerHeight,
    margin: clamp(Math.round(target.width * 0.022), 28, 92)
  };
}

function drawStyleDetails(
  ctx2d: OffscreenCanvasRenderingContext2D,
  layout: FrameLayout,
  palette: Palette,
  style: FrameStyle
) {
  const { output, photo, footerHeight, margin } = layout;
  ctx2d.strokeStyle = palette.hairline;
  ctx2d.lineWidth = Math.max(1, Math.round(output.width / 1800));
  ctx2d.beginPath();
  ctx2d.moveTo(photo.x, photo.y + photo.height + 0.5);
  ctx2d.lineTo(photo.x + photo.width, photo.y + photo.height + 0.5);
  ctx2d.stroke();

  if (style === "proof") {
    const footerTop = photo.y + photo.height;
    ctx2d.beginPath();
    ctx2d.moveTo(margin, footerTop + footerHeight * 0.45);
    ctx2d.lineTo(output.width - margin, footerTop + footerHeight * 0.45);
    ctx2d.moveTo(output.width * 0.36, footerTop + footerHeight * 0.18);
    ctx2d.lineTo(output.width * 0.36, output.height - footerHeight * 0.18);
    ctx2d.moveTo(output.width * 0.68, footerTop + footerHeight * 0.18);
    ctx2d.lineTo(output.width * 0.68, output.height - footerHeight * 0.18);
    ctx2d.stroke();
  }

  if (style === "editorial") {
    ctx2d.fillStyle = palette.accent;
    ctx2d.fillRect(margin, output.height - Math.max(5, footerHeight * 0.034), Math.min(output.width * 0.22, footerHeight * 1.5), Math.max(4, footerHeight * 0.024));
  }

  if (style === "gallery") {
    ctx2d.strokeStyle = colorWithAlpha(palette.ink, 0.12);
    ctx2d.strokeRect(photo.x - 0.5, photo.y - 0.5, photo.width + 1, photo.height + 1);
  }
}

function drawFrameMetadata(
  ctx2d: OffscreenCanvasRenderingContext2D,
  layout: FrameLayout,
  palette: Palette,
  settings: RenderRequest["settings"],
  exif: ExifSummary
) {
  switch (settings.frameStyle) {
    case "gallery":
      drawGalleryMetadata(ctx2d, layout, palette, settings, exif);
      return;
    case "editorial":
      drawEditorialMetadata(ctx2d, layout, palette, settings, exif);
      return;
    case "proof":
      drawProofMetadata(ctx2d, layout, palette, settings, exif);
      return;
    case "poster":
      drawPosterMetadata(ctx2d, layout, palette, settings, exif);
      return;
    case "pure":
      drawPureMetadata(ctx2d, layout, palette, settings, exif);
      return;
    default:
      drawSignatureMetadata(ctx2d, layout, palette, settings, exif);
  }
}

function getMetadataLines(settings: RenderRequest["settings"], exif: ExifSummary) {
  const camera = settings.showCamera ? exif.display.camera : "";
  const cameraModel = camera.replace(new RegExp(`^${escapeRegExp(exif.brand)}\\s*`, "i"), "");
  const lens = settings.showLens ? exif.display.lens : "";
  const date = settings.showDate ? exif.display.date : "";
  const settingLine = exif.display.settingsLine || "EXIF unavailable";

  return { camera, cameraModel, lens, date, settingLine };
}

function drawSignatureMetadata(
  ctx2d: OffscreenCanvasRenderingContext2D,
  layout: FrameLayout,
  palette: Palette,
  settings: RenderRequest["settings"],
  exif: ExifSummary
) {
  const { output, photo, footerHeight } = layout;
  const left = layout.margin;
  const right = output.width - layout.margin;
  const top = photo.y + photo.height;
  const primaryY = top + footerHeight * 0.42;
  const secondaryY = top + footerHeight * 0.68;
  const logoSize = clamp(Math.round(output.width * 0.031), 24, 58);
  const primarySize = clamp(Math.round(output.width * 0.021), 19, 40);
  const metaSize = clamp(Math.round(output.width * 0.017), 16, 34);
  const smallSize = clamp(Math.round(output.width * 0.014), 13, 26);
  const { camera, cameraModel, lens, date, settingLine } = getMetadataLines(settings, exif);

  ctx2d.fillStyle = palette.accent;
  ctx2d.fillRect(left, output.height - Math.max(8, footerHeight * 0.09), Math.min(output.width * 0.16, footerHeight * 1.5), Math.max(4, footerHeight * 0.035));

  const narrow = output.width < 920;
  if (narrow) {
    const logoWidth = drawBrandLogo(ctx2d, exif.brand, left, primaryY - metaSize * 0.55, output.width * 0.28, primarySize, palette.ink);
    const narrowModelX = left + logoWidth + Math.max(12, output.width * 0.014);
    drawFittedText(ctx2d, cameraModel || camera || "CAMERA", narrowModelX, primaryY - metaSize * 0.55, right - narrowModelX, primarySize, 520, palette.muted);
    drawFittedText(ctx2d, settingLine, left, primaryY + metaSize * 0.9, right - left, metaSize, 560, palette.ink);
    drawFittedText(ctx2d, [lens, date].filter(Boolean).join("   "), left, secondaryY + smallSize * 0.9, right - left, smallSize, 400, palette.muted);
    return;
  }

  const logoWidth = drawBrandLogo(ctx2d, exif.brand, left, primaryY, output.width * 0.2, logoSize * 0.82, palette.ink);
  drawFittedText(ctx2d, cameraModel || camera || "CAMERA", left + logoWidth + Math.max(18, output.width * 0.018), primaryY, output.width * 0.28, primarySize, 500, palette.muted);
  drawFittedText(ctx2d, settingLine, right, primaryY, output.width * 0.46, metaSize, 560, palette.ink, "right");
  drawFittedText(ctx2d, lens || "Unknown lens", left, secondaryY, output.width * 0.5, smallSize, 400, palette.muted);
  drawFittedText(ctx2d, date || "No date", right, secondaryY, output.width * 0.28, smallSize, 400, palette.muted, "right");
}

function drawGalleryMetadata(
  ctx2d: OffscreenCanvasRenderingContext2D,
  layout: FrameLayout,
  palette: Palette,
  settings: RenderRequest["settings"],
  exif: ExifSummary
) {
  const { output, photo, footerHeight } = layout;
  const left = photo.x;
  const right = photo.x + photo.width;
  const top = photo.y + photo.height;
  const logoSize = clamp(Math.round(output.width * 0.02), 18, 42);
  const titleSize = clamp(Math.round(output.width * 0.014), 14, 28);
  const detailSize = clamp(Math.round(output.width * 0.011), 11, 21);
  const { camera, cameraModel, lens, date, settingLine } = getMetadataLines(settings, exif);

  const logoWidth = drawBrandLogo(ctx2d, exif.brand, left, top + footerHeight * 0.4, output.width * 0.16, logoSize, palette.ink);
  drawFittedText(ctx2d, cameraModel || camera || "CAMERA", left + logoWidth + output.width * 0.018, top + footerHeight * 0.4, output.width * 0.34, titleSize, 500, palette.muted);
  drawFittedText(ctx2d, [lens, settingLine].filter(Boolean).join("  /  "), left, top + footerHeight * 0.66, output.width * 0.58, detailSize, 420, palette.muted);
  drawFittedText(ctx2d, date || "No date", right, top + footerHeight * 0.66, output.width * 0.24, detailSize, 420, palette.muted, "right");
}

function drawEditorialMetadata(
  ctx2d: OffscreenCanvasRenderingContext2D,
  layout: FrameLayout,
  palette: Palette,
  settings: RenderRequest["settings"],
  exif: ExifSummary
) {
  const { output, photo, footerHeight } = layout;
  const left = layout.margin;
  const right = output.width - layout.margin;
  const top = photo.y + photo.height;
  const logoSize = clamp(Math.round(output.width * 0.045), 34, 92);
  const titleSize = clamp(Math.round(output.width * 0.021), 18, 42);
  const metaSize = clamp(Math.round(output.width * 0.014), 13, 28);
  const smallSize = clamp(Math.round(output.width * 0.011), 11, 22);
  const { camera, cameraModel, lens, date, settingLine } = getMetadataLines(settings, exif);

  const logoWidth = drawBrandLogo(ctx2d, exif.brand, left, top + footerHeight * 0.42, output.width * 0.23, logoSize, palette.ink);
  drawFittedText(ctx2d, cameraModel || camera || "CAMERA", left, top + footerHeight * 0.67, output.width * 0.4, titleSize, 520, palette.ink);
  drawFittedText(ctx2d, settingLine, right, top + footerHeight * 0.37, output.width * 0.42, metaSize, 620, palette.ink, "right");
  drawFittedText(ctx2d, lens || "Unknown lens", right, top + footerHeight * 0.58, output.width * 0.42, smallSize, 420, palette.muted, "right");
  drawFittedText(ctx2d, date || "No date", left + logoWidth + output.width * 0.025, top + footerHeight * 0.42, output.width * 0.18, smallSize, 420, palette.muted);
}

function drawProofMetadata(
  ctx2d: OffscreenCanvasRenderingContext2D,
  layout: FrameLayout,
  palette: Palette,
  settings: RenderRequest["settings"],
  exif: ExifSummary
) {
  const { output, photo, footerHeight } = layout;
  const left = layout.margin;
  const right = output.width - layout.margin;
  const top = photo.y + photo.height;
  const labelSize = clamp(Math.round(output.width * 0.009), 9, 16);
  const valueSize = clamp(Math.round(output.width * 0.014), 13, 27);
  const logoSize = clamp(Math.round(output.width * 0.024), 20, 46);
  const { camera, cameraModel, lens, date, settingLine } = getMetadataLines(settings, exif);

  drawBrandLogo(ctx2d, exif.brand, left, top + footerHeight * 0.31, output.width * 0.18, logoSize, palette.ink);
  drawLabeledValue(ctx2d, "CAMERA", cameraModel || camera || "CAMERA", output.width * 0.39, top + footerHeight * 0.3, output.width * 0.24, labelSize, valueSize, palette);
  drawLabeledValue(ctx2d, "EXPOSURE", settingLine, output.width * 0.71, top + footerHeight * 0.3, right - output.width * 0.71, labelSize, valueSize, palette);
  drawLabeledValue(ctx2d, "LENS", lens || "Unknown lens", left, top + footerHeight * 0.7, output.width * 0.52, labelSize, valueSize, palette);
  drawLabeledValue(ctx2d, "DATE", date || "No date", output.width * 0.71, top + footerHeight * 0.7, right - output.width * 0.71, labelSize, valueSize, palette);
}

function drawPosterMetadata(
  ctx2d: OffscreenCanvasRenderingContext2D,
  layout: FrameLayout,
  palette: Palette,
  settings: RenderRequest["settings"],
  exif: ExifSummary
) {
  const { output, photo, footerHeight } = layout;
  const left = photo.x;
  const right = photo.x + photo.width;
  const top = photo.y + photo.height;
  const logoSize = clamp(Math.round(output.width * 0.058), 42, 124);
  const titleSize = clamp(Math.round(output.width * 0.023), 20, 48);
  const metaSize = clamp(Math.round(output.width * 0.014), 13, 28);
  const smallSize = clamp(Math.round(output.width * 0.011), 11, 22);
  const { camera, cameraModel, lens, date, settingLine } = getMetadataLines(settings, exif);

  drawBrandLogo(ctx2d, exif.brand, left, top + footerHeight * 0.46, output.width * 0.25, logoSize, palette.ink);
  drawFittedText(ctx2d, cameraModel || camera || "CAMERA", left, top + footerHeight * 0.75, output.width * 0.46, titleSize, 560, palette.ink);
  drawFittedText(ctx2d, settingLine, right, top + footerHeight * 0.42, output.width * 0.42, metaSize, 620, palette.ink, "right");
  drawFittedText(ctx2d, [lens, date].filter(Boolean).join("  /  "), right, top + footerHeight * 0.66, output.width * 0.42, smallSize, 420, palette.muted, "right");
}

function drawPureMetadata(
  ctx2d: OffscreenCanvasRenderingContext2D,
  layout: FrameLayout,
  palette: Palette,
  settings: RenderRequest["settings"],
  exif: ExifSummary
) {
  const { output, photo, footerHeight } = layout;
  const left = layout.margin;
  const right = output.width - layout.margin;
  const top = photo.y + photo.height;
  const logoSize = clamp(Math.round(output.width * 0.021), 18, 40);
  const metaSize = clamp(Math.round(output.width * 0.013), 12, 24);
  const { settingLine, date } = getMetadataLines(settings, exif);

  drawBrandLogo(ctx2d, exif.brand, left, top + footerHeight * 0.58, output.width * 0.16, logoSize, palette.ink);
  drawFittedText(ctx2d, [settingLine, date].filter(Boolean).join("  /  "), right, top + footerHeight * 0.58, output.width * 0.58, metaSize, 500, palette.muted, "right");
}

function drawLabeledValue(
  ctx2d: OffscreenCanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  labelSize: number,
  valueSize: number,
  palette: Palette
) {
  drawFittedText(ctx2d, label, x, y - valueSize * 0.8, maxWidth, labelSize, 650, palette.muted);
  drawFittedText(ctx2d, value, x, y, maxWidth, valueSize, 520, palette.ink);
}

function drawBrandLogo(
  ctx2d: OffscreenCanvasRenderingContext2D,
  brand: string,
  x: number,
  baselineY: number,
  maxWidth: number,
  maxHeight: number,
  color: string
) {
  const logo = brandLogos.find((candidate) => candidate.pattern.test(brand));
  if (!logo) {
    return drawFittedText(ctx2d, brand || "CAMERA", x, baselineY, maxWidth, maxHeight, 650, color);
  }

  if (!logo.icon || !logo.crop || typeof Path2D === "undefined") {
    return drawWordmark(
      ctx2d,
      logo.label || brand || "CAMERA",
      x,
      baselineY,
      maxWidth,
      maxHeight,
      logo.weight ?? 650,
      logo.tracking ?? 0,
      color
    );
  }

  const path = new Path2D(logo.icon.path);
  const scale = Math.min(maxWidth / logo.crop.width, maxHeight / logo.crop.height);
  const width = logo.crop.width * scale;
  const height = logo.crop.height * scale;

  ctx2d.save();
  ctx2d.translate(x - logo.crop.x * scale, baselineY - height - logo.crop.y * scale);
  ctx2d.scale(scale, scale);
  ctx2d.fillStyle = color;
  ctx2d.fill(path);
  ctx2d.restore();

  return width;
}

function drawWordmark(
  ctx2d: OffscreenCanvasRenderingContext2D,
  text: string,
  x: number,
  baselineY: number,
  maxWidth: number,
  maxHeight: number,
  weight: number,
  trackingRatio: number,
  color: string
) {
  let fontSize = maxHeight;
  let tracking = fontSize * trackingRatio;
  let width = measureTrackedText(ctx2d, text, fontSize, weight, tracking);

  while (width > maxWidth && fontSize > 11) {
    fontSize -= 1;
    tracking = fontSize * trackingRatio;
    width = measureTrackedText(ctx2d, text, fontSize, weight, tracking);
  }

  ctx2d.save();
  ctx2d.textBaseline = "alphabetic";
  ctx2d.textAlign = "left";
  ctx2d.fillStyle = color;
  ctx2d.font = `${weight} ${fontSize}px ${FONT_STACK}`;

  let cursor = x;
  for (const char of text) {
    ctx2d.fillText(char, cursor, baselineY);
    cursor += ctx2d.measureText(char).width + tracking;
  }

  ctx2d.restore();
  return Math.min(width, maxWidth);
}

function measureTrackedText(
  ctx2d: OffscreenCanvasRenderingContext2D,
  text: string,
  fontSize: number,
  weight: number,
  tracking: number
) {
  ctx2d.font = `${weight} ${fontSize}px ${FONT_STACK}`;
  return Array.from(text).reduce((width, char, index) => {
    return width + ctx2d.measureText(char).width + (index < text.length - 1 ? tracking : 0);
  }, 0);
}

function drawFittedText(
  ctx2d: OffscreenCanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  weight: number,
  color: string,
  align: CanvasTextAlign = "left"
) {
  let fontSize = size;
  ctx2d.textBaseline = "alphabetic";
  ctx2d.textAlign = align;
  ctx2d.fillStyle = color;

  do {
    ctx2d.font = `${weight} ${fontSize}px ${FONT_STACK}`;
    if (ctx2d.measureText(text).width <= maxWidth) break;
    fontSize -= 1;
  } while (fontSize > 11);

  ctx2d.fillText(text, x, y, maxWidth);
  return Math.min(ctx2d.measureText(text).width, maxWidth);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function colorWithAlpha(color: string, alpha: number) {
  if (!color.startsWith("#") || (color.length !== 7 && color.length !== 4)) return color;

  const normalized =
    color.length === 4
      ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
      : color;
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
