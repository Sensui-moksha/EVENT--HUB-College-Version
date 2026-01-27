import React, { useState, useRef, useEffect } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useEvents } from '../contexts/EventContext.tsx';
import { useToast } from './ui/Toast';
import { QRValidationResult } from '../types';
import { 
  QrCode, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  User,
  Calendar,
  MapPin,
  Clock
} from 'lucide-react';

interface QRScannerProps {
  eventId?: string;
  eventTitle?: string;
  onScanComplete?: (result: QRValidationResult) => void;
  scannedBy?: string;
  location?: string;
}

const QRScanner: React.FC<QRScannerProps> = ({ 
  eventId, 
  eventTitle,
  onScanComplete,
  scannedBy = 'admin',
  location = 'event-gate'
}) => {
  const { validateQRCode } = useEvents();
  const { addToast } = useToast();
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<QRValidationResult | null>(null);
  const [manualQRData, setManualQRData] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt' | 'checking'>('checking');
  const [showMiniPreview, setShowMiniPreview] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const miniPreviewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerElementId = 'qr-reader';

  useEffect(() => {
    checkCameraPermission();
    
    return () => {
      // Cleanup scanner and camera stream on unmount
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
      stopCameraStream();
    };
  }, []);

  const checkCameraPermission = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraPermission('denied');
        return;
      }

      // Check permission state if available
      if ('permissions' in navigator) {
        try {
          const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
          if (permission.state === 'granted') {
            setCameraPermission('granted');
            return;
          } else if (permission.state === 'denied') {
            setCameraPermission('denied');
            return;
          }
        } catch (error) {
          // Permission API not available or not supported for camera
          console.debug('Permission API not available for camera');
        }
      }

      // Fallback: Try to access camera with minimal constraints
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 1, height: 1 } 
        });
        stream.getTracks().forEach(track => track.stop());
        setCameraPermission('granted');
      } catch (error: any) {
        if (error.name === 'NotAllowedError') {
          setCameraPermission('denied');
        } else if (error.name === 'NotFoundError') {
          setCameraPermission('denied');
        } else {
          setCameraPermission('prompt');
        }
      }
    } catch (error) {
      console.error('Error checking camera permission:', error);
      setCameraPermission('prompt');
    }
  };

  const requestCameraPermission = async (): Promise<boolean> => {
    try {
      setIsStartingCamera(true);
      console.log('Requesting camera permission...');

      // Clear any existing permission status to force a fresh request
      setCameraPermission('checking');

      // Try to access camera - this will trigger browser permission dialog
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      
      // Stop the test stream immediately as we just needed to check permission
      stream.getTracks().forEach(track => track.stop());
      
      console.log('Camera permission granted');
      setCameraPermission('granted');
      
      addToast({
        type: 'success',
        title: 'Permission Granted',
        message: 'Camera access has been granted! You can now start scanning.'
      });
      
      return true;
    } catch (error: any) {
      console.error('Camera permission error:', error);
      setCameraPermission('denied');
      
      if (error.name === 'NotAllowedError') {
        addToast({
          type: 'error',
          title: 'Permission Denied',
          message: 'Camera access was denied. Please click the camera icon in your browser address bar to allow access.'
        });
      } else if (error.name === 'NotFoundError') {
        addToast({
          type: 'error',
          title: 'No Camera Found',
          message: 'No camera device was found on your device.'
        });
      } else if (error.name === 'NotReadableError') {
        addToast({
          type: 'error',
          title: 'Camera Busy',
          message: 'Camera is already in use by another application.'
        });
      } else {
        addToast({
          type: 'error',
          title: 'Camera Error',
          message: 'Unable to access camera. Please check your device settings and try again.'
        });
      }
      return false;
    } finally {
      setIsStartingCamera(false);
    }
  };

  const startCameraWithPreview = async () => {
    try {
      setIsStartingCamera(true);
      console.log('Starting camera with preview...');

      // Stop any existing stream first
      if (streamRef.current) {
        console.log('Stopping existing stream...');
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Try multiple camera configurations
      const cameraConfigs = [
        // First try: Environment camera with ideal settings
        { 
          video: { 
            facingMode: 'environment',
            width: { ideal: 640, min: 320 },
            height: { ideal: 480, min: 240 }
          } 
        },
        // Second try: Any camera with ideal settings
        { 
          video: { 
            width: { ideal: 640, min: 320 },
            height: { ideal: 480, min: 240 }
          } 
        },
        // Third try: Basic camera request
        { 
          video: true 
        },
        // Fourth try: Front camera
        { 
          video: { 
            facingMode: 'user'
          } 
        }
      ];

      let stream: MediaStream | null = null;
      let lastError: any = null;

      for (let i = 0; i < cameraConfigs.length; i++) {
        try {
          console.log(`Trying camera config ${i + 1}:`, cameraConfigs[i]);
          stream = await navigator.mediaDevices.getUserMedia(cameraConfigs[i]);
          console.log('✅ Camera stream obtained with config', i + 1);
          break;
        } catch (error) {
          console.warn(`❌ Camera config ${i + 1} failed:`, error);
          lastError = error;
        }
      }

      if (!stream) {
        throw lastError || new Error('All camera configurations failed');
      }
      
      console.log('Camera stream obtained:', stream);
      console.log('Video tracks:', stream.getVideoTracks());
      
      // Store the stream
      streamRef.current = stream;
      
      // Show preview container immediately
      setShowMiniPreview(true);
      
      // Wait for the component to re-render and ref to be available
      setTimeout(() => {
        const video = miniPreviewRef.current;
        if (video) {
          console.log('Setting up video element...');
          
          // Clear any existing src
          video.srcObject = null;
          video.src = '';
          
          // Set the new stream
          video.srcObject = stream;
          
          // Add comprehensive event listeners
          const onLoadedMetadata = () => {
            console.log('Video metadata loaded, dimensions:', video.videoWidth, 'x', video.videoHeight);
            video.play().then(() => {
              console.log('Video playing successfully');
            }).catch(error => {
              console.error('Play failed:', error);
              // Try user gesture play
              video.muted = true;
              video.play().catch(console.error);
            });
          };
          
          const onCanPlay = () => {
            console.log('Video can play');
            if (video.paused) {
              video.play().catch(console.error);
            }
          };
          
          const onPlay = () => {
            console.log('Video started playing');
          };
          
          const onError = (e: any) => {
            console.error('Video error:', e, video.error);
          };
          
          const onLoadStart = () => {
            console.log('Video load started');
          };
          
          // Remove any existing listeners first
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('canplay', onCanPlay);
          video.removeEventListener('play', onPlay);
          video.removeEventListener('error', onError);
          video.removeEventListener('loadstart', onLoadStart);
          
          // Add new listeners
          video.addEventListener('loadedmetadata', onLoadedMetadata);
          video.addEventListener('canplay', onCanPlay);
          video.addEventListener('play', onPlay);
          video.addEventListener('error', onError);
          video.addEventListener('loadstart', onLoadStart);
          
          // Set video properties
          video.autoplay = true;
          video.playsInline = true;
          video.muted = true;
          
          // Force load
          video.load();
          
          console.log('Video element setup completed');
        } else {
          console.error('Video ref not available after timeout');
        }
      }, 100);
      
      addToast({
        type: 'success',
        title: 'Camera Started',
        message: 'Camera is ready for scanning'
      });
      
    } catch (error: any) {
      console.error('Error starting camera:', error);
      setCameraPermission('denied');
      
      let errorMessage = 'Unable to access camera. Please check device settings.';
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied. Please allow camera access and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera found on your device.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera is already in use by another application.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Camera constraints not supported by your device.';
      }
      
      addToast({
        type: 'error',
        title: 'Camera Error',
        message: errorMessage
      });
      setShowMiniPreview(false);
    } finally {
      setIsStartingCamera(false);
    }
  };

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowMiniPreview(false);
    
    if (miniPreviewRef.current) {
      miniPreviewRef.current.srcObject = null;
    }
  };

  const handleStartCamera = async () => {
    if (cameraPermission === 'granted') {
      await startCameraWithPreview();
      // Auto-start QR scanner after camera is ready
      setTimeout(() => {
        startScanning();
      }, 1000);
    } else {
      // Always attempt to request camera permission regardless of current status
      addToast({
        type: 'info',
        title: 'Camera Permission',
        message: 'Please allow camera access when prompted by your browser'
      });
      
      // Reset camera status to prompt a fresh permission request
      setCameraPermission('checking');
      
      const granted = await requestCameraPermission();
      if (granted) {
        await startCameraWithPreview();
        // Auto-start QR scanner after camera is ready
        setTimeout(() => {
          startScanning();
        }, 1000);
      } else {
        // Permission denied - provide clear instructions
        addToast({
          type: 'warning',
          title: 'Camera Access Required',
          message: 'Camera permission denied. Please click the camera icon in your browser\'s address bar to allow access, then try again.'
        });
      }
    }
  };

  const startScanning = () => {
    setIsScanning(true);
    setScanResult(null);
    
    // Clear any existing scanner first
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error);
      scannerRef.current = null;
    }
    
    // Wait a moment for DOM cleanup
    setTimeout(() => {
      scannerRef.current = new Html5QrcodeScanner(
        scannerElementId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          rememberLastUsedCamera: true,
          showTorchButtonIfSupported: true,
          showZoomSliderIfSupported: true,
          defaultZoomValueIfSupported: 2,
          videoConstraints: {
            facingMode: 'environment' // Use back camera for QR scanning
          },
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.DATA_MATRIX
          ],
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          }
        },
        true // Enable verbose logging for debugging
      );

      scannerRef.current.render(
        (decodedText, decodedResult) => {
          console.log('QR Code detected:', decodedText);
          console.log('QR Result object:', decodedResult);
          // decodedResult.format does not exist on Html5QrcodeResult
          handleQRScan(decodedText);
        },
        (error) => {
          // Only log meaningful errors, not scanning attempts
          if (!error.toString().includes('QR code parse error') && 
              !error.toString().includes('No QR code found') &&
              !error.toString().includes('NotFoundException') &&
              !error.toString().includes('NotFoundError')) {
            console.warn('QR Scanner error:', error);
          }
        }
      );
    }, 100);
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error);
      scannerRef.current = null;
    }
    setIsScanning(false);
    stopCameraStream();
  };

  const handleQRScan = async (qrData: string) => {
    try {
      console.log('Raw QR Data scanned:', qrData);
      console.log('QR Data length:', qrData.length);
      console.log('QR Data type:', typeof qrData);
      
      // Try to parse the QR data to see if it's valid JSON
      try {
        const parsed = JSON.parse(qrData);
        console.log('Parsed QR Data:', parsed);
        console.log('QR Data fields:', Object.keys(parsed));
      } catch (parseError: any) {
        console.log('QR Data is not JSON:', parseError.message);
      }
      
      const result = await validateQRCode(qrData, eventId, scannedBy, location);
      console.log('Validation result:', result);
      setScanResult(result);
      
      if (result.valid) {
        addToast({
          type: 'success',
          title: 'Valid QR Code',
          message: 'Attendance marked successfully'
        });
        stopScanning();
      } else {
        addToast({
          type: 'error',
          title: 'Invalid QR Code',
          message: result.reason || 'QR code validation failed'
        });
      }
      
      onScanComplete?.(result);
    } catch (error) {
      console.error('QR validation error:', error);
      addToast({
        type: 'error',
        title: 'Scan Error',
        message: 'Failed to validate QR code'
      });
    }
  };

  const handleManualValidation = async () => {
    if (!manualQRData.trim()) {
      addToast({
        type: 'warning',
        title: 'No Data',
        message: 'Please enter QR code data'
      });
      return;
    }

    console.log('Manual QR Data:', manualQRData);
    await handleQRScan(manualQRData);
    setManualQRData('');
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      addToast({
        type: 'error',
        title: 'Invalid File',
        message: 'Please select an image file'
      });
      return;
    }

    try {
      setIsProcessingImage(true);

      // Convert file to base64 for preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Use Html5Qrcode to scan the image file
      const html5QrCode = new (await import('html5-qrcode')).Html5Qrcode('temp-qr-scanner');
      
      try {
        const qrCodeResult = await html5QrCode.scanFile(file, true);
        console.log('QR Code detected in image:', qrCodeResult);
        
        addToast({
          type: 'success',
          title: 'QR Code Found',
          message: 'QR code detected in uploaded image'
        });

        // Process the QR code
        await handleQRScan(qrCodeResult);
        
      } catch (scanError) {
        console.error('No QR code found in image:', scanError);
        addToast({
          type: 'error',
          title: 'No QR Code Found',
          message: 'Could not detect a QR code in the uploaded image'
        });
      } finally {
        // Clean up
        try {
          await html5QrCode.clear();
        } catch (clearError) {
          console.warn('Error clearing HTML5 QR code scanner:', clearError);
        }
      }
      
    } catch (error) {
      console.error('Error processing image:', error);
      addToast({
        type: 'error',
        title: 'Processing Error',
        message: 'Failed to process the uploaded image'
      });
    } finally {
      setIsProcessingImage(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const clearUploadedImage = () => {
    setUploadedImage(null);
    setShowImageUpload(false);
  };

  const renderScanResult = () => {
    if (!scanResult) return null;

    const { valid, registration, reason, scanLog } = scanResult;

    return (
      <div className={`mt-6 p-6 rounded-lg border-2 ${
        valid ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
      }`}>
        <div className="flex items-center gap-3 mb-4">
          {valid ? (
            <CheckCircle className="w-8 h-8 text-green-600" />
          ) : (
            <XCircle className="w-8 h-8 text-red-600" />
          )}
          <h3 className={`text-xl font-semibold ${
            valid ? 'text-green-800' : 'text-red-800'
          }`}>
            {valid ? 'Valid QR Code' : 'Invalid QR Code'}
          </h3>
        </div>

        {!valid && reason && (
          <div className="mb-4 p-3 bg-red-100 rounded-lg">
            <p className="text-red-800 font-medium">Reason: {reason}</p>
          </div>
        )}

        {valid && registration && (
          <div className="space-y-4">
            {/* Student Info */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <User className="w-5 h-5" />
                Student Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="font-medium">Name:</span> {registration.user?.name}
                </div>
                <div>
                  <span className="font-medium">Email:</span> {registration.user?.email}
                </div>
                <div>
                  <span className="font-medium">Registration ID:</span> {registration.registrationId}
                </div>
                <div>
                  <span className="font-medium">Department:</span> {registration.user?.department}
                </div>
              </div>
            </div>

            {/* Event Info */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Event Information
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Event:</span> 
                  {registration.event?.title}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{new Date(registration.event?.date).toLocaleDateString()} at {registration.event?.time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>{registration.event?.venue}</span>
                </div>
              </div>
            </div>

            {/* Scan Info */}
            {scanLog && (
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <h4 className="font-semibold text-gray-900 mb-2">Scan Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="font-medium">Scanned By:</span> {scanLog.scannedBy}
                  </div>
                  <div>
                    <span className="font-medium">Location:</span> {scanLog.location}
                  </div>
                  <div>
                    <span className="font-medium">Time:</span> {new Date(scanLog.scannedAt).toLocaleString()}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span> 
                    <span className="ml-1 px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                      {scanLog.status}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Registration Status */}
            <div className="bg-green-100 p-3 rounded-lg">
              <p className="text-green-800 font-medium text-center">
                ✓ Attendance Marked Successfully
              </p>
            </div>
          </div>
        )}

        <button
          onClick={() => setScanResult(null)}
          className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Scan Another QR Code
        </button>
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="text-center mb-6">
        <QrCode className="w-12 h-12 text-blue-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          QR Code Scanner
        </h2>
        {eventTitle ? (
          <p className="text-gray-600">
            Scanning for: <span className="font-semibold">{eventTitle}</span>
          </p>
        ) : (
          <p className="text-gray-600">
            Scan QR codes to mark attendance
          </p>
        )}
      </div>

      {/* Scanner Controls */}
      <div className="mb-6 flex flex-col items-center gap-4">
        <div className="flex justify-center gap-4">
          {!isScanning ? (
            <button
              onClick={handleStartCamera}
              disabled={isStartingCamera || cameraPermission === 'checking'}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                cameraPermission === 'granted' 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : cameraPermission === 'denied'
                  ? 'bg-orange-600 text-white hover:bg-orange-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <QrCode className="w-5 h-5" />
              {isStartingCamera ? 'Starting Scanner...' : 
               cameraPermission === 'denied' ? 'Request Camera & Start Scanner' : 'Start QR Scanner'}
            </button>
          ) : (
            <button
              onClick={stopScanning}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <XCircle className="w-5 h-5" />
              Stop Scanner
            </button>
          )}

          <button
            onClick={() => setShowManualInput(!showManualInput)}
            className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <AlertCircle className="w-5 h-5" />
            Manual Input
          </button>

          <button
            onClick={() => setShowImageUpload(!showImageUpload)}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <QrCode className="w-5 h-5" />
            Upload QR Image
          </button>
        </div>
        
        {/* Permission status indicator */}
        {cameraPermission !== 'checking' && !isScanning && (
          <div className="text-sm text-gray-600 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              cameraPermission === 'granted' ? 'bg-green-500' : 
              cameraPermission === 'denied' ? 'bg-red-500' : 'bg-yellow-500'
            }`}></div>
            QR Scanner: {cameraPermission === 'granted' ? 'Ready to start' : 
                        cameraPermission === 'denied' ? 'Camera permission required' : 'Click to start scanning'}
            {showMiniPreview && ' | 📹 Camera Active'}
            {streamRef.current && ' | 🔴 Stream Active'}
          </div>
        )}
      </div>

      {/* Camera Permission Status */}
      {cameraPermission === 'denied' && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-800 mb-2">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Camera Access Required</span>
          </div>
          <p className="text-red-700 text-sm mb-3">
            To use the QR scanner, please allow camera access in your browser:
          </p>
          <ul className="text-red-700 text-sm space-y-1 mb-3">
            <li>• Click the camera icon in your browser's address bar</li>
            <li>• Select "Allow" when prompted for camera permission</li>
            <li>• Or check your browser settings for camera permissions</li>
          </ul>
          <button
            onClick={checkCameraPermission}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm mr-2"
          >
            Check Permission Again
          </button>
          <button
            onClick={handleStartCamera}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
          >
            Request Camera Access
          </button>
        </div>
      )}

      {cameraPermission === 'checking' && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 text-blue-800">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-800"></div>
            <span className="font-medium">Checking camera permissions...</span>
          </div>
        </div>
      )}



      {/* Camera Preview (always show when camera is active) */}
      {showMiniPreview && (
        <div className="mb-6 flex justify-center">
          <div className="relative bg-black rounded-lg overflow-hidden shadow-2xl border-4 border-blue-500">
            <video
              ref={miniPreviewRef}
              autoPlay
              playsInline
              muted
              width={480}
              height={360}
              className="block"
              style={{ 
                width: '480px',
                height: '360px',
                display: 'block',
                backgroundColor: 'transparent',
                objectFit: 'cover',
                transform: 'scaleX(-1)',
                WebkitTransform: 'scaleX(-1)'
              }}
              onLoadedMetadata={() => {
                console.log('✅ Video metadata loaded');
                const video = miniPreviewRef.current;
                if (video) {
                  console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);
                  console.log('Video ready state:', video.readyState);
                }
              }}
              onCanPlay={() => {
                console.log('✅ Video can play');
                const video = miniPreviewRef.current;
                if (video && video.paused) {
                  video.play().catch(console.error);
                }
              }}
              onPlay={() => {
                console.log('✅ Video started playing');
              }}
              onError={(e) => {
                console.error('❌ Video error:', e);
                const video = miniPreviewRef.current;
                if (video && video.error) {
                  console.error('Video error details:', video.error);
                }
              }}
              onLoadStart={() => {
                console.log('📡 Video load started');
              }}
              onWaiting={() => {
                console.log('⏳ Video waiting for data');
              }}
              onTimeUpdate={() => {
                // Only log first time update to avoid spam
                if (!miniPreviewRef.current?.dataset.firstUpdate) {
                  console.log('⏱️ Video time update - playing!');
                  if (miniPreviewRef.current) {
                    miniPreviewRef.current.dataset.firstUpdate = 'true';
                  }
                }
              }}
            />
            <div className="absolute top-2 left-2 bg-blue-600 bg-opacity-90 text-white text-xs px-2 py-1 rounded font-bold">
              {isScanning ? '� SCANNING ACTIVE' : '�📷 QR SCANNER READY'}
            </div>
            <div className="absolute bottom-2 left-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded text-center">
              {isScanning ? 'Point camera at QR code to scan' : 'Point camera at QR code - scanning will start automatically'}
            </div>

          </div>
        </div>
      )}

      {/* Camera Scanner - Hidden QR Scanner Container */}
      {isScanning && (
        <div 
          id={scannerElementId} 
          className="hidden"
          style={{ display: 'none' }}
        />
      )}

      {/* Manual Input */}
      {showManualInput && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-3">Manual QR Data Input</h3>
          <div className="space-y-3">
            <textarea
              value={manualQRData}
              onChange={(e) => setManualQRData(e.target.value)}
              placeholder="Paste QR code data here..."
              className="w-full p-3 border border-gray-300 rounded-lg resize-none"
              rows={4}
            />
            <button
              onClick={handleManualValidation}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Validate QR Data
            </button>
          </div>
        </div>
      )}

      {/* QR Image Upload */}
      {showImageUpload && (
        <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <h3 className="font-semibold text-purple-900 mb-3">Upload QR Code Image</h3>
          
          {/* File Upload */}
          <div className="space-y-4">
            <div className="border-2 border-dashed border-purple-300 rounded-lg p-6 text-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={isProcessingImage}
                className="hidden"
                id="qr-image-upload"
              />
              <label
                htmlFor="qr-image-upload"
                className={`cursor-pointer flex flex-col items-center gap-3 ${
                  isProcessingImage ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <QrCode className="w-12 h-12 text-purple-500" />
                <div>
                  <p className="text-purple-700 font-medium">
                    {isProcessingImage ? 'Processing...' : 'Click to upload QR code image'}
                  </p>
                  <p className="text-purple-600 text-sm mt-1">
                    Supports JPG, PNG, GIF, WebP formats
                  </p>
                </div>
              </label>
            </div>
            
            {/* Image Preview */}
            {uploadedImage && (
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-purple-900">Uploaded Image</h4>
                  <button
                    onClick={clearUploadedImage}
                    className="text-purple-600 hover:text-purple-800"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
                <img
                  src={uploadedImage}
                  alt="Uploaded QR Code"
                  className="max-w-full max-h-48 mx-auto rounded border"
                />
              </div>
            )}
            
            {/* Processing Status */}
            {isProcessingImage && (
              <div className="flex items-center justify-center gap-2 text-purple-700">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-700"></div>
                <span>Scanning QR code in image...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scan Result */}
      {renderScanResult()}

      {/* Instructions */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Instructions</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Click "Start Camera" to begin - camera permission will be requested if needed</li>
          <li>• A mini preview will appear in the bottom-right corner to help you aim</li>
          <li>• Point your camera at the QR code to scan automatically</li>
          <li>• Ensure the QR code is well-lit and clearly visible</li>
          <li>• Use manual input if the camera scanner is not working</li>
          <li>• Each QR code can only be used once per event</li>
        </ul>
      </div>

      {/* Hidden div for temporary QR code scanning */}
      <div id="temp-qr-scanner" style={{ display: 'none' }}></div>
    </div>
  );
};

export default QRScanner;
