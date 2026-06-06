import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const DOWNLOAD_DIR = path.join(process.cwd(), "public", "downloads");
const YTDLP_BIN = path.join(process.cwd(), "node_modules", "youtube-dl-exec", "bin", process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");

// Ensure directory exists
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

/**
 * Downloads a YouTube video and returns the local file path and URL.
 * Uses yt-dlp binary directly to avoid Next.js Webpack path resolution bugs.
 */
export async function downloadYouTubeClip(youtubeId: string): Promise<{ localPath: string; localUrl: string }> {
  const url = `https://www.youtube.com/watch?v=${youtubeId}`;
  const fileName = `${youtubeId}.mp4`;
  const localPath = path.join(DOWNLOAD_DIR, fileName);
  const localUrl = `/downloads/${fileName}`;

  // If already downloaded, skip
  if (fs.existsSync(localPath)) {
    console.log(`[downloader] File already exists for ${youtubeId}, skipping download.`);
    return { localPath, localUrl };
  }

  console.log(`[downloader] Starting download for ${youtubeId} using ${YTDLP_BIN}...`);

  try {
    const args = [
      url,
      "--merge-output-format", "mp4",
      "-o", localPath,
      "--no-warnings",
      "--prefer-free-formats"
    ];

    // If running on a cloud server, YouTube will block the IP. 
    // We can bypass this by passing a Netscape cookies.txt string via an environment variable.
    if (process.env.YOUTUBE_COOKIES) {
      const cookiePath = path.join(DOWNLOAD_DIR, "cookies.txt");
      fs.writeFileSync(cookiePath, process.env.YOUTUBE_COOKIES, 'utf-8');
      args.push("--cookies", cookiePath);
    }

    // Download the best single file with audio and video (e.g. 720p mp4)
    await execFileAsync(YTDLP_BIN, args);
    
    console.log(`[downloader] Finished downloading ${youtubeId}`);
    return { localPath, localUrl };
  } catch (err) {
    console.error(`[downloader] Error downloading ${youtubeId}:`, err);
    // Cleanup partial file if it exists
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
    throw new Error(`Failed to download YouTube video ${youtubeId}`);
  }
}
