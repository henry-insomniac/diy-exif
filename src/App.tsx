import { useEffect, useMemo, useRef, useState } from "react";
import {
  Aperture,
  Camera,
  Check,
  Download,
  FileImage,
  Gauge,
  ImageUp,
  Loader2,
  Maximize2,
  RefreshCcw,
  Timer,
  Upload
} from "lucide-react";
import type {
  ExportSize,
  FrameStyle,
  OutputFormat,
  RenderRequest,
  RenderResult,
  RenderSettings,
  WorkerResponse
} from "./types";

type PreviewState = RenderResult & { url: string };

const styleOptions: Array<{ value: FrameStyle; label: string }> = [
  { value: "signature", label: "签名" },
  { value: "gallery", label: "画廊" },
  { value: "editorial", label: "杂志" },
  { value: "proof", label: "校样" },
  { value: "poster", label: "海报" },
  { value: "pure", label: "纯净" }
];

const exportOptions: Array<{ value: ExportSize; label: string; hint: string }> = [
  { value: "social", label: "3000", hint: "长边" },
  { value: "high", label: "5000", hint: "高清" },
  { value: "source", label: "原图", hint: "尺寸" }
];

const formatOptions: Array<{ value: OutputFormat; label: string }> = [
  { value: "image/jpeg", label: "JPG" },
  { value: "image/png", label: "PNG" }
];

const defaultSettings: RenderSettings = {
  frameStyle: "signature",
  exportSize: "social",
  outputFormat: "image/jpeg",
  quality: 0.92,
  title: "",
  author: "",
  showCamera: true,
  showLens: true,
  showDate: true
};

