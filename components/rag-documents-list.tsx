'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { TrashIcon, FileTextIcon, CalendarIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface RagDocument {
  id: string;
  title: string;
  content: string;
  source?: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

interface RagDocumentsListProps {
  onDocumentDeleted?: () => void;
}

export function RagDocumentsList({ onDocumentDeleted }: RagDocumentsListProps) {
  const [documents, setDocuments] = useState<RagDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/rag/documents');
      if (!response.ok) {
        if (response.status === 401) {
          // User is not authenticated, this is expected behavior
          setDocuments([]);
          return;
        }
        throw new Error(`Failed to fetch documents: ${response.status}`);
      }
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      // Only show error toast for non-authentication errors
      if (error instanceof Error && !error.message.includes('401')) {
        toast.error('Failed to load documents');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const deleteDocument = async (documentId: string) => {
    setDeletingId(documentId);
    try {
      const response = await fetch(`/api/rag/documents?id=${documentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Please log in to delete documents');
          return;
        }
        throw new Error(`Failed to delete document: ${response.status}`);
      }

      toast.success('Document deleted successfully');
      setDocuments((docs) => docs.filter((doc) => doc.id !== documentId));
      onDocumentDeleted?.();
    } catch (error) {
      console.error('Error deleting document:', error);
      if (error instanceof Error && !error.message.includes('401')) {
        toast.error('Failed to delete document');
      }
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    // Only fetch documents if we're in a browser environment
    if (typeof window !== 'undefined') {
      fetchDocuments();

      // Listen for custom refresh events
      const handleRefresh = () => {
        fetchDocuments();
      };

      window.addEventListener('rag-documents-refresh', handleRefresh);

      return () => {
        window.removeEventListener('rag-documents-refresh', handleRefresh);
      };
    }
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Your Documents</h3>
        <div className="text-center py-8 text-muted-foreground">
          Loading documents...
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Your Documents</h3>
        <div className="text-center py-8 text-muted-foreground">
          <FileTextIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No documents uploaded yet.</p>
          <p className="text-sm">
            Upload documents to enable RAG-powered responses.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Your Documents</h3>
        <Badge variant="secondary">
          {documents.length} document{documents.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="space-y-3">
        {documents.map((doc) => (
          <Card key={doc.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate">
                    {doc.title}
                  </CardTitle>
                  {doc.source && (
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      Source: {doc.source}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteDocument(doc.id)}
                  disabled={deletingId === doc.id}
                  className="text-destructive hover:text-destructive"
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground line-clamp-3">
                {doc.content.substring(0, 200)}
                {doc.content.length > 200 && '...'}
              </p>
              <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                <CalendarIcon className="h-3 w-3" />
                <span>
                  Added{' '}
                  {formatDistanceToNow(new Date(doc.createdAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
