import { useEffect, useState, useRef } from "react";

interface LoadingScreenProps {
  message?: string;
  error?: boolean;
  progress?: number; // 0-100
}

export function LoadingScreenComponent({
  message,
  error,
  progress,
}: LoadingScreenProps) {
  // Animated progress value for smooth transitions
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const currentProgressRef = useRef(0);

  useEffect(() => {
    if (progress !== undefined) {
      // Cancel any ongoing animation
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Smoothly animate to the target progress value
      const duration = 300; // Animation duration in ms
      const startProgress = currentProgressRef.current;
      const targetProgress = Math.max(0, Math.min(100, progress));
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progressRatio = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation (ease-out)
        const easeOut = 1 - Math.pow(1 - progressRatio, 3);
        const currentProgress = startProgress + (targetProgress - startProgress) * easeOut;
        
        currentProgressRef.current = currentProgress;
        setAnimatedProgress(currentProgress);

        if (progressRatio < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          currentProgressRef.current = targetProgress;
          setAnimatedProgress(targetProgress);
          animationFrameRef.current = null;
        }
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    }

    // Cleanup function
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [progress]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black z-50">
      <div className="flex flex-col items-center gap-6 w-full max-w-md px-8">
        {/* Progress Bar Container */}
        {progress !== undefined && (
          <div className="w-full">
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{
                  width: `${animatedProgress}%`,
                }}
              />
            </div>
            <div className="mt-2 text-center">
              <span className="text-white text-sm font-mono">
                {Math.round(animatedProgress)}%
              </span>
            </div>
          </div>
        )}

        {/* Message */}
        {message && (
          <p className="text-white text-lg text-center max-w-xs">{message}</p>
        )}

        {/* Error Button */}
        {error && (
          <button
            onClick={() => document.location.reload()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
