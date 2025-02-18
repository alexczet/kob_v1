'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Mic, Speaker, X } from "lucide-react";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function Home() {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSpeechRecognitionEnabled, setIsSpeechRecognitionEnabled] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [audioQueue, setAudioQueue] = useState<string[]>([]);
  const recognition = useRef<SpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const generateAndQueueAudio = async (text: string) => {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('TTS API Error:', errorText);
        throw new Error('Failed to generate speech');
      }

      const blob = await response.blob();
      console.log('Audio Blob Details:', {
        type: blob.type,
        size: blob.size
      });

      if (!['audio/wav', 'audio/mpeg', 'audio/mp3'].includes(blob.type)) {
        console.error('Invalid audio mime type:', blob.type);
        throw new Error('Invalid audio format');
      }

      const url = URL.createObjectURL(blob);

      setAudioQueue(prev => [...prev, url]);

      if (!isPlaying) {
        playNextAudio();
      }
    } catch (error: any) {
      console.error('Audio Generation Error:', error);
      // Display an error message to the user
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error generating audio: ${error.message || 'Unknown error'}`
      }]);
    }
  };

  const playNextAudio = useCallback(() => {
    console.group('Audio Playback Debug');
    console.log('Audio Queue:', audioQueue);
    console.log('Is Playing:', isPlaying);
    
    if (audioQueue.length > 0) {
      const [nextAudio, ...remainingQueue] = audioQueue;
      
      console.log('Next Audio URL:', nextAudio);
      
      if (audioRef.current) {
        try {
          console.log('Audio Ref Properties:', {
            src: audioRef.current.src,
            paused: audioRef.current.paused,
            duration: audioRef.current.duration
          });

          audioRef.current.src = nextAudio;
          
          audioRef.current.onerror = (e) => {
            console.error('Detailed Audio Element Error:', {
              type: e.type,
              target: e.target,
              currentSrc: audioRef.current?.currentSrc
            });
          };

          const playPromise = audioRef.current.play();
          setIsSpeechRecognitionEnabled(false);
          
          playPromise
            .then(() => {
              console.log('Audio Playback Started Successfully');
              setIsPlaying(true);
              setAudioQueue(remainingQueue);
            
            })
            .catch((error) => {
              console.error('Detailed Playback Error:', {
                name: error.name,
                message: error.message,
                stack: error.stack
              });
              
              setIsPlaying(false);
              setAudioQueue(remainingQueue);
            
            })
            .finally(() => {
              setIsSpeechRecognitionEnabled(true);
              setAudioQueue(remainingQueue);
            });
        } catch (error) {
          console.error('Audio Playback Setup Error:', error);
        }
      } else {
        console.error('Audio Ref is null');
      }
    } else {
      console.log('No audio in queue');
      setIsPlaying(false);
    }
    
    console.groupEnd();
  }, [audioQueue, generateAndQueueAudio]);

  const debugAudioPlayback = () => {
    if (audioQueue.length > 0) {
      const audioUrl = audioQueue[0];
      console.log('Debugging Audio URL:', audioUrl);
      
      const audio = new Audio(audioUrl);
      
      audio.oncanplaythrough = () => {
        console.log('Audio can play through');
        audio.play()
          .then(() => console.log('Manual play successful'))
          .catch((error) => {
            console.error('Detailed Manual Play Error:', {
              name: error.name,
              message: error.message,
              stack: error.stack
            });
          });
      };

      audio.onerror = (e) => {
        console.error('Detailed Manual Audio Error:', {
          type: e.type,
          error: (e.target as HTMLAudioElement).error
        });
      };
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognition.current = new SpeechRecognition();
        recognition.current.continuous = true;
        recognition.current.interimResults = false;

        recognition.current.onresult = async (event: SpeechRecognitionEvent) => {
          const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
          
          // Check for interrupt trigger words
          if (transcript.includes("stop") || transcript.includes("cancel")) {
            stopAudio();
            return;
          }

          setMessages(prev => [...prev, { role: 'user', content: transcript }]);
          
          try {
            setIsProcessing(true);
            const response = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: text })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
              throw new Error(data.error || 'Failed to get AI response');
            }
            
            if (!data.response) {
              throw new Error('No response from AI');
            }
            
            setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
            
            // Immediately generate and queue audio for the AI response
            generateAndQueueAudio(data.response);
          } catch (error) {
            console.error('Error getting AI response:', error);
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: error instanceof Error
                ? error.message
                : 'Sorry, I encountered an error. Please try again in a moment.'
            }]);
          } finally {
            setIsProcessing(false);
          }
        };

        recognition.current.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };
      }
    }
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isSpeechRecognitionEnabled && recognition.current) {
        startListening();
      } else {
        stopListening();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      audioQueue.forEach(URL.revokeObjectURL);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [generateAndQueueAudio, audioQueue, isSpeechRecognitionEnabled]);

  const startListening = () => {
    if (recognition.current && isSpeechRecognitionEnabled) {
      try {
        (recognition.current as SpeechRecognition).start();
        setIsListening(true);
      } catch (error) {
        console.error('Speech recognition start error:', error);
        setIsListening(false);
        alert('Error starting speech recognition. Please try again.');
      }
    }
  };

  const stopListening = () => {
    if (recognition.current) {
      (recognition.current as SpeechRecognition).stop();
      setIsListening(false);
    }
  };

  const toggleListening = () => {
    if (!recognition.current) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setAudioQueue([]);
    setIsPlaying(false);
    setIsSpeechRecognitionEnabled(true);
    startListening();
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <Card className="mx-auto max-w-2xl bg-gray-800">
        <CardHeader>
          <h1 className="text-2xl font-bold text-center text-white">Voice Chat Bot</h1>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mb-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg ${
                  message.role === 'user' 
                    ? 'bg-blue-600 text-white ml-auto max-w-[80%]' 
                    : 'bg-gray-600 text-white mr-auto max-w-[80%]'
                }`}
              >
                {message.content}
              </div>
            ))}
            {isProcessing && (
              <div className="bg-gray-600 text-white mr-auto max-w-[80%] p-4 rounded-lg animate-pulse">
                Thinking...
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-center">
            <Button 
              onClick={toggleListening}
              variant={isListening ? "destructive" : "default"}
              className="w-12 h-12"
              disabled={isProcessing}
            >
              <Mic className={`h-6 w-6 ${isListening ? 'animate-pulse' : ''}`} />
            </Button>
            
            <Button
              variant="outline"
              className={`w-12 h-12 ${
                isPlaying
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
              onClick={() => audioQueue.length > 0 ? playNextAudio() : generateAndQueueAudio(messages.filter(m => m.role === 'assistant').slice(-1)[0]?.content || '')}
              disabled={!messages.some(m => m.role === 'assistant') || isProcessing}
            >
              <Speaker className={`h-6 w-6 ${isPlaying ? 'animate-pulse' : ''}`} />
            </Button>

            {isPlaying && (
              <Button
                variant="destructive"
                className="w-12 h-12"
                onClick={stopAudio}
              >
                <X className="h-6 w-6" />
              </Button>
            )}

            {/* Add the debug button here */}
            <Button
              variant="default"
              className="w-12 h-12 bg-purple-500"
              onClick={debugAudioPlayback}
            >
              🔊
            </Button>
          </div>
        </CardContent>
      </Card>
      <audio ref={audioRef} onEnded={playNextAudio}  />
    </div>
  );
}
