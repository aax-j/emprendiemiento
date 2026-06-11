import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../Icon/Icon';
import { ConnectionMessage, getConnectionMessages, sendMessage, subscribeToMessages, markMessagesAsRead } from '../../lib/api/chat';
import styles from './ConnectionChatModal.module.css';

interface ConnectionChatModalProps {
  connectionId: string;
  senderType: 'client' | 'workshop';
  chatTitle: string;
  onClose: () => void;
}

export const ConnectionChatModal: React.FC<ConnectionChatModalProps> = ({
  connectionId,
  senderType,
  chatTitle,
  onClose
}) => {
  const [messages, setMessages] = useState<ConnectionMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const data = await getConnectionMessages(connectionId);
        setMessages(data);
        await markMessagesAsRead(connectionId, senderType);
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    // Subscribe to realtime updates
    const unsubscribe = subscribeToMessages(connectionId, (newMsg: ConnectionMessage) => {
      setMessages(prev => {
        // Prevent duplicates
        if (prev.find(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      // Mark as read if it comes from the other party
      if (newMsg.sender_type !== senderType) {
        markMessagesAsRead(connectionId, senderType).catch(console.error);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [connectionId, senderType]);

  useEffect(() => {
    // Scroll to bottom whenever messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const content = newMessage.trim();
    setNewMessage(''); // optimistic clear
    
    try {
      const sentMsg = await sendMessage(connectionId, senderType, content);
      setMessages(prev => {
        if (prev.find(m => m.id === sentMsg.id)) return prev;
        return [...prev, sentMsg];
      });
    } catch (error) {
      console.error('Error sending message:', error);
      alert('No se pudo enviar el mensaje.');
      setNewMessage(content); // restore on error
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.chatModal} onClick={e => e.stopPropagation()}>
        <div className={styles.chatHeader}>
          <div className={styles.headerTitle}>
            <Icon name="person" style={{ color: 'var(--color-primary)' }} />
            <h3>{chatTitle}</h3>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>

        <div className={styles.chatBody}>
          {loading ? (
            <div className={styles.loading}>Cargando mensajes...</div>
          ) : messages.length === 0 ? (
            <div className={styles.emptyState}>
              <Icon name="chat_bubble_outline" className={styles.emptyIcon} />
              <p>Inicia la conversación. Los mensajes están encriptados y guardados de forma segura.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender_type === senderType;
              return (
                <div key={msg.id} className={`${styles.messageWrapper} ${isMine ? styles.mine : styles.theirs}`}>
                  <div className={`${styles.messageBubble} ${isMine ? styles.bubbleMine : styles.bubbleTheirs}`}>
                    <p>{msg.content}</p>
                    <span className={styles.messageTime}>{formatTime(msg.created_at)}</span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className={styles.chatFooter} onSubmit={handleSend}>
          <input
            type="text"
            className={styles.chatInput}
            placeholder="Escribe un mensaje..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <button type="submit" className={styles.sendBtn} disabled={!newMessage.trim()}>
            <Icon name="send" />
          </button>
        </form>
      </div>
    </div>
  );
};
