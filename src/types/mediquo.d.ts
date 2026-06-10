interface MediquoWidgetConfig {
  apiKey: string;
  accessToken?: string;
}

interface MediquoWidget {
  init: (config: MediquoWidgetConfig) => void;
  destroy?: () => void;
}

declare global {
  interface Window {
    MediquoWidget?: MediquoWidget;
  }
}

export {};
