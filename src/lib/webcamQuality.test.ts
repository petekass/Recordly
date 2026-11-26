import { describe, expect, it } from "vitest";
import {
	computeWebcamBitrate,
	DEFAULT_WEBCAM_QUALITY,
	getWebcamVideoConstraints,
	normalizeWebcamQuality,
} from "./webcamQuality";

describe("webcam quality", () => {
	it("falls back to the default for unknown values", () => {
		expect(normalizeWebcamQuality("8k")).toBe(DEFAULT_WEBCAM_QUALITY);
		expect(normalizeWebcamQuality(undefined)).toBe(DEFAULT_WEBCAM_QUALITY);
		expect(normalizeWebcamQuality("4k30")).toBe("4k30");
	});

	it("requests the preset resolution and caps the frame rate", () => {
		expect(getWebcamVideoConstraints("4k30", "cam-1")).toEqual({
			deviceId: { exact: "cam-1" },
			width: { ideal: 3840 },
			height: { ideal: 2160 },
			frameRate: { ideal: 30, max: 30 },
		});
		expect(getWebcamVideoConstraints("1080p60")).not.toHaveProperty("deviceId");
	});

	it("scales the bitrate with the negotiated mode within bounds", () => {
		expect(computeWebcamBitrate(1920, 1080, 30, "1080p30")).toBe(12_441_600);
		expect(computeWebcamBitrate(640, 480, 30, "1080p30")).toBe(8_000_000);
		expect(computeWebcamBitrate(3840, 2160, 60, "4k30")).toBe(60_000_000);
		expect(computeWebcamBitrate(undefined, undefined, undefined, "4k30")).toBe(49_766_400);
	});
});
