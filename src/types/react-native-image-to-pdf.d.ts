declare module 'react-native-image-to-pdf' {
  interface CreatePDFOptions {
    imagePaths: string[];
    name: string;
    maxSize?: { width: number; height: number };
    quality?: number;
  }

  interface CreatePDFResult {
    filePath: string;
  }

  const RNImageToPdf: {
    createPDFbyImages(options: CreatePDFOptions): Promise<CreatePDFResult>;
  };

  export default RNImageToPdf;
}
