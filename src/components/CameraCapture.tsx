import { useEffect, useRef } from "react";
import { Button } from "./ui/button";

interface Props {
  onCapture: (base64: string) => void;
}

export function CameraCapture({ onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });

    return () => {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0);

    const base64 = canvas.toDataURL("image/jpeg");
    onCapture(base64);
  };

  return (
    <div className="space-y-3">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="rounded-md border w-full"
      />
      <canvas ref={canvasRef} className="hidden" />
      <Button type="button" onClick={takePhoto}>
        Tomar fotografía
      </Button>
    </div>
  );
}
