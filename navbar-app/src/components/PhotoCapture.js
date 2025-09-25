import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Alert
} from '@mui/material';
import {
  CameraAlt as CameraIcon,
  PhotoLibrary as GalleryIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  CameraEnhance as CaptureIcon
} from '@mui/icons-material';
import { Add as AddIcon } from '@mui/icons-material';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

/**
 * PhotoCapture component
 * Props:
 * - photo: string | null (data URL)
 * - onPhotoCapture: (dataUrl: string) => void
 * - onPhotoClear: () => void
 */
const PhotoCapture = ({ photo, onPhotoCapture, onPhotoClear }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  // Cropping state (freeform like mobile)
  const [isCropping, setIsCropping] = useState(false);
  const [cropSrc, setCropSrc] = useState(null); // data URL to crop
  const [crop, setCrop] = useState({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgRef = useRef(null);

  const openDialog = () => {
    setIsDialogOpen(true);
    setError('');
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    stopCamera();
    setIsCapturing(false);
    // reset crop state
    setIsCropping(false);
    setCropSrc(null);
    setCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
    setCompletedCrop(null);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    try {
      setError('');
      setIsCapturing(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment'
        }
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Camera access denied:', error);
      setError('Unable to access camera. Please check permissions or use file upload.');
      setIsCapturing(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

    stopCamera();
    setIsCapturing(false);
    // Enter crop mode with captured frame
    setCropSrc(dataUrl);
    setCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
    setCompletedCrop(null);
    setIsCropping(true);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target.result;
      // Enter crop mode; we'll compress after crop
      setCropSrc(imageData);
      setCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
      setCompletedCrop(null);
      setIsCropping(true);
    };
    reader.readAsDataURL(file);
  };

  const compressImage = (imageData, callback) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const maxSize = 800;
      let { width, height } = img;
      if (width > height && width > maxSize) {
        height = (height * maxSize) / width;
        width = maxSize;
      } else if (height > maxSize) {
        width = (width * maxSize) / height;
        height = maxSize;
      }
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      const compressedData = canvas.toDataURL('image/jpeg', 0.8);
      callback(compressedData);
    };
    img.src = imageData;
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const toPixelCrop = (c, imgEl) => {
    if (!c || !imgEl) return null;
    const imgW = imgEl.width;
    const imgH = imgEl.height;
    const isPct = c.unit === '%';
    const x = Math.max(0, Math.round((isPct ? c.x * imgW / 100 : c.x)));
    const y = Math.max(0, Math.round((isPct ? c.y * imgH / 100 : c.y)));
    const width = Math.max(1, Math.round((isPct ? c.width * imgW / 100 : c.width)));
    const height = Math.max(1, Math.round((isPct ? c.height * imgH / 100 : c.height)));
    return { x, y, width, height };
  };

  const handleImageLoad = (e) => {
    const imgEl = e.currentTarget;
    // Seed completedCrop if user hasn't interacted yet
    const px = toPixelCrop(crop, imgEl);
    if (px) setCompletedCrop(px);
  };

  const applyCrop = async () => {
    if (!cropSrc || !imgRef.current) return;
    try {
      const image = imgRef.current;
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      const pxCrop = completedCrop || toPixelCrop(crop, image);
      if (!pxCrop) return;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = pxCrop.width;
      canvas.height = pxCrop.height;
      ctx.drawImage(
        image,
        pxCrop.x * scaleX,
        pxCrop.y * scaleY,
        pxCrop.width * scaleX,
        pxCrop.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height
      );
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      onPhotoCapture && onPhotoCapture(dataUrl);
      // reset crop state and close dialog
      setIsCropping(false);
      setCropSrc(null);
      setCompletedCrop(null);
      setCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
      closeDialog();
    } catch (err) {
      console.error('Crop failed', err);
      setError('Failed to crop image. Please try again.');
    }
  };

  const cancelCrop = () => {
    setIsCropping(false);
    setCropSrc(null);
    setCompletedCrop(null);
    setCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
  };

  return (
    <Box sx={{ p: 0, m: 0 }}>

      {photo ? (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, mb: 2, py: 0 }}>
          <Box
            sx={{
              width: 220,
              height: 260,
              borderRadius: '20px',
              overflow: 'hidden',
              border: '2px solid #000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'transparent',
              margin: '0 auto'
            }}
          >
            <img
              src={photo}
              alt="Child"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 12/8, mt: 0, width: 220, justifyContent: 'space-between', margin: '0 auto' }}>
            <button type="button" className="photo-action-btn" onClick={openDialog} style={{flex:'1 1 0', maxWidth:'calc(50% - 6px)'}}>
              <CameraIcon sx={{ fontSize: 18 }} />
              <span>Retake</span>
            </button>
            <button type="button" className="photo-action-btn" onClick={onPhotoClear} style={{flex:'1 1 0', maxWidth:'calc(50% - 6px)'}}>
              <DeleteIcon sx={{ fontSize: 18 }} />
              <span>Remove</span>
            </button>
          </Box>
        </Box>
      ) : (
        <Box sx={{ py: 0 }}>
          <Box
            sx={{
              width: 220,
              height: 260,
              border: '2px solid #000',
              borderRadius: '20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'transparent',
              cursor: 'pointer',
              margin: '0 auto',
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                borderColor: '#000',
                bgcolor: 'transparent',
                transform: 'scale(1.03)'
              }
            }}
            onClick={openDialog}
          >
            <Box sx={{ display:'flex', alignItems:'center', gap: 1 }}>
              <AddIcon sx={{ fontSize: 24, color: '#000' }} />
              <Typography variant="body1" sx={{ color: '#000', fontWeight: 600 }}>
                Add Photo
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* Photo Capture Dialog */}
  <Dialog open={isDialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth PaperProps={{ sx: { minHeight: 180 } }}>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Add Photo</Typography>
            <IconButton onClick={closeDialog}><CloseIcon /></IconButton>
          </Box>
        </DialogTitle>

  <DialogContent sx={{ pt: 3, overflow: 'visible' }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
          )}

          {isCropping ? (
            <Box>
              <Box sx={{ width: '100%', maxHeight: 420, display: 'flex', justifyContent: 'center' }}>
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  onComplete={(c) => setCompletedCrop(c)}
                  keepSelection
                  minWidth={10}
                  minHeight={10}
                >
                  <img
                    ref={imgRef}
                    src={cropSrc}
                    alt="Crop source"
                    style={{ maxWidth: '100%', maxHeight: 380, display: 'block' }}
                    onLoad={handleImageLoad}
                  />
                </ReactCrop>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                <Button variant="outlined" onClick={cancelCrop}>Back</Button>
                <Button variant="contained" onClick={applyCrop}>Apply</Button>
              </Box>
            </Box>
          ) : isCapturing ? (
            <Box sx={{ textAlign: 'center' }}>
              <video ref={videoRef} autoPlay playsInline style={{ width: '100%', maxWidth: '400px', borderRadius: '8px' }} />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 2 }}>
                <Button variant="contained" onClick={capturePhoto} startIcon={<CaptureIcon />} size="large" sx={{ minWidth: 190 }}>
                  Capture Photo
                </Button>
                <Button variant="outlined" size="large" sx={{ minWidth: 190 }} onClick={() => { stopCamera(); setIsCapturing(false); }}>
                  Cancel
                </Button>
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Button variant="contained" startIcon={<CameraIcon />} onClick={startCamera} size="large" sx={{ minWidth: 240 }}>
                Use Camera
              </Button>
              <Button variant="outlined" startIcon={<GalleryIcon />} onClick={() => fileInputRef.current?.click()} size="large" sx={{ minWidth: 240 }}>
                Choose from Gallery
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
            </Box>
          )}
        </DialogContent>

      </Dialog>
    </Box>
  );
};

export default PhotoCapture;