function renderPhoto(
  file: File,
  settings: RenderSettings,
  purpose: "preview" | "export",
  onStage: (stage: string) => void
) {
  const worker = new Worker(new URL("./workers/photoWorker.ts", import.meta.url), {
    type: "module"
  });
  const id = crypto.randomUUID();
  let settled = false;

  const promise = new Promise<RenderResult>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.id !== id) return;

      if (message.type === "stage") {
        onStage(message.stage);
        return;
      }

      settled = true;
      worker.terminate();

      if (message.type === "done") {
        resolve(message.result);
      } else {
        reject(new Error(message.message));
      }
    };

    worker.onerror = (event) => {
      settled = true;
      worker.terminate();
      reject(new Error(event.message || "Worker 处理失败"));
    };
  });

  const request: RenderRequest = {
    id,
    type: "render",
    file,
    settings,
    purpose
  };
  worker.postMessage(request);

  return {
    promise,
    cancel: () => {
      if (!settled) worker.terminate();
    }
  };
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[index]}`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function outputName(file: File, format: OutputFormat) {
  const base = file.name.replace(/\.[^.]+$/, "") || "photo";
  return `${base}-exif-frame.${format === "image/png" ? "png" : "jpg"}`;
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [settings, setSettings] = useState<RenderSettings>(defaultSettings);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const requestRef = useRef(0);

  const previewSettings = useMemo<RenderSettings>(
    () => ({
      ...settings,
      exportSize: "preview",
      outputFormat: "image/jpeg",
      quality: 0.88
    }),
    [settings]
  );

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!file) return;

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setIsRendering(true);
    setError("");
    setStage("准备照片");

    const job = renderPhoto(file, previewSettings, "preview", setStage);

    job.promise
      .then((result) => {
        if (requestRef.current !== requestId) return;

        const url = URL.createObjectURL(result.blob);
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = url;
        setPreview({ ...result, url });
        setStage("");
      })
      .catch((caught: Error) => {
        if (requestRef.current !== requestId) return;
        setError(caught.message);
        setStage("");
      })
      .finally(() => {
        if (requestRef.current === requestId) setIsRendering(false);
      });

    return () => job.cancel();
  }, [file, previewSettings]);

  const receiveFiles = (files: FileList | File[]) => {
    const nextFile = Array.from(files).find((item) => item.type.startsWith("image/"));
    if (!nextFile) {
      setError("请选择图片文件");
      return;
    }
    setFile(nextFile);
    setPreview(null);
    setError("");
  };

  const updateSetting = <K extends keyof RenderSettings>(key: K, value: RenderSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const handleExport = async () => {
    if (!file) return;

    setIsExporting(true);
    setError("");
    setStage("准备导出");

    const job = renderPhoto(file, settings, "export", setStage);
    try {
      const result = await job.promise;
      downloadBlob(result.blob, outputName(file, settings.outputFormat));
      setStage("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "导出失败");
    } finally {
      setIsExporting(false);
    }
  };

  const meta = preview?.exif.display;
  const sourceSize = preview ? `${preview.source.width} × ${preview.source.height}` : "—";
  const outputSize = preview ? `${preview.output.width} × ${preview.output.height}` : "—";

  return (
    <main className="app-shell">
      <section className="left-rail" aria-label="EXIF frame controls">
        <header className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <Camera size={22} />
          </div>
          <div>
            <p className="eyebrow">DIY EXIF</p>
            <h1>照片边框</h1>
          </div>
        </header>

        <div
          className={`dropzone ${isDragging ? "is-dragging" : ""} ${file ? "has-file" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            receiveFiles(event.dataTransfer.files);
          }}
        >
          <input
            ref={inputRef}
            className="file-input"
            type="file"
            accept="image/jpeg,image/png,image/tiff,image/webp,image/*"
            onChange={(event) => {
              if (event.target.files) receiveFiles(event.target.files);
            }}
          />
          <div className="dropzone-copy">
            <ImageUp size={28} />
            <div>
              <strong>{file ? file.name : "拖入一张照片"}</strong>
              <span>{file ? formatBytes(file.size) : "JPEG / TIFF / PNG / WebP"}</span>
            </div>
          </div>
          <button className="primary-action" type="button" onClick={() => inputRef.current?.click()}>
            <Upload size={18} />
            选择照片
          </button>
        </div>

        <section className="control-block">
          <div className="control-heading">
            <span>边框</span>
            <RefreshCcw size={16} aria-hidden="true" />
          </div>
          <div className="segmented" role="group" aria-label="边框样式">
            {styleOptions.map((option) => (
              <button
                key={option.value}
                className={settings.frameStyle === option.value ? "is-active" : ""}
                type="button"
                onClick={() => updateSetting("frameStyle", option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="control-block">
          <div className="control-heading">
            <span>尺寸</span>
            <Maximize2 size={16} aria-hidden="true" />
          </div>
          <div className="size-options" role="group" aria-label="导出尺寸">
            {exportOptions.map((option) => (
              <button
                key={option.value}
                className={settings.exportSize === option.value ? "is-active" : ""}
                type="button"
                onClick={() => updateSetting("exportSize", option.value)}
              >
                <strong>{option.label}</strong>
                <span>{option.hint}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="control-block">
          <div className="control-heading">
            <span>格式</span>
            <FileImage size={16} aria-hidden="true" />
          </div>
          <div className="format-row">
            <div className="segmented compact" role="group" aria-label="导出格式">
              {formatOptions.map((option) => (
                <button
                  key={option.value}
                  className={settings.outputFormat === option.value ? "is-active" : ""}
                  type="button"
                  onClick={() => updateSetting("outputFormat", option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className="quality-control">
              <span>{Math.round(settings.quality * 100)}</span>
              <input
                type="range"
                min="70"
                max="98"
                value={Math.round(settings.quality * 100)}
                disabled={settings.outputFormat === "image/png"}
                onChange={(event) => updateSetting("quality", Number(event.target.value) / 100)}
              />
            </label>
          </div>
        </section>

        <section className="control-block">
          <div className="control-heading">
            <span>作品信息</span>
            <Camera size={16} aria-hidden="true" />
          </div>
          <div className="text-field-stack">
            <label>
              <span>标题</span>
              <input
                type="text"
                maxLength={60}
                placeholder="未命名作品"
                value={settings.title}
                onChange={(event) => updateSetting("title", event.target.value)}
              />
            </label>
            <label>
              <span>作者</span>
              <input
                type="text"
                maxLength={40}
                placeholder="摄影师姓名"
                value={settings.author}
                onChange={(event) => updateSetting("author", event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="control-block">
          <div className="toggle-stack">
            <label>
              <input
                type="checkbox"
                checked={settings.showCamera}
                onChange={(event) => updateSetting("showCamera", event.target.checked)}
              />
              <span>机身</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.showLens}
                onChange={(event) => updateSetting("showLens", event.target.checked)}
              />
              <span>镜头</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.showDate}
                onChange={(event) => updateSetting("showDate", event.target.checked)}
              />
              <span>日期</span>
            </label>
          </div>
        </section>

        <section className="metadata-grid" aria-label="Photo metadata">
          <div>
            <Camera size={16} />
            <span>机身</span>
            <strong>{meta?.camera || "—"}</strong>
          </div>
          <div>
            <Aperture size={16} />
            <span>镜头</span>
            <strong>{meta?.lens || "—"}</strong>
          </div>
          <div>
            <Gauge size={16} />
            <span>参数</span>
            <strong>{meta?.settingsLine || "—"}</strong>
          </div>
          <div>
            <Timer size={16} />
            <span>日期</span>
            <strong>{meta?.date || "—"}</strong>
          </div>
          <div>
            <Maximize2 size={16} />
            <span>原图</span>
            <strong>{sourceSize}</strong>
          </div>
          <div>
            <FileImage size={16} />
            <span>预览</span>
            <strong>{outputSize}</strong>
          </div>
        </section>

        {preview?.warnings.length ? (
          <div className="warning-stack">
            {preview.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}
      </section>

      <section className="preview-stage" aria-label="Frame preview">
        <div className="top-bar">
          <div>
            <p className="eyebrow">本地渲染</p>
            <h2>{file ? file.name : "选择照片后开始预览"}</h2>
          </div>
          <button
            className="download-action"
            type="button"
            disabled={!file || isRendering || isExporting}
            onClick={handleExport}
          >
            {isExporting ? <Loader2 className="spin" size={18} /> : <Download size={18} />}
            导出
          </button>
        </div>

        <div className={`canvas-view ${preview ? "has-preview" : ""}`}>
          {preview ? (
            <img src={preview.url} alt="EXIF frame preview" />
          ) : (
            <div className="empty-preview">
              <FileImage size={42} />
              <span>预览将在这里生成</span>
            </div>
          )}

          {(isRendering || isExporting || stage) && (
            <div className="render-status">
              {isRendering || isExporting ? <Loader2 className="spin" size={18} /> : <Check size={18} />}
              <span>{stage || "处理中"}</span>
            </div>
          )}
        </div>

        {error && <div className="error-banner">{error}</div>}
      </section>
    </main>
  );
}

export default App;
