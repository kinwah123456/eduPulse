import sys
from unittest.mock import patch, MagicMock, AsyncMock
import pytest
from PIL import Image

# Inject mocks into sys.modules before importing ocr_manager to prevent actual DLL import failures on the host
mock_torch = MagicMock()
mock_torch.cuda.is_available.return_value = False
sys.modules['torch'] = mock_torch

mock_easyocr = MagicMock()
sys.modules['easyocr'] = mock_easyocr

from app.services.ocr_service import ocr_manager

def test_ocr_manager_singleton():
    """Verify OCRManager follows the singleton pattern."""
    from app.services.ocr_service import OCRManager
    mgr1 = OCRManager()
    mgr2 = OCRManager()
    assert mgr1 is mgr2

@patch("sys.platform", "win32")
@patch("winocr.recognize_pil", new_callable=AsyncMock)
def test_ocr_manager_windows(mock_winocr):
    """Verify OCRManager delegates to winocr when running on Windows."""
    # Setup mock return value
    mock_result = MagicMock()
    mock_result.text = "Hello Windows OCR"
    mock_winocr.return_value = mock_result
    
    # Run test
    test_img = Image.new('RGB', (10, 10), color='white')
    text = ocr_manager.recognize(test_img)
    
    # Assertions
    assert text == "Hello Windows OCR"
    mock_winocr.assert_called_once_with(test_img)

@patch("sys.platform", "linux")
def test_ocr_manager_linux_cpu():
    """Verify OCRManager delegates to EasyOCR on Linux with CPU fallback."""
    # Setup mock reader
    mock_reader = MagicMock()
    mock_reader.readtext.return_value = [
        (None, "Hello", 0.9),
        (None, "Linux", 0.95),
        (None, "CPU", 0.88),
    ]
    mock_easyocr.Reader.return_value = mock_reader
    
    # Reset ocr_manager's cached reader to force initialization
    ocr_manager._reader = None
    
    # Run test
    test_img = Image.new('RGB', (10, 10), color='white')
    text = ocr_manager.recognize(test_img)
    
    # Assertions
    assert text == "Hello Linux CPU"
    mock_easyocr.Reader.assert_called_once_with(['en'], gpu=False)
    mock_reader.readtext.assert_called_once()
