// XMLHttpRequest-based uploader to report progress (fetch lacks granular upload progress)
import { getAuthHeaders } from './api';

export type UploadProgressHandler = (pct: number) => void;

export function uploadFormDataWithProgress(
  url: string,
  formData: FormData,
  onProgress?: UploadProgressHandler,
  method: 'POST' | 'PATCH' | 'PUT' = 'POST',
  timeoutMs: number = 30 * 60 * 1000 // 30 minutes default timeout for large uploads
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    
    // Set auth header for proxy-friendly fallback
    const authHeaders = getAuthHeaders();
    Object.entries(authHeaders).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    
    // Set timeout for large file uploads
    xhr.timeout = timeoutMs;
    
    xhr.upload.onprogress = (e) => {
      if (!onProgress || !e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 100);
      onProgress(pct);
    };
    xhr.onload = () => {
      const headers = new Headers({ 'Content-Type': 'application/json' });
      // Wrap the raw response text so Response.json() works reliably
      resolve(new Response(xhr.responseText, { status: xhr.status, headers }));
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.ontimeout = () => reject(new Error('Upload timed out. Please try with a smaller file or check your connection.'));
    // Use text so we can always construct a valid Response for .json()
    xhr.responseType = 'text';
    xhr.send(formData);
  });
}
