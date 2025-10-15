import { format } from "date-fns";

interface ChatMessageProps {
  username: string;
  content: string;
  createdAt: string;
  isCurrentUser: boolean;
}

const ChatMessage = ({ username, content, createdAt, isCurrentUser }: ChatMessageProps) => {
  return (
    <div className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'} mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div className={`max-w-[70%] ${isCurrentUser ? 'bg-primary' : 'bg-secondary'} rounded-2xl px-4 py-2.5 shadow-md`}>
        <div className="flex items-baseline gap-2 mb-1">
          <span className={`font-semibold text-sm ${isCurrentUser ? 'text-primary-foreground' : 'text-accent'}`}>
            {username}
          </span>
          <span className="text-xs text-muted-foreground">
            {format(new Date(createdAt), 'HH:mm')}
          </span>
        </div>
        <p className={`text-sm break-words ${isCurrentUser ? 'text-primary-foreground' : 'text-foreground'}`}>
          {content}
        </p>
      </div>
    </div>
  );
};

export default ChatMessage;
