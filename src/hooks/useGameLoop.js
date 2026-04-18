import { useRef, useEffect } from 'react';

export function useGameLoop(callback, interval, running) {
  const callbackRef = useRef(callback);
  const lastTimeRef = useRef(0);
  const accumulatorRef = useRef(0);
  const frameRef = useRef(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!running) {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      accumulatorRef.current = 0;
      return;
    }

    const loop = (timestamp) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      accumulatorRef.current += delta;

      while (accumulatorRef.current >= interval) {
        callbackRef.current();
        accumulatorRef.current -= interval;
      }

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      lastTimeRef.current = 0;
      accumulatorRef.current = 0;
    };
  }, [interval, running]);
}
