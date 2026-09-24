export {};

declare global {
  interface Window {
    arduOS?: {
      desktop: boolean;
      platform: string;
      windowControl?: (action: 'minimize' | 'maximize' | 'close') => void;
    };
  }
}
