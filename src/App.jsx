import { useRef, useEffect, useState } from 'react';
import './App.css';
import * as faceapi from 'face-api.js';

function App() {
  const videoRef = useRef();
  const canvasRef = useRef();
  const [expressions, setExpressions] = useState({});
  const [dominantExpression, setDominantExpression] = useState('');

  useEffect(() => {
    startVideo();
    loadModels();
  }, []);

  // Open webcam
  const startVideo = () => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((currentStream) => {
        videoRef.current.srcObject = currentStream;
      })
      .catch((err) => {
        console.error('Error accessing webcam:', err);
      });
  };

  // Load models from face-api.js
  const loadModels = async () => {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
      faceapi.nets.faceExpressionNet.loadFromUri('/models'),
    ]);
    startDetection();
  };

  // Start face detection
  const startDetection = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Run detection loop
    video.addEventListener('loadedmetadata', () => {
      const displaySize = {
        width: video.videoWidth,
        height: video.videoHeight,
      };

      // Match canvas to video size
      faceapi.matchDimensions(canvas, displaySize);

      setInterval(async () => {
        // Detect faces
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.2 }))
          .withFaceLandmarks()
          .withFaceExpressions();

        // Resize detections to match canvas
        const resizedDetections = faceapi.resizeResults(detections, displaySize);

        // Clear previous drawings
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Draw detections on canvas
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
        faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

        if (detections.length > 0) {
          console.log(detections)
          const detectedExpressions = detections[0].expressions;
          setExpressions(detectedExpressions);
          const highestExpression = Object.keys(detectedExpressions).reduce((a, b) =>
            detectedExpressions[a] > detectedExpressions[b] ? a : b
          );
          setDominantExpression(highestExpression);
        } else {
          setExpressions({});
          setDominantExpression('No face detected');
        }
      }, 300);
    });
  };


  return (
    <div className="myapp">
      <div className="video-container">
        {/* Video feed */}
        <video ref={videoRef} autoPlay muted crossOrigin="anonymous"></video>
        {/* Overlay canvas */}
        <canvas id="expressions" ref={canvasRef} />
      </div>
    </div>
  );
}

export default App;
