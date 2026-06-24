import os
import sys
import logging
import asyncio
from PIL import Image

logger = logging.getLogger(__name__)

def run_sync(coro):
    """Helper to run an async coroutine synchronously, handling running event loops."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
    if loop.is_running():
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(lambda: asyncio.run(coro))
            return future.result()
    else:
        return loop.run_until_complete(coro)


class OCRManager:
    _instance = None
    _reader = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(OCRManager, cls).__new__(cls, *args, **kwargs)
        return cls._instance

    def initialize(self):
        """Pre-initialize the OCR engine and detect GPU availability automatically on non-Windows platforms."""
        if sys.platform != "win32" and self._reader is None:
            try:
                import torch
                import easyocr
                
                # Dynamically detect if a CUDA-compatible GPU is available
                gpu_available = torch.cuda.is_available()
                
                logger.info(f"Initializing EasyOCR (GPU/CUDA Detected: {gpu_available})...")
                self._reader = easyocr.Reader(['en'], gpu=gpu_available)
                logger.info("EasyOCR initialized successfully.")
            except ImportError as e:
                logger.error(f"Failed to import torch or easyocr on non-Windows platform: {e}")
                raise e

    def recognize(self, pil_image: Image.Image) -> str:
        """Process image and return recognized text."""
        # 1. Use Windows-native OCR if on Windows
        if sys.platform == "win32":
            try:
                import winocr
                ocr_result = run_sync(winocr.recognize_pil(pil_image))
                return ocr_result.text if ocr_result else ""
            except Exception as e:
                logger.error(f"winocr failure: {e}")
                raise e

        # 2. Use EasyOCR on Linux/macOS
        if self._reader is None:
            self.initialize()
            
        import numpy as np
        img_np = np.array(pil_image)
        
        # Run inference
        results = self._reader.readtext(img_np)
        
        # Combine text segments
        return " ".join([res[1] for res in results])

ocr_manager = OCRManager()
