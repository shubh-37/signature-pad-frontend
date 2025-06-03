import { useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export default function PDFViewer({ data }) {
  const containerRef = useRef();

  useEffect(() => {
    const renderAllPages = async () => {
      const pdf = await pdfjsLib.getDocument({ data }).promise;

      const container = containerRef.current;
      container.innerHTML = ''; // Clear previous pages

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 }); // Increased from 1.5 to 2.0

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        // Get device pixel ratio for high DPI displays
        const devicePixelRatio = window.devicePixelRatio || 1;

        // Set actual canvas size
        canvas.width = viewport.width * devicePixelRatio;
        canvas.height = viewport.height * devicePixelRatio;

        // Scale canvas back down using CSS
        canvas.style.width = viewport.width + 'px';
        canvas.style.height = viewport.height + 'px';

        // Scale the drawing context so everything renders at higher resolution
        context.scale(devicePixelRatio, devicePixelRatio);

        await page.render({ canvasContext: context, viewport }).promise;
        container.appendChild(canvas);
      }
    };

    renderAllPages();
  }, [data]);

  return <div ref={containerRef} className="flex flex-col gap-4" />;
}
