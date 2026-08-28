import { NextResponse } from 'next/server';
import { createClient } from 'redis';

export async function GET(request: Request) {
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
        async start(controller) {
            const redis = createClient({ url: 'redis://localhost:6379' });
            
            redis.on('error', (err) => console.error('Redis Client Error', err));
            await redis.connect();
            
            await redis.subscribe('dashboard-events', (message) => {
                controller.enqueue(encoder.encode(`data: ${message}\n\n`));
            });

            request.signal.addEventListener('abort', () => {
                redis.quit();
            });
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
