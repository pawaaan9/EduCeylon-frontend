/** Reads duration from a local video file (minutes, rounded up). */
export function getVideoDurationMinutes(file: File): Promise<number | undefined> {
  if (!file.type.startsWith("video/")) return Promise.resolve(undefined);

  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
    };

    video.onloadedmetadata = () => {
      const seconds = video.duration;
      cleanup();
      if (!Number.isFinite(seconds) || seconds <= 0) {
        resolve(undefined);
        return;
      }
      resolve(Math.max(1, Math.ceil(seconds / 60)));
    };

    video.onerror = () => {
      cleanup();
      resolve(undefined);
    };

    video.src = objectUrl;
  });
}
