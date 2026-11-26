import {
	DEFAULT_WEBCAM_QUALITY,
	getWebcamVideoConstraints,
	type WebcamQuality,
} from "@/lib/webcamQuality";

export interface WebcamCapture {
	stream: MediaStream;
	release: () => void;
}

interface ActiveWebcam {
	request: Promise<MediaStream>;
	stream?: MediaStream;
	users: number;
	quality: WebcamQuality;
}

// Keyed by device and quality: preview and recorder share one stream per mode.
const activeWebcams = new Map<string, ActiveWebcam>();
const captureKey = (deviceId: string | undefined, quality: WebcamQuality) =>
	`${deviceId ?? ""}|${quality}`;

export async function acquireWebcamCapture(
	deviceId?: string,
	quality: WebcamQuality = DEFAULT_WEBCAM_QUALITY,
): Promise<WebcamCapture> {
	if (deviceId === "default") deviceId = undefined;
	let capture = activeWebcams.get(captureKey(deviceId, quality));
	if (!capture && deviceId) {
		capture = [...activeWebcams.values()].find(
			(candidate) =>
				candidate.quality === quality &&
				candidate.stream?.active &&
				candidate.stream.getVideoTracks()[0]?.getSettings().deviceId === deviceId,
		);
		const defaultCapture = activeWebcams.get(captureKey(undefined, quality));
		if (!capture && defaultCapture && !defaultCapture.stream) {
			const pendingDefault = await retainWebcam(defaultCapture).catch(() => undefined);
			if (
				pendingDefault?.stream.active &&
				pendingDefault.stream.getVideoTracks()[0]?.getSettings().deviceId === deviceId
			) {
				return pendingDefault;
			}
			pendingDefault?.release();
			return acquireWebcamCapture(deviceId, quality);
		}
	}
	if (!capture || capture.stream?.active === false) {
		capture = {
			request: navigator.mediaDevices.getUserMedia({
				audio: false,
				video: getWebcamVideoConstraints(quality, deviceId),
			}),
			users: 0,
			quality,
		};
		activeWebcams.set(captureKey(deviceId, quality), capture);
	}
	return retainWebcam(capture);
}

async function retainWebcam(shared: ActiveWebcam): Promise<WebcamCapture> {
	shared.users++;
	let released = false;
	const release = () => {
		if (released) return;
		released = true;
		shared.users--;
		if (shared.users !== 0) return;
		for (const [id, webcam] of activeWebcams) {
			if (webcam === shared) activeWebcams.delete(id);
		}
		shared.stream?.getTracks().forEach((track) => track.stop());
	};

	try {
		shared.stream = await shared.request;
		return { stream: shared.stream, release };
	} catch (error) {
		release();
		throw error;
	}
}
