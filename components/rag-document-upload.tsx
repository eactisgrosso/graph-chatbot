'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { UploadIcon, FileTextIcon, XIcon } from 'lucide-react';

interface RagDocumentUploadProps {
  onDocumentUploaded?: () => void;
}

export function RagDocumentUpload({
  onDocumentUploaded,
}: RagDocumentUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Please select a PDF file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit
        toast.error('File size must be less than 5MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a PDF file');
      return;
    }

    setIsUploading(true);

    try {
      // Create FormData to send the file
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/rag/documents', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please log in to upload documents');
        }
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload document');
      }

      toast.success('PDF uploaded and processed successfully!');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onDocumentUploaded?.();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to upload document',
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="flex items-center gap-2">
        <FileTextIcon className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Upload PDF</h3>
      </div>

      <div className="space-y-4">
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
          />

          {!selectedFile ? (
            <Button
              type="button"
              variant="outline"
              className="w-full h-20 border-dashed"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center gap-2">
                <UploadIcon className="h-6 w-6" />
                <span>Click to select PDF file</span>
                <span className="text-sm text-muted-foreground">
                  Max size: 5MB
                </span>
              </div>
            </Button>
          ) : (
            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <FileTextIcon className="h-5 w-5" />
                <div>
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveFile}
                disabled={isUploading}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <Button
          type="button"
          onClick={handleUpload}
          disabled={isUploading || !selectedFile}
          className="w-full"
        >
          {isUploading ? (
            <>
              <UploadIcon className="h-4 w-4 mr-2 animate-spin" />
              Processing PDF...
            </>
          ) : (
            <>
              <UploadIcon className="h-4 w-4 mr-2" />
              Upload & Process
            </>
          )}
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">
        <p>
          The AI will use this content to provide more accurate responses to
          your questions.
        </p>
      </div>
    </div>
  );
}
