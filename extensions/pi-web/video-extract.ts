import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, extname, basename, join, dirname } from "node:path";
import { homedir } from "node:os";
import { activityMonitor } from "./activity.js";
import { isAnthropicWebAvailable } from "./anthropic-web.js";
import { extractHeadingTitle, type ExtractedContent, type ExtractOptions, type FrameResult, type VideoFrame } from "./extract.js";
import { readExecError, trimErrorText, mapFfmpegError, formatSeconds } from "./utils.js";

const CONFIG_PATH = join(homedir(), ".pi", "web-search.json");

const DEFAULT_VIDEO_PROMPT = `Extract the complete content of this video. Include:
1. Video title (infer from content if not explicit), duration
2. A brief summary (2-3 sentences)
3. Full transcript with timestamps
4. Descriptions of any code, terminal commands, diagrams, slides, or UI shown on screen

Format as markdown.`;

const VIDEO_EXTENSIONS: Record<string, string> = {
	".mp4": "video/mp4",
	".mov": "video/quicktime",
	".webm": "video/webm",
	".avi": "video/x-msvideo",
	".mpeg": "video/mpeg",
	".mpg": "video/mpeg",
	".wmv": "video/x-ms-wmv",
	".flv": "video/x-flv",
	".3gp": "video/3gpp",
	".3gpp": "video/3gpp",
};

interface VideoFileInfo {
	absolutePath: string;
	mimeType: string;
	sizeBytes: number;
}

interface VideoConfig {
	enabled: boolean;
	preferredModel: string;
	maxSizeMB: number;
}

const VIDEO_CONFIG_DEFAULTS: VideoConfig = {
	enabled: true,
	preferredModel: "claude-haiku-4-5",
	maxSizeMB: 50,
};

let cachedVideoConfig: VideoConfig | null = null;

function loadVideoConfig(): VideoConfig {
	if (cachedVideoConfig) return cachedVideoConfig;
	try {
		if (existsSync(CONFIG_PATH)) {
			const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
			const v = raw.video ?? {};
			cachedVideoConfig = {
				enabled: v.enabled ?? VIDEO_CONFIG_DEFAULTS.enabled,
				preferredModel: v.preferredModel ?? VIDEO_CONFIG_DEFAULTS.preferredModel,
				maxSizeMB: v.maxSizeMB ?? VIDEO_CONFIG_DEFAULTS.maxSizeMB,
			};
			return cachedVideoConfig;
		}
	} catch {}
	cachedVideoConfig = { ...VIDEO_CONFIG_DEFAULTS };
	return cachedVideoConfig;
}

export function isVideoFile(input: string): VideoFileInfo | null {
	const config = loadVideoConfig();
	if (!config.enabled) return null;

	const isFilePath = input.startsWith("/") || input.startsWith("./") || input.startsWith("../") || input.startsWith("file://");
	if (!isFilePath) return null;

	const filePath = input.startsWith("file://") ? new URL(input).pathname : input;

	const ext = extname(filePath).toLowerCase();
	const mimeType = VIDEO_EXTENSIONS[ext];
	if (!mimeType) return null;

	const absolutePath = resolveFilePath(filePath);
	if (!absolutePath) return null;

	const stat = statSync(absolutePath);
	if (!stat.isFile()) return null;

	const maxBytes = config.maxSizeMB * 1024 * 1024;
	if (stat.size > maxBytes) return null;

	return { absolutePath, mimeType, sizeBytes: stat.size };
}

function resolveFilePath(filePath: string): string | null {
	const absolutePath = resolve(filePath);
	if (existsSync(absolutePath)) return absolutePath;

	const dir = dirname(absolutePath);
	const base = basename(absolutePath);
	if (!existsSync(dir)) return null;

	try {
		const normalizedBase = normalizeSpaces(base);
		const match = readdirSync(dir).find(f => normalizeSpaces(f) === normalizedBase);
		return match ? join(dir, match) : null;
	} catch {
		return null;
	}
}

function normalizeSpaces(s: string): string {
	return s.replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, " ");
}

export async function extractVideo(
	info: VideoFileInfo,
	signal?: AbortSignal,
	options?: ExtractOptions,
): Promise<ExtractedContent | null> {
	const config = loadVideoConfig();
	const effectivePrompt = options?.prompt ?? DEFAULT_VIDEO_PROMPT;
	const displayName = basename(info.absolutePath);
	const activityId = activityMonitor.logStart({ type: "fetch", url: `video:${displayName}` });

	const result = await tryAnthropicVideoFrames(info, effectivePrompt, signal);

	if (result) {
		const thumbnail = await extractVideoFrame(info.absolutePath);
		if (!("error" in thumbnail)) {
			result.thumbnail = thumbnail;
		}
		activityMonitor.logComplete(activityId, 200);
		return result;
	}

	activityMonitor.logError(activityId, "video extraction failed");
	return null;
}

