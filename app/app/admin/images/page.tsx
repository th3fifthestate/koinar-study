"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { getStyleOptions, getAspectRatioOptions } from "@/lib/images/prompt-builder";
import { SEASONAL_THEMES } from "@/lib/images/seasonal";
import type { StudyImage } from "@/lib/images/queries";
import type { ImageStyle, AspectRatio } from "@/lib/images/prompt-builder";
import type { Season } from "@/lib/images/seasonal";

interface Study {
  id: number;
  title: string;
  content_markdown: string;
}

const STYLE_OPTIONS = getStyleOptions();
const ASPECT_RATIO_OPTIONS = getAspectRatioOptions();

// ---------------------------------------------------------------------------
// Study selector
// ---------------------------------------------------------------------------

function StudySelector({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (study: Study) => void;
}) {
  const [studies, setStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/studies")
      .then((r) => r.json())
      .then((data) => {
        setStudies(data.studies ?? []);
      })
      .catch(() => toast.error("Failed to load studies"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-10 w-full" />;

  return (
    <Select
      value={value?.toString() ?? ""}
      onValueChange={(val) => {
        const study = studies.find((s) => s.id.toString() === val);
        if (study) onChange(study);
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select a study..." />
      </SelectTrigger>
      <SelectContent>
        {studies.map((s) => (
          <SelectItem key={s.id} value={s.id.toString()}>
            {s.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------------------------------------------------------------------------
// Image generator
// ---------------------------------------------------------------------------

interface GenerateResult {
  preview: string;
  taskId: string;
  estimatedCost: string;
  sizeBytes: number;
}

function ImageGenerator({
  study,
  onImageAttached,
}: {
  study: Study;
  onImageAttached: () => void;
}) {
  const [style, setStyle] = useState<ImageStyle>("cinematic");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [model, setModel] = useState<"flux-2-pro" | "flux-2-max">("flux-2-pro");
  const [prompt, setPrompt] = useState("");
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [isHero, setIsHero] = useState(false);
  const [attaching, setAttaching] = useState(false);

  const costPerImage = model === "flux-2-max" ? "$0.20" : "$0.05";

  const suggestPrompt = useCallback(async () => {
    setLoadingPrompt(true);
    try {
      const res = await fetch("/api/admin/images/suggest-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studyTitle: study.title,
          studyContent: study.content_markdown.slice(0, 4000),
          style,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to suggest prompt");
      setPrompt(data.suggestedPrompt);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to suggest prompt");
    } finally {
      setLoadingPrompt(false);
    }
  }, [study, style]);

  // Auto-suggest on study/style change
  useEffect(() => {
    setResult(null);
    suggestPrompt();
  }, [study.id, style]); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studyId: study.id,
          prompt,
          style,
          aspectRatio,
          model,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setResult(data);
      toast.success("Image generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const attach = async () => {
    if (!result) return;
    setAttaching(true);
    try {
      // Strip data:image/png;base64, prefix
      const base64 = result.preview.replace(/^data:image\/\w+;base64,/, "");
      const dims = ASPECT_RATIO_OPTIONS.find((a) => a.value === aspectRatio);
      const [w, h] = dims
        ? dims.dimensions.split("x").map(Number)
        : [1920, 1080];

      const res = await fetch("/api/admin/images/attach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studyId: study.id,
          imageBase64: base64,
          fluxPrompt: prompt,
          style,
          aspectRatio,
          width: w,
          height: h,
          isHero,
          fluxTaskId: result.taskId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to attach image");
      toast.success("Image attached to study");
      setResult(null);
      onImageAttached();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to attach image");
    } finally {
      setAttaching(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Generate Image for: {study.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Style</Label>
            <Select value={style} onValueChange={(v) => setStyle(v as ImageStyle)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STYLE_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Aspect Ratio</Label>
            <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as AspectRatio)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASPECT_RATIO_OPTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Model</Label>
            <Select value={model} onValueChange={(v) => setModel(v as "flux-2-pro" | "flux-2-max")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flux-2-pro">Flux 2 Pro (~$0.05)</SelectItem>
                <SelectItem value="flux-2-max">Flux 2 Max (~$0.20)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Prompt */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Prompt</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={suggestPrompt}
              disabled={loadingPrompt}
              className="h-6 text-xs"
            >
              {loadingPrompt ? "Suggesting..." : "Re-suggest"}
            </Button>
          </div>
          {loadingPrompt ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Describe the scene..."
              className="text-sm"
            />
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Est. cost: {costPerImage}</span>
          <Button onClick={generate} disabled={generating || loadingPrompt} size="sm">
            {generating ? "Generating... (10-30s)" : "Generate Preview"}
          </Button>
        </div>

        {/* Preview */}
        {generating && (
          <div className="space-y-2">
            <Skeleton className="h-48 w-full rounded-md" />
            <p className="text-center text-xs text-muted-foreground">
              Generating image, please wait...
            </p>
          </div>
        )}

        {result && !generating && (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.preview}
              alt="Generated preview"
              className="w-full rounded-md border"
            />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch id="hero" checked={isHero} onCheckedChange={setIsHero} />
                <Label htmlFor="hero" className="text-sm cursor-pointer">
                  Set as hero image
                </Label>
              </div>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" onClick={generate} disabled={generating}>
                  Regenerate
                </Button>
                <Button size="sm" onClick={attach} disabled={attaching}>
                  {attaching ? "Uploading..." : "Accept & Attach"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Image gallery (existing images for selected study)
// ---------------------------------------------------------------------------

function ImageGallery({
  studyId,
  refreshKey,
}: {
  studyId: number;
  refreshKey: number;
}) {
  const [images, setImages] = useState<StudyImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<StudyImage | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/studies/${studyId}/images`);
      if (!res.ok) throw new Error("Failed to load images");
      const data = await res.json();
      setImages(data.images ?? []);
    } catch {
      toast.error("Failed to load study images");
    } finally {
      setLoading(false);
    }
  }, [studyId]);

  useEffect(() => {
    loadImages();
  }, [loadImages, refreshKey]);

  const moveImage = async (index: number, direction: "up" | "down") => {
    const newImages = [...images];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newImages.length) return;
    [newImages[index], newImages[swapIndex]] = [newImages[swapIndex], newImages[index]];
    setImages(newImages);

    try {
      const res = await fetch("/api/admin/images/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studyId,
          imageIds: newImages.map((img) => img.id),
        }),
      });
      if (!res.ok) throw new Error("Reorder failed");
    } catch {
      toast.error("Failed to save order");
      loadImages(); // reload to reset
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/images/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Image deleted");
      setDeleteTarget(null);
      loadImages();
    } catch {
      toast.error("Failed to delete image");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No images yet. Generate and attach one above.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {images.map((img, index) => (
          <div
            key={img.id}
            className="flex items-start gap-3 p-3 border rounded-lg bg-card"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.image_url}
              alt="Study image"
              className="h-20 w-32 object-cover rounded shrink-0"
            />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  {img.style}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {img.aspect_ratio}
                </Badge>
                {img.is_hero && (
                  <Badge className="text-xs">Hero</Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {img.width}×{img.height}
                </span>
                {img.size_bytes && (
                  <span className="text-xs text-muted-foreground">
                    {(img.size_bytes / 1024).toFixed(0)} KB
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {img.flux_prompt ?? "No prompt recorded"}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(img.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => moveImage(index, "up")}
                disabled={index === 0}
                className="h-7 w-7 p-0"
              >
                ↑
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => moveImage(index, "down")}
                disabled={index === images.length - 1}
                className="h-7 w-7 p-0"
              >
                ↓
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteTarget(img)}
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              >
                ×
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete image?</DialogTitle>
            <DialogDescription>
              This will permanently delete the image from R2 storage and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Seasonal image generator
// ---------------------------------------------------------------------------

function SeasonalGenerator() {
  const [season, setSeason] = useState<Season>("spring");
  const [style, setStyle] = useState<ImageStyle>("cinematic");
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<{ src: string; taskId: string } | null>(null);
  const [attaching, setAttaching] = useState(false);

  const generate = async () => {
    setGenerating(true);
    setPreview(null);
    try {
      // Build a seasonal prompt inline
      const theme = SEASONAL_THEMES.find((t) => t.season === season);
      if (!theme) throw new Error("Unknown season");
      const prompt = theme.prompts[style];

      const res = await fetch("/api/admin/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studyId: 0, // seasonal images aren't tied to a study
          prompt,
          style,
          aspectRatio: "16:9",
          model: "flux-2-pro",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setPreview({ src: data.preview, taskId: data.taskId });
      toast.success("Seasonal image generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const attach = async () => {
    if (!preview) return;
    setAttaching(true);
    try {
      const base64 = preview.src.replace(/^data:image\/\w+;base64,/, "");
      const theme = SEASONAL_THEMES.find((t) => t.season === season);
      const prompt = theme?.prompts[style] ?? "";

      const res = await fetch("/api/admin/images/seasonal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          season,
          imageBase64: base64,
          fluxPrompt: prompt,
          style,
          fluxTaskId: preview.taskId,
          setActive: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save seasonal image");
      toast.success("Seasonal image saved and set as active");
      setPreview(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save seasonal image");
    } finally {
      setAttaching(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Seasonal Backgrounds</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Season</Label>
            <Select value={season} onValueChange={(v) => setSeason(v as Season)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEASONAL_THEMES.map((t) => (
                  <SelectItem key={t.season} value={t.season}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Style</Label>
            <Select value={style} onValueChange={(v) => setStyle(v as ImageStyle)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STYLE_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Est. cost: $0.05</span>
          <Button onClick={generate} disabled={generating} size="sm">
            {generating ? "Generating... (10-30s)" : "Generate Seasonal Image"}
          </Button>
        </div>

        {generating && <Skeleton className="h-40 w-full rounded-md" />}

        {preview && !generating && (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.src}
              alt="Seasonal preview"
              className="w-full rounded-md border"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={generate} disabled={generating}>
                Regenerate
              </Button>
              <Button size="sm" onClick={attach} disabled={attaching}>
                {attaching ? "Saving..." : "Set as Active Background"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminImagesPage() {
  const [selectedStudy, setSelectedStudy] = useState<Study | null>(null);
  const [galleryRefreshKey, setGalleryRefreshKey] = useState(0);

  const handleImageAttached = () => {
    setGalleryRefreshKey((k) => k + 1);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Image Generation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate AI images for Bible studies using Flux 2 Pro/Max. Admin-only.
        </p>
      </div>

      {/* Study selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label>Select Study</Label>
            <StudySelector
              value={selectedStudy?.id ?? null}
              onChange={setSelectedStudy}
            />
          </div>
        </CardContent>
      </Card>

      {selectedStudy && (
        <>
          {/* Generator */}
          <ImageGenerator study={selectedStudy} onImageAttached={handleImageAttached} />

          {/* Existing images */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Existing Images for &quot;{selectedStudy.title}&quot;
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ImageGallery studyId={selectedStudy.id} refreshKey={galleryRefreshKey} />
            </CardContent>
          </Card>
        </>
      )}

      {/* Seasonal backgrounds */}
      <SeasonalGenerator />
    </div>
  );
}
