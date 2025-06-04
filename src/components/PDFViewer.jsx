import { useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export default function PDFViewer({ data }) {
  const containerRef = useRef();

  useEffect(() => {
    const renderAllPages = async () => {
      const binaryString = atob(data);
      const uint8Array = Uint8Array.from(binaryString, (c) => c.charCodeAt(0));

      const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;

      const container = containerRef.current;
      container.innerHTML = '';

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const devicePixelRatio = window.devicePixelRatio || 1;

        canvas.width = viewport.width * devicePixelRatio;
        canvas.height = viewport.height * devicePixelRatio;
        canvas.style.width = viewport.width + 'px';
        canvas.style.height = viewport.height + 'px';
        context.scale(devicePixelRatio, devicePixelRatio);

        await page.render({ canvasContext: context, viewport }).promise;
        container.appendChild(canvas);
      }
    };

    renderAllPages();
  }, [data]);

  return <div ref={containerRef} className="flex flex-col gap-4" />;
}
