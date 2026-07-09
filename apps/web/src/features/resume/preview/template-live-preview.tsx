import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { Template } from "@reactive-resume/schema/templates";
import { useEffect, useRef, useState } from "react";
import { Spinner } from "@reactive-resume/ui/components/spinner";
import { cn } from "@reactive-resume/utils/style";
import { createResumePdfBlob } from "@/features/resume/export/pdf-document";
import { createPdfFirstPageImageUrl } from "./pdf-thumbnail";

// Bounded FIFO cache of generated object URLs keyed by (data, template) reference. Evicted entries are
// revoked so blobs don't leak; stale-data entries (a new `data` object after an edit) age out via the cap.
// ponytail: cap-24 linear scan — gallery can show ~20 templates at once.
const PREVIEW_CACHE_LIMIT = 24;
type PreviewCacheEntry = { data: ResumeData; template: Template; url: string };
const previewCache: PreviewCacheEntry[] = [];

const getCachedPreview = (data: ResumeData, template: Template) =>
	previewCache.find((entry) => entry.data === data && entry.template === template)?.url;

const setCachedPreview = (data: ResumeData, template: Template, url: string) => {
	previewCache.push({ data, template, url });
	while (previewCache.length > PREVIEW_CACHE_LIMIT) {
		const evicted = previewCache.shift();
		if (evicted) URL.revokeObjectURL(evicted.url);
	}
};

// Serial render pipeline shared across all instances: PDFs generate one-at-a-time on the main thread
// (serialized through `renderQueue`) so the gallery doesn't spike CPU/memory when all tiles mount at once.
// Per-instance `latestRenderRequestId` ref (not global) ensures that if a component re-renders with new
// props it discards its own superseded work without cancelling renders for other tiles.
let renderQueue: Promise<void> = Promise.resolve();

type TemplateLivePreviewProps = {
	alt: string;
	className?: string;
	data: ResumeData;
	fallbackSrc: string;
	template: Template;
};

/**
 * Renders the first page of the user's actual resume data through a given template, lazily.
 * Reuses the browser PDF pipeline (`createResumePdfBlob` + pdf.js first-page render). Falls back to the
 * static template image while generating or if generation fails. Intended to be mounted on demand (e.g.
 * inside a hover/preview card) so the render stays off the hover critical path.
 */
export function TemplateLivePreview({ alt, className, data, fallbackSrc, template }: TemplateLivePreviewProps) {
	const [imageUrl, setImageUrl] = useState<string | null>(() => getCachedPreview(data, template) ?? null);
	const [hasError, setHasError] = useState(false);
	// Per-instance counter: only the latest render request for THIS tile commits its result.
	const latestRequestId = useRef(0);

	useEffect(() => {
		const cached = getCachedPreview(data, template);
		if (cached) {
			setImageUrl(cached);
			return;
		}

		let cancelled = false;
		const requestId = ++latestRequestId.current;

		renderQueue = renderQueue.then(async () => {
			if (cancelled || requestId !== latestRequestId.current) return;

			// Another instance may have cached this exact preview while we were queued.
			const existing = getCachedPreview(data, template);
			if (existing) {
				setImageUrl(existing);
				return;
			}

			try {
				const blob = await createResumePdfBlob(data, template);
				const url = await createPdfFirstPageImageUrl(blob);

				if (cancelled || requestId !== latestRequestId.current) {
					URL.revokeObjectURL(url);
					return;
				}

				setCachedPreview(data, template, url);
				setImageUrl(url);
			} catch {
				if (!cancelled) setHasError(true);
			}
		});

		return () => {
			cancelled = true;
		};
	}, [data, template]);

	const isLoading = !imageUrl && !hasError;

	return (
		<div className={cn("relative aspect-page w-full overflow-hidden rounded-md bg-white", className)}>
			<img src={imageUrl ?? fallbackSrc} alt={alt} className="size-full object-contain" />
			{isLoading ? (
				<div className="absolute inset-0 flex items-center justify-center bg-white/40">
					<Spinner className="size-8" />
				</div>
			) : null}
		</div>
	);
}
