interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
  
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    onresult: (event: SpeechRecognitionEvent) => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
    start: () => void;
    stop: () => void;
  }
  
  interface SpeechRecognitionEvent {
    results: {
      [index: number]: {
        [index: number]: {
          transcript: string;
        };
      };
      length: number;
    };
  }
  
  interface SpeechRecognitionErrorEvent {
    error: string;
  }