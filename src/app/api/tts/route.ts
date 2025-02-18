import { CartesiaClient } from "@cartesia/cartesia-js";
import { NextResponse } from 'next/server';

const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY as string;
if (!CARTESIA_API_KEY) {
  throw new Error('Missing CARTESIA_API_KEY environment variable');
}

const client = new CartesiaClient({ apiKey: CARTESIA_API_KEY });

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    console.log('Received text for TTS:', text);

    const audioBuffer = await client.tts.bytes({
      modelId: 'sonic-english',
      transcript: text,
      voice: {
        mode: 'id',
        id: 'f108a63d-d60b-4860-97ac-bef30bb81940', // Your specific voice ID
      },
      outputFormat: {
        container: 'wav',
        encoding: 'pcm_f32le',
        sampleRate: 44100
      }
    });

    const blob = new Blob([audioBuffer], { type: 'audio/wav' });
    
    console.log('Audio Blob Details:', {
      size: blob.size,
      type: blob.type
    });
  
    return new NextResponse(blob, {
      headers: { 
        'Content-Type': 'audio/wav',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    console.error('TTS Generation Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error 
          ? error.message 
          : 'Failed to generate speech'
      },
      { status: 500 }
    );
  }
}