function mapFfprobeError(err: unknown): string {
	const { code, stderr, message } = readExecError(err);
	if (code === "ENOENT") return "ffprobe is not installed. Install ffmpeg which includes ffprobe";
	const snippet = trimErrorText(stderr || message);
	return snippet ? `ffprobe failed: ${snippet}` : "ffprobe failed";
}

export async function extractVideoFrame(filePath: string, seconds: number = 1): Promise<FrameResult> {
	try {
		const { execFileSync } = await import("node:child_process");
		const buffer = execFileSync("ffmpeg", [
			"-ss", String(seconds), "-i", filePath,
			"-frames:v", "1", "-f", "image2pipe", "-vcodec", "mjpeg", "pipe:1",
		], { maxBuffer: 5 * 1024 * 1024, timeout: 10000, stdio: ["pipe", "pipe", "pipe"] });
		if (buffer.length === 0) return { error: "ffmpeg failed: empty output" };
		return { data: buffer.toString("base64"), mimeType: "image/jpeg" };
	} catch (err) {
		return { error: mapFfmpegError(err) };
	}
}

export async function getLocalVideoDuration(filePath: string): Promise<number | { error: string }> {
	try {
		const { execFileSync } = await import("node:child_process");
		const output = execFileSync("ffprobe", [
			"-v", "quiet",
			"-show_entries", "format=duration",
			"-of", "csv=p=0",
			filePath,
		], { timeout: 10000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
		const duration = Number.parseFloat(output);
		if (!Number.isFinite(duration)) return { error: "ffprobe failed: invalid duration output" };
		return duration;
	} catch (err) {
		return { error: mapFfprobeError(err) };
	}
}

async function queryAnthropicWithFrames(
	prompt: string,
	frames: VideoFrame[],
	signal?: AbortSignal,
): Promise<string | null> {
	const apiKey = process.env.ANTHROPIC_API_KEY
		|| (() => { try { return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")).anthropicApiKey; } catch { return null; } })();
	if (!apiKey) return null;

	const content: Array<Record<string, unknown>> = [];
	for (const frame of frames) {
		content.push({ type: "text", text: `Frame at ${frame.timestamp}:` });
		content.push({
			type: "image",
			source: { type: "base64", media_type: frame.mimeType, data: frame.data },
		});
	}
	content.push({ type: "text", text: prompt });

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 120000);
	if (signal) {
		signal.addEventListener("abort", () => { clearTimeout(timer); controller.abort(signal.reason); }, { once: true });
	}

	try {
		const res = await fetch("https://api.anthropic.com/v1/messages", {
			method: "POST",
			headers: {
				"x-api-key": apiKey,
				"anthropic-version": "2023-06-01",
				"content-type": "application/json",
			},
			body: JSON.stringify({
				model: "claude-haiku-4-5",
				max_tokens: 4096,
				messages: [{ role: "user", content }],
			}),
			signal: controller.signal,
		});
		clearTimeout(timer);
		if (!res.ok) return null;
		const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
		return data.content?.filter(b => b.type === "text").map(b => b.text ?? "").join("") || null;
	} catch {
		clearTimeout(timer);
		return null;
	}
}

async function tryAnthropicVideoFrames(
	info: VideoFileInfo,
	prompt: string,
	signal?: AbortSignal,
): Promise<ExtractedContent | null> {
	if (!isAnthropicWebAvailable()) return null;

	const durationResult = await getLocalVideoDuration(info.absolutePath);
	const duration = typeof durationResult === "number" ? durationResult : 60;
	const count = Math.min(6, Math.max(2, Math.floor(duration / 15)));
	const timestamps = Array.from({ length: count }, (_, i) =>
		Math.round((i / (count - 1)) * Math.min(duration, 300)),
	);

	const results = await Promise.all(timestamps.map(async (t) => {
		const frame = await extractVideoFrame(info.absolutePath, t);
		if ("error" in frame) return null;
		return { ...frame, timestamp: formatSeconds(t) } as VideoFrame;
	}));
	const frames = results.filter((f): f is VideoFrame => f !== null);
	if (frames.length === 0) return null;

	const text = await queryAnthropicWithFrames(prompt, frames, signal);
	if (!text) return null;

	return {
		url: info.absolutePath,
		title: extractHeadingTitle(text) ?? basename(info.absolutePath, extname(info.absolutePath)),
		content: text,
		error: null,
	};
}

function extractVideoTitle(text: string, filePath: string): string {
	return extractHeadingTitle(text) ?? basename(filePath, extname(filePath));
}
