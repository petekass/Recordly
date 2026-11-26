export const WEBCAM_QUALITY_PRESETS = ["720p30", "1080p30", "1080p60", "4k30"] as const;

export type WebcamQuality = (typeof WEBCAM_QUALITY_PRESETS)[number];

export const DEFAULT_WEBCAM_QUALITY: WebcamQuality = "1080p30";

interface WebcamQualitySpec {
	width: number;
	height: number;
	frameRate: number;
	label: string;
}

const SPECS: Record<WebcamQuality, WebcamQualitySpec> = {
	"720p30": { width: 1280, height: 720, frameRate: 30, label: "720p · 30 fps" },
	"1080p30": { width: 1920, height: 1080, frameRate: 30, label: "1080p · 30 fps" },
	"1080p60": { width: 1920, height: 1080, frameRate: 60, label: "1080p · 60 fps" },
	"4k30": { width: 3840, height: 2160, frameRate: 30, label: "4K · 30 fps" },
};

export function normalizeWebcamQuality(value: unknown): WebcamQuality {
	return typeof value === "string" &&
		(WEBCAM_QUALITY_PRESETS as readonly string[]).includes(value)
		? (value as WebcamQuality)
		: DEFAULT_WEBCAM_QUALITY;
}

export function getWebcamQualitySpec(quality: WebcamQuality): WebcamQualitySpec {
	return SPECS[quality];
}

/**
 * Ideal constraints only: a camera without the requested mode falls back to its
 * closest one instead of failing. The frame rate cap keeps a 4K request from
 * being satisfied by a lower-resolution high-fps mode.
 */
export function getWebcamVideoConstraints(
	quality: WebcamQuality,
	deviceId?: string,
): MediaTrackConstraints {
	const spec = SPECS[quality];
	return {
		...(deviceId && { deviceId: { exact: deviceId } }),
		width: { ideal: spec.width },
		height: { ideal: spec.height },
		// Without it Chromium may pick a rotated portrait mode (1080x1920) as the
		// closest match to 4K on a 1080p camera.
		aspectRatio: { ideal: spec.width / spec.height },
		frameRate: { ideal: spec.frameRate, max: spec.frameRate },
	};
}

const MIN_WEBCAM_BITRATE = 8_000_000;
const MAX_WEBCAM_BITRATE = 60_000_000;
// About 0.2 bits per pixel per frame: visually clean H.264 for talking-head footage.
const BITS_PER_PIXEL_FRAME = 0.2;

/** Recorder bitrate from the negotiated track settings, so a fallback mode is not over-allocated. */
export function computeWebcamBitrate(
	width: number | undefined,
	height: number | undefined,
	frameRate: number | undefined,
	quality: WebcamQuality,
): number {
	const spec = SPECS[quality];
	const w = width && width > 0 ? width : spec.width;
	const h = height && height > 0 ? height : spec.height;
	const fps = frameRate && frameRate > 0 ? Math.min(frameRate, 60) : spec.frameRate;
	const bitrate = Math.round(w * h * fps * BITS_PER_PIXEL_FRAME);
	return Math.min(MAX_WEBCAM_BITRATE, Math.max(MIN_WEBCAM_BITRATE, bitrate));
}
