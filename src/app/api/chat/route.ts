import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY as string;
if (!GOOGLE_API_KEY) {
  throw new Error('Missing GOOGLE_API_KEY environment variable');
}

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Valid message is required' },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash-latest',
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      }
    });
    
    const result = await model.generateContent(message);
    const response = await result.response;
    const text = response.text().trim(); // Add .trim() to remove any leading/trailing whitespace

    if (!text) {
      return NextResponse.json(
        { error: 'No meaningful response generated' },
        { status: 400 }
      );
    }

    return NextResponse.json({ response: text });

  } catch (error) {
    console.error('Detailed Error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error 
          ? error.message 
          : 'Failed to generate response'
      },
      { status: 500 }
    );
  }
}