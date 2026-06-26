from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from app.config import settings

# Global thread pool sized by application settings
_sync_executor = ThreadPoolExecutor(max_workers=settings.OCR_POOL_WORKERS)


def run_sync(coro):
    """Helper to run an async coroutine synchronously, handling running event loops."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
    if loop.is_running():
        future = _sync_executor.submit(lambda: asyncio.run(coro))
        return future.result()
    else:
        return loop.run_until_complete(coro)
