import React, { useRef, useEffect, useState } from "react";
import * as faceDetection from "@tensorflow-models/face-detection";
import "@tensorflow/tfjs-backend-webgl";

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [detector, setDetector] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);

  useEffect(() => {
    loadModel();
    startVideo();

    videoRef.current?.addEventListener("loadeddata", detectFaces);

    return () => {
      videoRef.current?.removeEventListener("loadeddata", detectFaces);
    };
  }, []);

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
      });
      videoRef.current.srcObject = stream;
    } catch (error) {
      console.error("Error accessing video stream:", error);
    }
  };

  const loadModel = async () => {
    try {
      const model = await faceDetection.createDetector(
        faceDetection.SupportedModels.MediaPipeFaceDetector,
        {
          runtime: "tfjs",
          maxFaces: 5,
          modelType: "full",
        }
      );
      setDetector(model);
    } catch (error) {
      console.error("Error loading model:", error);
    }
  };

  const detectFaces = async () => {
    if (!detector || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    try {
      const faces = await detector.estimateFaces(video);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (faces.length > 0) {
        setFaceDetected(true);
        faces.forEach((face) => {
          const { xMin, yMin, width, height } = face.box;
          ctx.strokeStyle = "red";
          ctx.lineWidth = 2;
          ctx.strokeRect(xMin, yMin, width, height);
        });
      } else {
        setFaceDetected(false);
      }
    } catch (error) {
      console.error("Error during face detection:", error);
      setFaceDetected(false);
    }

    requestAnimationFrame(detectFaces);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>Face Detection App</h1>
      <div style={styles.videoContainer}>
        <video
          ref={videoRef}
          autoPlay
          muted
          style={styles.video}
        />
        <canvas ref={canvasRef} style={styles.canvas} />
      </div>
      <div style={styles.status}>
        {faceDetected ? (
          <span style={{ color: "green" }}>Face Detected ✅</span>
        ) : (
          <span style={{ color: "red" }}>No Face Detected ❌</span>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    textAlign: "center",
    padding: "20px",
    fontFamily: "Arial, sans-serif",
  },
  header: {
    fontSize: "2rem",
    marginBottom: "20px",
  },
  videoContainer: {
    position: "relative",
    display: "inline-block",
    width: "80%",
    maxWidth: "800px",
  },
  video: {
    width: "100%",
    height: "auto",
    border: "2px solid black",
    transform: "scaleX(-1)",
  },
  canvas: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    transform: "scaleX(-1)",
  },
  status: {
    marginTop: "20px",
    fontSize: "1.2rem",
    fontWeight: "bold",
  },
};

export default App;
