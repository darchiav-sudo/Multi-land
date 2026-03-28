import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest, queryClient, addWebSocketMessageHandler } from '@/lib/queryClient';
import { Comment, User } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/hooks/use-translation';
import { Loader2, X, Send, Wifi, WifiOff } from 'lucide-react';

interface CommentsSectionProps {
  contentId: number;
  comments?: Comment[];
}

interface CommentWithUser extends Comment {
  userEmail?: string;
  username?: string;
}

export function CommentsSection({ contentId, comments: propComments }: CommentsSectionProps) {
  const { user } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [isRealTimeConnected, setIsRealTimeConnected] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();
  
  // Set up WebSocket handlers for real-time comment updates
  useEffect(() => {
    const handleCommentCreated = (message: any) => {
      if (message.data.contentId === contentId) {
        // We'll let the React Query cache invalidation handle the update
        console.log('New comment received via WebSocket:', message.data.comment);
        setIsRealTimeConnected(true);
      }
    };
    
    const handleCommentDeleted = (message: any) => {
      if (message.data.contentId === contentId) {
        console.log('Comment deletion received via WebSocket:', message.data);
        setIsRealTimeConnected(true);
      }
    };
    
    const handleConnection = () => {
      setIsRealTimeConnected(true);
    };
    
    // Register WebSocket message handlers
    const removeCreatedHandler = addWebSocketMessageHandler('comment_created', handleCommentCreated);
    const removeDeletedHandler = addWebSocketMessageHandler('comment_deleted', handleCommentDeleted);
    const removeConnectionHandler = addWebSocketMessageHandler('connection', handleConnection);
    const removePongHandler = addWebSocketMessageHandler('pong', () => setIsRealTimeConnected(true));
    
    // Clean up handlers when component unmounts
    return () => {
      removeCreatedHandler();
      removeDeletedHandler();
      removeConnectionHandler();
      removePongHandler();
    };
  }, [contentId]);

  // Fetch all users (for getting emails)
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/users');
      return res.json();
    },
    enabled: user?.isAdmin === true,
  });

  // Fetch comments for this content if not provided via props
  const { data: fetchedComments = [], isLoading: isLoadingComments } = useQuery<Comment[]>({
    queryKey: ['/api/contents', contentId, 'comments'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/contents/${contentId}/comments`);
      return res.json();
    },
    // Don't fetch if comments are provided via props
    enabled: !propComments,
  });
  
  // Use provided comments prop if available, otherwise use fetched comments
  const rawComments = propComments || fetchedComments;
  
  // Combine comments with user information
  const comments: CommentWithUser[] = rawComments.map(comment => {
    const commentUser = users.find(u => u.id === comment.userId);
    return {
      ...comment,
      userEmail: commentUser?.email || (user?.id === comment.userId ? user.email : undefined),
      username: commentUser?.username || (user?.id === comment.userId ? user.username : undefined)
    };
  });

  // Add new comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest('POST', '/api/comments', {
        contentId,
        text,
      });
      return res.json();
    },
    onSuccess: () => {
      setNewComment('');
      queryClient.invalidateQueries({ queryKey: ['/api/contents', contentId, 'comments'] });
    },
    onError: (error: Error) => {
      toast({
        title: t('content.error'),
        description: error.message || t('content.commentAddError'),
        variant: 'destructive',
      });
    },
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      const res = await apiRequest('DELETE', `/api/comments/${commentId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contents', contentId, 'comments'] });
    },
    onError: (error: Error) => {
      toast({
        title: t('content.error'),
        description: error.message || t('content.commentDeleteError'),
        variant: 'destructive',
      });
    },
  });

  // Format date helper 
  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // Get user's initials for avatar
  const getUserInitials = (userId: string, username?: string) => {
    if (username) {
      // Take first 2 characters of username for the avatar
      return username.slice(0, 2).toUpperCase();
    }
    // Default to first 2 characters of user ID if no username
    return `U${userId.slice(0, 1)}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    
    addCommentMutation.mutate(newComment);
  };

  const handleDelete = (commentId: number) => {
    deleteCommentMutation.mutate(commentId);
  };

  // If user is not logged in, don't show the comment form
  if (!user) {
    return (
      <Card className="mt-6">
        <CardHeader className="flex flex-row justify-between items-center py-3 px-4">
          <CardTitle className="text-sm">{t('content.comments')}</CardTitle>
          <div className="flex items-center text-xs text-muted-foreground">
            {isRealTimeConnected ? (
              <div className="flex items-center gap-1 text-green-600">
                <Wifi className="h-3 w-3" />
                <span className="hidden sm:inline">{t('content.realTimeEnabled')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-gray-400">
                <WifiOff className="h-3 w-3" />
                <span className="hidden sm:inline">{t('content.connectingRealTime')}</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="py-2 px-3">
          {isLoadingComments ? (
            <div className="flex justify-center p-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          ) : comments.length > 0 ? (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="flex space-x-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">{getUserInitials(comment.userId.toString(), comment.username)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="text-xs font-medium">
                      {comment.username || `${t('content.user')} #${comment.userId}`}
                      <span className="ml-2 text-xs text-gray-500">{formatDate(comment.createdAt)}</span>
                    </div>
                    <p className="text-xs text-gray-700">{comment.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-xs text-gray-500">{t('content.noComments')}</p>
          )}
        </CardContent>
        <CardFooter className="py-2 px-3">
          <p className="text-center w-full text-xs text-gray-500">
            {t('content.loginToComment')}
          </p>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row justify-between items-center py-3 px-4">
        <CardTitle className="text-sm">{t('content.comments')}</CardTitle>
        <div className="flex items-center text-xs text-muted-foreground">
          {isRealTimeConnected ? (
            <div className="flex items-center gap-1 text-green-600">
              <Wifi className="h-3 w-3" />
              <span className="hidden sm:inline">{t('content.realTimeEnabled')}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-gray-400">
              <WifiOff className="h-3 w-3" />
              <span className="hidden sm:inline">{t('content.connectingRealTime')}</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="py-2 px-3">
        {isLoadingComments ? (
          <div className="flex justify-center p-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        ) : comments.length > 0 ? (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="flex space-x-2 p-2 border border-border rounded-md">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">{getUserInitials(comment.userId.toString(), comment.username)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="text-xs font-medium flex justify-between">
                    <div>
                      {comment.username || `${t('content.user')} #${comment.userId}`}
                      <span className="ml-2 text-xs text-gray-500">{formatDate(comment.createdAt)}</span>
                    </div>
                    {(user.id === comment.userId || user.isAdmin) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 text-muted-foreground hover:text-destructive p-0"
                        onClick={() => handleDelete(comment.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs">{comment.text}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-xs text-gray-500">{t('content.noComments')}</p>
        )}

        <Separator className="my-3" />

        <form onSubmit={handleSubmit} className="mt-2">
          <Textarea
            placeholder={t('content.writeComment')}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={2}
            className="resize-none text-xs"
          />
          <div className="flex justify-end mt-2">
            <Button 
              type="submit" 
              disabled={!newComment.trim() || addCommentMutation.isPending}
              className="gap-1 text-xs bg-green-600 hover:bg-green-700 text-white font-medium"
              size="sm"
            >
              {addCommentMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {t('content.postComment')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}