import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export async function compressImageFile(file: File, maxDimension = 1440, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width <= maxDimension && height <= maxDimension && file.size < 450_000) {
        resolve(file);
        return;
      }

      if (width > height && width > maxDimension) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else if (height > maxDimension) {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const ext = file.type === 'image/png' ? 'png' : 'webp';
          const outName = file.name.replace(/\.[^.]+$/, `.${ext}`);
          resolve(new File([blob], outName, { type: blob.type }));
        },
        file.type === 'image/png' ? 'image/png' : 'image/webp',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

export async function uploadFileToStorage(
  storagePath: string,
  file: Blob | File,
  onProgress?: (pct: number) => void
): Promise<string> {
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress(pct);
        }
      },
      (error) => {
        reject(error);
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(url);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

export async function extractAudioWaveform(blob: Blob, bars = 32): Promise<number[]> {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return new Array(bars).fill(0.3);
    const ctx = new AudioCtx();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const rawData = audioBuffer.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(rawData.length / bars));
    const filteredData: number[] = [];
    for (let i = 0; i < bars; i++) {
      const start = blockSize * i;
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(rawData[start + j] || 0);
      }
      filteredData.push(sum / blockSize);
    }
    const maxVal = Math.max(...filteredData, 0.01);
    await ctx.close().catch(() => {});
    return filteredData.map((v) => Math.max(0.12, Math.min(1, Number((v / maxVal).toFixed(2)))));
  } catch {
    return new Array(bars).fill(0.35);
  }
}
