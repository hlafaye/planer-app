"""Planer Chat WebSocket server — lightweight Redis pub/sub relay.

Runs as a standalone process alongside the main API.
Listens on port 8001, receives WebSocket connections at /ws/chat/{channel_id}/
and relays messages published to Redis channel `chat:{channel_id}`.

Usage: python -m plane.chat.ws_server
"""
import asyncio
import json
import logging
import os

import redis.asyncio as aioredis
import websockets

logger = logging.getLogger("plane.chat.ws")
logging.basicConfig(level=logging.INFO)

REDIS_URL = os.environ.get("REDIS_URL", "redis://plane-redis:6379/0")
WS_PORT = int(os.environ.get("CHAT_WS_PORT", "8001"))

# Track connections per channel
connections: dict[str, set] = {}


async def handler(websocket, path: str):
    """Handle a WebSocket connection for a chat channel."""
    # Extract channel_id from path: /ws/chat/{channel_id}/
    parts = path.strip("/").split("/")
    if len(parts) < 3 or parts[0] != "ws" or parts[1] != "chat":
        await websocket.close(1008, "Invalid path")
        return

    channel_id = parts[2]

    if channel_id not in connections:
        connections[channel_id] = set()
    connections[channel_id].add(websocket)
    logger.info("Client connected to channel %s (%d clients)", channel_id, len(connections[channel_id]))

    try:
        # Subscribe to Redis channel
        r = aioredis.from_url(REDIS_URL)
        pubsub = r.pubsub()
        await pubsub.subscribe(f"chat:{channel_id}")

        # Listen for Redis messages and forward to WebSocket
        async def redis_listener():
            async for msg in pubsub.listen():
                if msg["type"] == "message":
                    data = msg["data"]
                    if isinstance(data, bytes):
                        data = data.decode()
                    # Send to this client
                    try:
                        await websocket.send(data)
                    except websockets.ConnectionClosed:
                        break

        # Run Redis listener and wait for WebSocket close
        listener_task = asyncio.create_task(redis_listener())

        try:
            async for _ in websocket:
                pass  # We don't process incoming messages from clients
        finally:
            listener_task.cancel()
            await pubsub.unsubscribe(f"chat:{channel_id}")
            await r.aclose()

    except Exception as e:
        logger.error("WebSocket error: %s", e)
    finally:
        connections.get(channel_id, set()).discard(websocket)
        logger.info("Client disconnected from channel %s", channel_id)


async def main():
    logger.info("Chat WebSocket server starting on port %d", WS_PORT)
    async with websockets.serve(handler, "0.0.0.0", WS_PORT):
        await asyncio.Future()  # Run forever


if __name__ == "__main__":
    asyncio.run(main())
