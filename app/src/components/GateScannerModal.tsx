import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import { verifyPass, fetchScanLogs } from '../services/api';
import { GateClearanceDTO, GateScanLogEntry } from '../types/queue';

// Safe resolver for CommonJS / ESM bundler resolution of jsQR
const decodeQR = (typeof jsQR === 'function' ? jsQR : (jsQR as any)?.default) as typeof jsQR;

interface GateScannerModalProps {
  onClose: () => void;
  initialCode?: string;
}

export const GateScannerModal: React.FC<GateScannerModalProps> = ({ onClose, initialCode = '' }) => {
  const [inputCode, setInputCode] = useState(initialCode || '');
  const [torchActive, setTorchActive] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [barrierReleased, setBarrierReleased] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [flashDetected, setFlashDetected] = useState(false);
  const [imageDecoding, setImageDecoding] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanAnimRef = useRef<number | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const lastScannedCodeRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Clearance Result State (Strictly GateClearanceDTO - NO clinical EHR data)
  const [clearance, setClearance] = useState<GateClearanceDTO | null>(null);
  const [auditLogs, setAuditLogs] = useState<GateScanLogEntry[]>([]);

  // Sound feedback synthesizer using Web Audio API
  const triggerAudioBeep = useCallback((success = true) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(success ? 880 : 330, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Audio context might be restricted before interaction - fail gracefully
    }
  }, []);

  const handleVerify = useCallback(async (codeToVerify: string) => {
    if (!codeToVerify.trim()) return;
    setScanning(true);
    isProcessingRef.current = true;
    try {
      const res = await verifyPass(codeToVerify.trim());
      setClearance(res);
      // Refresh audit logs from backend
      try {
        const logs = await fetchScanLogs();
        setAuditLogs(logs);
      } catch (err) {
        console.warn('Scan logs sync fallback:', err);
        setAuditLogs((prev) => [
          {
            id: String(Date.now()),
            passIdOrCode: res.passId || codeToVerify.substring(0, 16),
            outcome: res.outcome,
            timestamp: res.scanTimestamp,
            operatorId: 'SEC-402',
            gateId: 'Gate 02',
            patientNameMasked: res.patientNameMasked,
            token: res.token,
            isDuplicate: !!res.isDuplicateScan,
          },
          ...prev.slice(0, 9),
        ]);
      }
    } catch (err: any) {
      console.error('Gate pass verification error:', err);
      setClearance({
        outcome: 'INVALID',
        message: err.message || 'Verification network request failed.',
        scanTimestamp: new Date().toISOString(),
      });
    } finally {
      setScanning(false);
      isProcessingRef.current = false;
    }
  }, []);

  // Continuous QR optical frame decoder loop
  const startScanningLoop = useCallback(() => {
    if (scanAnimRef.current) {
      cancelAnimationFrame(scanAnimRef.current);
      scanAnimRef.current = null;
    }

    const processFrame = () => {
      const video = videoRef.current;
      if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        if (!canvasRef.current) {
          canvasRef.current = document.createElement('canvas');
        }
        const canvas = canvasRef.current;
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            try {
              const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              if (typeof decodeQR === 'function') {
                const qr = decodeQR(imgData.data, imgData.width, imgData.height, {
                  inversionAttempts: 'attemptBoth',
                });

                if (qr && qr.data && qr.data.trim()) {
                  const detectedCode = qr.data.trim();
                  if (!isProcessingRef.current && detectedCode !== lastScannedCodeRef.current) {
                    lastScannedCodeRef.current = detectedCode;
                    setInputCode(detectedCode);
                    setFlashDetected(true);
                    triggerAudioBeep(true);
                    setTimeout(() => setFlashDetected(false), 800);
                    handleVerify(detectedCode);

                    // Debounce repeat scans of the exact same code for 3.5 seconds
                    setTimeout(() => {
                      lastScannedCodeRef.current = '';
                    }, 3500);
                  }
                }
              }
            } catch (frameErr) {
              // Frame decoding error - ignore frame and continue
              console.debug('Optical frame sample error:', frameErr);
            }
          }
        }
      }
      scanAnimRef.current = requestAnimationFrame(processFrame);
    };

    scanAnimRef.current = requestAnimationFrame(processFrame);
  }, [handleVerify, triggerAudioBeep]);

  // Load audit logs from backend on mount
  useEffect(() => {
    fetchScanLogs()
      .then((logs) => setAuditLogs(logs))
      .catch((err) => console.warn('Could not fetch server scan logs:', err));

    if (initialCode && initialCode.trim()) {
      handleVerify(initialCode.trim());
    }
  }, [initialCode, handleVerify]);

  // Camera Sensor Initialization and Teardown
  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    if (typeof window === 'undefined') return;

    setCameraLoading(true);
    setCameraError(null);

    // Stop existing stream if running
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraActive(false);
      setCameraLoading(false);
      setCameraError(
        window.isSecureContext === false
          ? 'Camera API unavailable in non-secure HTTP context. Please access SmartQueue via localhost or HTTPS.'
          : 'Webcam hardware API (getUserMedia) is not supported by this browser.'
      );
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
      } catch (modeErr: any) {
        // Fallback: If requested facing mode isn't supported (e.g. desktop webcam), try default video
        console.warn(`Camera facingMode "${facing}" unavailable, attempting default webcam stream:`, modeErr?.message);
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;

      // Check if torch/flashlight is supported
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities ? videoTrack.getCapabilities() : {}) as any;
        setTorchSupported(!!capabilities.torch);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('muted', 'true');
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Video auto-playback warning:', playErr);
        }
      }

      setCameraActive(true);
      setCameraError(null);
      setCameraLoading(false);

      // Begin continuous optical scanning loop
      startScanningLoop();
    } catch (err: any) {
      console.warn('Physical camera unavailable:', err?.name, err?.message);
      setCameraActive(false);
      setCameraLoading(false);
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setCameraError('Camera access denied by browser permission settings. Enable webcam permissions or use photo upload below.');
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        setCameraError('No webcam hardware detected on this device. You can upload an image of the QR pass or enter token manually.');
      } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
        setCameraError('Camera is currently in use by another application or video process.');
      } else {
        setCameraError(err?.message || 'Camera initialization failed. Optical simulator active.');
      }
    }
  }, [startScanningLoop]);

  useEffect(() => {
    let active = true;

    if (active) {
      startCamera(cameraFacing);
    }

    return () => {
      active = false;
      if (scanAnimRef.current) {
        cancelAnimationFrame(scanAnimRef.current);
        scanAnimRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [cameraFacing, startCamera]);

  // Torch Toggle
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && (track as any).applyConstraints) {
      try {
        await (track as any).applyConstraints({
          advanced: [{ torch: !torchActive }],
        });
        setTorchActive(!torchActive);
      } catch (err) {
        console.warn('Flashlight toggle failed:', err);
      }
    }
  };

  // Flip Camera (environment vs user)
  const toggleCameraFacing = () => {
    setCameraFacing((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Upload and Decode QR from Image File
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageDecoding(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          try {
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            if (typeof decodeQR !== 'function') {
              throw new Error('QR optical decoder library is unavailable.');
            }
            const qr = decodeQR(imgData.data, imgData.width, imgData.height, {
              inversionAttempts: 'attemptBoth',
            });
            if (qr && qr.data && qr.data.trim()) {
              const detected = qr.data.trim();
              setInputCode(detected);
              setFlashDetected(true);
              triggerAudioBeep(true);
              setTimeout(() => setFlashDetected(false), 800);
              handleVerify(detected);
            } else {
              setCameraError('No readable QR barcode found in selected image. Make sure the SmartQueue pass QR is clearly visible.');
            }
          } catch (decodeErr: any) {
            setCameraError('Failed to decode image: ' + (decodeErr?.message || 'Invalid format'));
          }
        }
        setImageDecoding(false);
      };
      img.onerror = () => {
        setCameraError('Could not load image file.');
        setImageDecoding(false);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setCameraError('Error reading uploaded image file.');
      setImageDecoding(false);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be re-selected if desired
    e.target.value = '';
  };

  const handleReleaseBarrier = () => {
    setBarrierReleased(true);
    setTimeout(() => {
      setBarrierReleased(false);
    }, 2500);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate-scanner-title"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant overflow-hidden my-auto max-h-[95vh] flex flex-col z-[10000]">
        {/* Hardware Status Strip */}
        <div className="w-full bg-primary-container px-4 py-1 flex items-center justify-between text-on-primary-container text-[11px] select-none border-b border-primary/40">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${cameraActive ? 'bg-secondary-fixed animate-pulse' : 'bg-amber-400'}`}></span>
            <span className="font-mono text-[10px] uppercase font-semibold text-primary-fixed">
              {cameraActive ? 'Camera-Online' : 'Optical-Standby'}
            </span>
            <span className="text-outline text-[10px]">|</span>
            <span className="text-primary-fixed-dim text-[10px]">SEC-AUTH Active</span>
          </div>
          <div className="flex items-center gap-2 text-primary-fixed font-mono text-[10px]">
            <span>Gate 02</span>
            <span className="material-symbols-outlined text-[14px]">shield</span>
            <span className="material-symbols-outlined text-[14px]">wifi</span>
          </div>
        </div>

        {/* Header */}
        <header className="bg-surface-container-lowest border-b border-outline-variant px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center text-white">
              <span className="material-symbols-outlined text-[20px] text-secondary-fixed">shield_person</span>
            </div>
            <div>
              <h2 id="gate-scanner-title" className="text-sm font-bold text-primary tracking-tight leading-none">SmartQueue Gate Security</h2>
              <span className="text-[10px] text-secondary font-bold tracking-wider uppercase mt-0.5 block">
                Operator: SEC-402 • Officer T. Briggs (Gate 02)
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
            title="Close Gate Scanner"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </header>

        {/* Scrollable Viewport */}
        <div className="overflow-y-auto p-4 space-y-3.5 flex-1">
          {/* Camera Viewport / Live Feed */}
          <div className="w-full relative bg-primary rounded-xl overflow-hidden shadow-md border border-outline/30 flex flex-col items-center justify-center aspect-[4/3] max-h-56">
            {/* Real Video Element if camera stream active */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                cameraActive ? 'opacity-95' : 'opacity-0 pointer-events-none'
              }`}
            />

            {!cameraActive && (
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#6bd8cb_1px,transparent_1px)] bg-[size:16px_16px]"></div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-primary/80 pointer-events-none"></div>

            {/* Top camera toolbar */}
            <div className="absolute top-2.5 inset-x-3 flex justify-between items-center z-20">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-container/90 border border-primary-fixed-dim/30 backdrop-blur-xs">
                <span className={`w-2 h-2 rounded-full ${cameraActive ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`}></span>
                <span className="text-[9px] font-mono text-primary-fixed uppercase font-semibold">
                  {cameraActive ? (cameraFacing === 'environment' ? 'Rear Sensor' : 'User Sensor') : 'Optical Cam 01'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Switch Camera Button */}
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  className="w-7 h-7 rounded-lg bg-primary-container/80 text-primary-fixed hover:bg-primary-container flex items-center justify-center text-xs transition-colors"
                  title="Switch Camera (Front/Back)"
                >
                  <span className="material-symbols-outlined text-[16px]">flip_camera_ios</span>
                </button>
                {/* Flashlight Button */}
                {torchSupported && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors ${
                      torchActive ? 'bg-secondary text-white' : 'bg-primary-container/80 text-primary-fixed hover:bg-primary-container'
                    }`}
                    title="Flashlight"
                  >
                    <span className="material-symbols-outlined text-[16px]">flash_on</span>
                  </button>
                )}
                {/* Upload QR Image Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-7 h-7 rounded-lg bg-primary-container/80 text-primary-fixed hover:bg-primary-container flex items-center justify-center text-xs transition-colors"
                  title="Upload QR Image from File"
                >
                  <span className="material-symbols-outlined text-[16px]">upload_file</span>
                </button>
                {/* Trigger Verification / Scan */}
                <button
                  type="button"
                  onClick={() => handleVerify(inputCode)}
                  className="w-7 h-7 rounded-lg bg-primary-container/80 text-primary-fixed flex items-center justify-center hover:bg-primary-container"
                  title="Verify Pass Token"
                >
                  <span className="material-symbols-outlined text-[16px]">scan</span>
                </button>
              </div>
            </div>

            {/* Hidden File Input for QR Image Upload */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />

            {/* Reticle with Corner Brackets */}
            <div
              className={`relative w-40 h-40 z-10 flex items-center justify-center pointer-events-none transition-all duration-300 ${
                flashDetected ? 'scale-105 border-emerald-400' : ''
              }`}
            >
              <div
                className={`absolute top-0 left-0 w-6 h-6 border-t-[3px] border-l-[3px] rounded-tl-xs transition-colors ${
                  flashDetected ? 'border-emerald-400 shadow-[0_0_12px_#34d399]' : 'border-secondary-fixed'
                }`}
              ></div>
              <div
                className={`absolute top-0 right-0 w-6 h-6 border-t-[3px] border-r-[3px] rounded-tr-xs transition-colors ${
                  flashDetected ? 'border-emerald-400 shadow-[0_0_12px_#34d399]' : 'border-secondary-fixed'
                }`}
              ></div>
              <div
                className={`absolute bottom-0 left-0 w-6 h-6 border-b-[3px] border-l-[3px] rounded-bl-xs transition-colors ${
                  flashDetected ? 'border-emerald-400 shadow-[0_0_12px_#34d399]' : 'border-secondary-fixed'
                }`}
              ></div>
              <div
                className={`absolute bottom-0 right-0 w-6 h-6 border-b-[3px] border-r-[3px] rounded-br-xs transition-colors ${
                  flashDetected ? 'border-emerald-400 shadow-[0_0_12px_#34d399]' : 'border-secondary-fixed'
                }`}
              ></div>

              {/* Scanning laser line */}
              <div
                className={`absolute w-full h-1 bg-gradient-to-r from-transparent via-secondary-fixed to-transparent shadow-[0_0_12px_#89f5e7] ${
                  flashDetected ? 'bg-emerald-400 opacity-90' : 'animate-pulse'
                }`}
              ></div>

              {/* Optical Simulator Reticle Placeholder if camera not active */}
              {!cameraActive && (
                <div className="w-24 h-24 border border-secondary-fixed/30 rounded-lg flex flex-col items-center justify-center bg-primary-container/40 p-2 text-center">
                  <span className="material-symbols-outlined text-[32px] text-secondary-fixed/50">qr_code_scanner</span>
                  <span className="text-[8px] font-mono text-primary-fixed-dim/80 mt-1 uppercase font-semibold">
                    ISO-18004 2D
                  </span>
                </div>
              )}

              {/* Green confirmation checkmark badge on detection */}
              {flashDetected && (
                <div className="absolute inset-0 flex items-center justify-center bg-emerald-950/40 rounded-lg backdrop-blur-xs animate-in zoom-in-75">
                  <span className="material-symbols-outlined text-4xl text-emerald-400 font-bold">check_circle</span>
                </div>
              )}
            </div>

            {/* Bottom Status Ribbon */}
            <div className="absolute bottom-2 inset-x-3 text-center z-20">
              <span className="inline-block px-3 py-0.5 bg-primary-container/90 backdrop-blur-xs rounded-full border border-primary-fixed-dim/30 text-[10px] text-primary-fixed font-medium max-w-[90%] truncate">
                {flashDetected
                  ? 'QR Barcode Detected ✓ Processing Pass...'
                  : imageDecoding
                  ? 'Analyzing uploaded image for QR barcode...'
                  : cameraLoading
                  ? 'Initializing optical camera sensor...'
                  : cameraActive
                  ? 'Align 30-Day QR Pass within focus frame'
                  : cameraError
                  ? 'Optical camera standby. Use image upload or manual token.'
                  : 'Position QR Pass token within optical frame'}
              </span>
            </div>
          </div>

          {/* Camera Permission / Error Warning & Recovery Banner */}
          {cameraError && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-2">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-amber-700 text-[18px] shrink-0 mt-0.5">videocam_off</span>
                <div className="flex-1">
                  <span className="font-bold text-amber-950 block">Camera Offline / Notice</span>
                  <p className="text-[11px] text-amber-800 leading-tight mt-0.5">{cameraError}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-amber-200">
                <button
                  type="button"
                  onClick={() => startCamera(cameraFacing)}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-semibold flex items-center gap-1 shadow-xs transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">refresh</span>
                  <span>Retry Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">upload_file</span>
                  <span>Upload QR Image</span>
                </button>
              </div>
            </div>
          )}

          {/* Manual Entry Fallback */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-3 shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-secondary">keyboard</span>
                Scan / Manual Pass Code
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[10px] text-secondary hover:underline flex items-center gap-0.5 font-semibold"
                >
                  <span className="material-symbols-outlined text-[13px]">add_photo_alternate</span>
                  <span>Upload Pass Image</span>
                </button>
                <span className="text-[10px] font-mono text-on-surface-variant uppercase">Opaque Token</span>
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleVerify(inputCode);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="e.g. SQ-PASS-90412... or MED-042"
                className="flex-1 h-9 px-3 bg-white border border-outline-variant rounded-lg text-primary text-xs font-mono uppercase focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
              />
              <button
                type="submit"
                disabled={scanning}
                className="h-9 px-3.5 bg-primary hover:bg-primary-container text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 shadow-xs whitespace-nowrap disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">verified</span>
                <span>{scanning ? 'Verifying...' : 'Verify'}</span>
              </button>
            </form>
          </section>

          {/* Verification Outcome Box (Strictly Operational Data, No EHR Details) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-secondary">security_update_good</span>
                Gate Clearance Outcome
              </h4>
              <span className="text-[10px] font-mono text-outline font-semibold">Server-Validated</span>
            </div>

            {/* TERMINAL READY STATE (When no pass scanned yet) */}
            {!clearance && (
              <div className="p-4 rounded-xl border border-dashed border-outline-variant text-center bg-surface-container-low/40 space-y-1">
                <span className="material-symbols-outlined text-2xl text-secondary">verified_user</span>
                <p className="text-xs font-semibold text-primary">Terminal Ready for Verification</p>
                <p className="text-[11px] text-on-surface-variant max-w-xs mx-auto">
                  Hold QR pass up to optical camera, upload an image, or enter an opaque pass identifier above to evaluate server gate clearance.
                </p>
              </div>
            )}

            {/* DUPLICATE SCAN WARNING BANNER */}
            {clearance?.isDuplicateScan && (
              <div className="p-2.5 rounded-lg bg-amber-50 border-l-4 border-amber-600 border border-amber-200">
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-amber-700 text-[18px] shrink-0 mt-0.5">warning</span>
                  <div>
                    <span className="text-xs font-bold text-amber-900 block">Duplicate Scan Notification</span>
                    <p className="text-[11px] text-amber-800 leading-tight mt-0.5">
                      {clearance.duplicateWarning || 'Pass already scanned recently. Confirm visitor identity.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* VALID OUTCOME */}
            {clearance?.outcome === 'VALID' && (
              <div className="relative bg-surface-container-lowest border-2 border-secondary rounded-xl overflow-hidden shadow-xs p-3 pl-4">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-secondary"></div>
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-outline-variant">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-secondary-container/40 flex items-center justify-center text-secondary">
                      <span className="material-symbols-outlined text-[16px] font-bold">check_circle</span>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-secondary uppercase tracking-wide block">
                        ACCESS GRANTED
                      </span>
                      <span className="text-[10px] font-mono text-on-surface-variant">
                        Clearance: {clearance.clearanceLevel || 'Tier-1 Ambulatory'}
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-secondary-container/40 text-on-secondary-container font-mono text-[10px] font-bold border border-secondary/30">
                    ACTIVE
                  </span>
                </div>

                {/* Sanitized Operational Grid - STRICTLY NO medical complaints or allergies */}
                <div className="grid grid-cols-2 gap-2 text-left mb-2 text-xs">
                  <div>
                    <span className="text-[9px] uppercase text-on-surface-variant block font-medium">Authorized Visitor</span>
                    <p className="font-bold text-primary truncate">{clearance.patientNameMasked || 'Authorized Visitor'}</p>
                    <span className="text-[10px] font-mono text-outline">
                      Token: <strong className="text-secondary">{clearance.token || 'Active'}</strong>
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-on-surface-variant block font-medium">Designated Clinic</span>
                    <p className="font-semibold text-primary truncate">{clearance.department || 'Outpatient Clinic'}</p>
                    <span className="text-[10px] font-mono text-secondary font-bold">{clearance.room || 'Consultation Room'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-outline-variant bg-surface-container-low/50 -mx-3 -mb-3 px-3 py-2 text-[11px]">
                  <span className="text-on-surface-variant font-mono text-[10px]">
                    Valid: <strong className="text-primary font-semibold">30-Day Pass</strong>
                  </span>
                  <button
                    onClick={handleReleaseBarrier}
                    className={`px-3 py-1 rounded text-[11px] font-semibold transition-all active:scale-95 flex items-center gap-1 shadow-xs ${
                      barrierReleased
                        ? 'bg-emerald-600 text-white'
                        : 'bg-secondary text-white hover:bg-on-secondary-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">door_open</span>
                    <span>{barrierReleased ? 'Barrier Released (Signal Sent)' : 'Release Entry Barrier'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* EXPIRED OUTCOME */}
            {clearance?.outcome === 'EXPIRED' && (
              <div className="relative bg-surface-container-lowest border-2 border-amber-600 rounded-xl overflow-hidden shadow-xs p-3 pl-4">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-600"></div>
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-outline-variant">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-amber-700">history_toggle_off</span>
                    <div>
                      <span className="text-xs font-bold text-amber-800 uppercase tracking-wide block">
                        EXPIRED PASS - ACCESS DENIED
                      </span>
                      <span className="text-[10px] font-mono text-outline">Validity Exceeded (30-Day Rule)</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-mono text-[10px] font-bold">
                    EXPIRED
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant mb-2">
                  {clearance.message || 'Pass has expired beyond the 30-day window. Direct visitor to Central Registration Desk.'}
                </p>
                {clearance.patientNameMasked && (
                  <p className="text-[11px] font-mono text-outline">
                    Visitor: <strong>{clearance.patientNameMasked}</strong> ({clearance.token})
                  </p>
                )}
              </div>
            )}

            {/* REVOKED OUTCOME */}
            {clearance?.outcome === 'REVOKED' && (
              <div className="relative bg-surface-container-lowest border-2 border-error rounded-xl overflow-hidden shadow-xs p-3 pl-4">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-error"></div>
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-red-200">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-error">gavel</span>
                    <div>
                      <span className="text-xs font-bold text-error uppercase tracking-wide block">
                        SECURITY HOLD - ENTRY SUSPENDED
                      </span>
                      <span className="text-[10px] font-mono text-error">Status: Revoked by Infection/Security</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-error text-white font-mono text-[10px] font-bold">
                    REVOKED
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant mb-2">
                  {clearance.message || 'Pass revoked by hospital protocol. Escort visitor to External Screening.'}
                </p>
              </div>
            )}

            {/* INVALID PAYLOAD */}
            {clearance?.outcome === 'INVALID' && (
              <div className="relative bg-surface-container-lowest border-2 border-outline-variant rounded-xl overflow-hidden shadow-xs p-3 pl-4">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-outline"></div>
                <div className="flex items-center justify-between pb-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-outline">qr_code_2</span>
                    <div>
                      <span className="text-xs font-bold text-primary uppercase tracking-wide block">
                        INVALID PASS SIGNATURE
                      </span>
                      <span className="text-[10px] font-mono text-outline">Unrecognized Token</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-mono text-[10px] font-bold">
                    INVALID
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant">
                  {clearance.message || 'Scanned token does not match any active hospital visit record.'}
                </p>
              </div>
            )}
          </div>

          {/* Test Fixture Triggers */}
          <div className="pt-1">
            <span className="text-[10px] font-mono uppercase text-outline tracking-wider font-semibold block mb-1">
              Live Test Fixtures (Genuine Server Verification):
            </span>
            <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
              <button
                type="button"
                onClick={() => {
                  setInputCode('SQ-PASS-90412E5F6A7B8C9D0E1F-B');
                  handleVerify('SQ-PASS-90412E5F6A7B8C9D0E1F-B');
                }}
                className="py-1 px-1 rounded bg-secondary-container/30 border border-secondary text-secondary font-semibold hover:bg-secondary-container"
              >
                Valid Pass
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputCode('SQ-PASS-EXPIRED-TEST-FIXTURE-B');
                  handleVerify('SQ-PASS-EXPIRED-TEST-FIXTURE-B');
                }}
                className="py-1 px-1 rounded bg-amber-50 border border-amber-300 text-amber-800 font-semibold hover:bg-amber-100"
              >
                Expired (35d)
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputCode('SQ-PASS-REVOKED-TEST-FIXTURE-B');
                  handleVerify('SQ-PASS-REVOKED-TEST-FIXTURE-B');
                }}
                className="py-1 px-1 rounded bg-red-50 border border-red-300 text-error font-semibold hover:bg-red-100"
              >
                Revoked Pass
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputCode('SQ-UNKNOWN-QR-999');
                  handleVerify('SQ-UNKNOWN-QR-999');
                }}
                className="py-1 px-1 rounded bg-surface-container border border-outline-variant text-on-surface hover:bg-surface-container-high"
              >
                Unknown QR
              </button>
            </div>
          </div>

          {/* Persistent Gate Audit Trail */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-3 shadow-xs">
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-outline-variant text-xs">
              <span className="font-bold text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">receipt_long</span>
                Gate Scan Audit Trail (Logged to Disk)
              </span>
              <span className="text-[10px] font-mono text-secondary font-semibold">SEC-402</span>
            </div>
            <ul className="space-y-1 text-xs font-mono max-h-36 overflow-y-auto">
              {auditLogs.length === 0 ? (
                <li className="text-[10px] text-on-surface-variant py-1 text-center">No scans recorded yet.</li>
              ) : (
                auditLogs.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between p-1.5 rounded bg-surface-container-low border border-outline-variant/60"
                  >
                    <div className="flex items-center gap-1.5 truncate max-w-[65%]">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          item.outcome === 'VALID'
                            ? 'bg-secondary'
                            : item.outcome === 'EXPIRED'
                            ? 'bg-amber-600'
                            : 'bg-error'
                        }`}
                      ></span>
                      <span className="font-bold text-primary truncate">
                        {item.token || (typeof item.passIdOrCode === 'string' ? item.passIdOrCode.substring(0, 14) : String(item.passIdOrCode || ''))}
                      </span>
                      {item.patientNameMasked && (
                        <span className="text-on-surface-variant text-[10px] truncate">
                          ({item.patientNameMasked})
                        </span>
                      )}
                      {item.isDuplicate && (
                        <span className="text-[8px] bg-amber-200 text-amber-900 px-1 rounded font-bold">DUP</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] shrink-0">
                      <span
                        className={`px-1 py-0.2 rounded font-bold uppercase text-[9px] ${
                          item.outcome === 'VALID'
                            ? 'bg-secondary-container/40 text-on-secondary-container'
                            : 'bg-error-container text-error'
                        }`}
                      >
                        {item.outcome}
                      </span>
                      <span className="text-outline text-[9px]">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};
