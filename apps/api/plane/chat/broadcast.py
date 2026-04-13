"""Planer Chat: broadcast messages via Redis pub/sub."""
import json
import logging
import os

import redis

logger = logging.getLogger("plane.chat.broadcast")

REDIS_URL = os.environ.get("REDIS_URL", "redis://plane-redis:6379/0")

_redis_client = None


def _get_redis():
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(REDIS_URL)
    return _redis_client


def broadcast_message(channel_id: str, message_data: dict):
    """Publish a new message event to Redis for WebSocket relay."""
    try:
        r = _get_redis()
        payload = json.dumps({
            "type": "message.new",
            "message": message_data,
        })
        r.publish(f"chat:{channel_id}", payload)
        logger.debug("Broadcast message to chat:%s", channel_id)
    except Exception as e:
        logger.warning("Failed to broadcast: %s", e)
