/* tslint:disable */
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {GenerateVideosParameters, GoogleGenAI} from '@google/genai';

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function blobToBase64(blob: Blob) {
  return new Promise<string>(async (resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      resolve(url.split(',')[1]);
    };
    reader.readAsDataURL(blob);
  });
}

function downloadFile(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// DOM Elements
const upload = document.querySelector('#file-input') as HTMLInputElement;
const imgEl = document.querySelector('#img') as HTMLImageElement;
const promptEl = document.querySelector('#prompt-input') as HTMLTextAreaElement;
const generateButton = document.querySelector('#generate-button') as HTMLButtonElement;
const statusEl = document.querySelector('#status') as HTMLParagraphElement;
const video = document.querySelector('#video') as HTMLVideoElement;
const quotaErrorEl = document.querySelector('#quota-error') as HTMLDivElement;

// App State
let base64data = '';
let prompt = '';

async function generateContent(prompt: string, imageBytes: string) {
  // Initialize with API Key from environment variable
  const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

  const config: GenerateVideosParameters = {
    model: 'veo-2.0-generate-001',
    prompt,
    config: {
      numberOfVideos: 1,
    },
  };

  if (imageBytes) {
    config.image = {
      imageBytes,
      mimeType: 'image/png', // Assuming PNG, adjust if other types are used
    };
  }

  let operation = await ai.models.generateVideos(config);

  while (!operation.done) {
    console.log('Waiting for completion');
    statusEl.innerText = 'Generating... please wait.';
    await delay(2000); // Polling less frequently
    operation = await ai.operations.getVideosOperation({operation});
  }

  const videos = operation.response?.generatedVideos;
  if (videos === undefined || videos.length === 0) {
    throw new Error('No videos were generated. Please try a different prompt.');
  }

  videos.forEach(async (v, i) => {
    const url = decodeURIComponent(v.video.uri);
    const res = await fetch(url);
    const blob = await res.blob();
    const objectURL = URL.createObjectURL(blob);
    downloadFile(objectURL, `video${i}.mp4`);
    video.src = objectURL;
    console.log('Downloaded video', `video${i}.mp4`);
    video.style.display = 'block';
  });
}


upload.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    base64data = await blobToBase64(file);
    imgEl.src = URL.createObjectURL(file);
    imgEl.style.display = 'block';
  } else {
    base64data = '';
    imgEl.src = '';
    imgEl.style.display = 'none';
  }
});

promptEl.addEventListener('input', () => {
  prompt = promptEl.value;
});

generateButton.addEventListener('click', async () => {
  statusEl.innerText = 'Initializing...';
  video.style.display = 'none';
  quotaErrorEl.style.display = 'none';

  generateButton.disabled = true;
  upload.disabled = true;
  promptEl.disabled = true;

  try {
    await generateContent(prompt, base64data);
    statusEl.innerText = 'Video generated and downloaded successfully!';
  } catch (e) {
    try {
      // The error message from the API might be a JSON string.
      const err = JSON.parse(e.message);
      if (err.error.code === 429) {
        quotaErrorEl.style.display = 'block';
        statusEl.innerText = 'Error.';
      } else {
        statusEl.innerText = `Error: ${err.error.message}`;
      }
    } catch (err) {
      statusEl.innerText = `Error: ${e.message}`;
      console.error('An error occurred:', e);
    }
  } finally {
    generateButton.disabled = false;
    upload.disabled = false;
    promptEl.disabled = false;
  }
});
