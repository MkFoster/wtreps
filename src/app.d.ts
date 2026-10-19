/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/info" />

export {};

declare global {
  namespace App {
    interface PageState {
      exerciseFeedback?: string;
      circuitFeedback?: string;
      workoutFeedback?: string;
    }
  }
}
