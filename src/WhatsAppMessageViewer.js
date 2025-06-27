import React, { useState, useEffect } from 'react';
import { Search, MessageCircle, Calendar, User, Upload, Download, Image, FileText, Paperclip, Video, Music } from 'lucide-react';

const WhatsAppMessageViewer = () => {
  const [messages, setMessages] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [mediaFiles, setMediaFiles] = useState(new Map());
  const [selectedMessage, setSelectedMessage] = useState(null);

  // Sample data to demonstrate the interface including images
  const sampleMessages = [
    {
      id: 1,
      content: "Remember to pick up groceries: milk, eggs, bread, and fruits for tomorrow's breakfast",
      timestamp: new Date('2024-06-26T10:30:00'),
      sender: 'You',
      type: 'text',
      isForwarded: false
    },
    {
      id: 2,
      content: "‎<attached: 00000014-PHOTO-2025-05-05-08-02-07.jpg>",
      timestamp: new Date('2024-06-25T14:15:00'),
      sender: 'Nuno Loureiro 🚀',
      type: 'image',
      isForwarded: false,
      attachment: {
        filename: '00000014-PHOTO-2025-05-05-08-02-07.jpg',
        type: 'photo'
      }
    },
    {
      id: 3,
      content: "Great article about sustainable living practices. Worth implementing some of these ideas at home.",
      timestamp: new Date('2024-06-24T09:45:00'),
      sender: 'Family Chat',
      type: 'text',
      isForwarded: true
    }
  ];

  useEffect(() => {
    // Load sample messages immediately
    setMessages(sampleMessages);
  }, []);

  const filteredMessages = messages.filter(message => {
    const matchesSearch = message.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         message.sender.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (selectedFilter === 'all') return matchesSearch;
    if (selectedFilter === 'text') return matchesSearch && message.type === 'text';
    if (selectedFilter === 'image') return matchesSearch && message.type === 'image';
    if (selectedFilter === 'sticker') return matchesSearch && message.type === 'sticker';
    if (selectedFilter === 'video') return matchesSearch && message.type === 'video';
    if (selectedFilter === 'audio') return matchesSearch && message.type === 'audio';
    if (selectedFilter === 'document') return matchesSearch && message.type === 'document';
    if (selectedFilter === 'forwarded') return matchesSearch && message.isForwarded;
    
    return matchesSearch;
  });

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return timestamp.toLocaleDateString();
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    console.log('File selected:', file.name, 'type:', file.type, 'size:', file.size);
    setIsLoading(true);
    
    try {
      if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
        console.log('Processing as ZIP file');
        await handleZipUpload(file);
      } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        console.log('Processing as TXT file');
        await handleTextUpload(file);
      } else {
        console.log('Unsupported file type');
        alert('Please upload a WhatsApp chat export (.txt file) or a zip file containing the chat and media files');
      }
    } catch (error) {
      console.error('Error processing file:', error);
      alert(`Error processing file: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextUpload = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const parsedMessages = parseWhatsAppExport(text);
          setMessages(parsedMessages);
          setMediaFiles(new Map());
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleZipUpload = async (file) => {
    console.log('Starting ZIP upload process...');
    
    if (!window.JSZip) {
      console.log('Loading JSZip library...');
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      document.head.appendChild(script);
      
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
      });
      console.log('JSZip loaded successfully');
    }

    try {
      const zip = new window.JSZip();
      console.log('Reading ZIP file...');
      const zipContent = await zip.loadAsync(file);
      console.log('ZIP content loaded, files found:', Object.keys(zipContent.files));
      
      let chatText = '';
      const mediaMap = new Map();
      
      for (const [filename, zipEntry] of Object.entries(zipContent.files)) {
        console.log('Processing file:', filename, 'isDir:', zipEntry.dir);
        if (zipEntry.dir) continue;
        
        const basename = filename.split('/').pop();
        console.log('Basename:', basename);
        
        if (basename.endsWith('_chat.txt') || basename === 'chat.txt') {
          console.log('Found chat file:', basename);
          chatText = await zipEntry.async('text');
          console.log('Chat text length:', chatText.length);
          console.log('First 500 chars:', chatText.substring(0, 500));
        } else if (isMediaFile(basename)) {
          console.log('Found media file:', basename);
          try {
            const blob = await zipEntry.async('blob');
            const url = URL.createObjectURL(blob);
            mediaMap.set(basename, {
              url: url,
              type: getFileType(basename),
              blob: blob
            });
            console.log('Media file processed:', basename, 'type:', getFileType(basename));
          } catch (error) {
            console.warn(`Failed to process media file ${basename}:`, error);
          }
        }
      }
      
      if (!chatText) {
        console.error('No chat file found. Files in ZIP:', Object.keys(zipContent.files));
        throw new Error('No chat file found in zip. Looking for files ending with "_chat.txt"');
      }
      
      console.log('Parsing chat text...');
      const parsedMessages = parseWhatsAppExport(chatText);
      console.log('Parsed messages count:', parsedMessages.length);
      console.log('First few messages:', parsedMessages.slice(0, 3));
      
      setMessages(parsedMessages);
      setMediaFiles(mediaMap);
      console.log('Messages and media files set successfully');
      
    } catch (error) {
      console.error('Error in handleZipUpload:', error);
      throw error;
    }
  };

  const isMediaFile = (filename) => {
    const mediaExtensions = [
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff',
      '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm',
      '.mp3', '.wav', '.aac', '.ogg', '.m4a',
      '.pdf', '.doc', '.docx', '.txt', '.rtf', '.xls', '.xlsx', '.ppt', '.pptx'
    ];
    
    return mediaExtensions.some(ext => 
      filename.toLowerCase().endsWith(ext)
    );
  };

  const getFileType = (filename) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
    const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm'];
    const audioExtensions = ['.mp3', '.wav', '.aac', '.ogg', '.m4a'];
    const stickerExtensions = ['.webp']; // WhatsApp stickers
    
    const lowerFilename = filename.toLowerCase();
    
    // Special handling for WhatsApp stickers
    if (filename.includes('STICKER') && lowerFilename.endsWith('.webp')) {
      return 'sticker';
    }
    
    if (imageExtensions.some(ext => lowerFilename.endsWith(ext))) return 'image';
    if (videoExtensions.some(ext => lowerFilename.endsWith(ext))) return 'video';
    if (audioExtensions.some(ext => lowerFilename.endsWith(ext))) return 'audio';
    return 'document';
  };

  const parseWhatsAppExport = (text) => {
    console.log('Starting parseWhatsAppExport...');
    console.log('Input text length:', text.length);
    
    const lines = text.split('\n');
    console.log('Total lines:', lines.length);
    
    const messages = [];
    let messageId = 1;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      
      // Remove ALL invisible characters and control characters from the beginning
      line = line.replace(/^[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00AD\u061C\u180E]*/, '');
      line = line.replace(/^‎+/, '');
      
      console.log(`Line ${i} after cleaning: "${line.substring(0, 100)}"`);
      
      // Match WhatsApp export format with invisible characters after the colon
      // [DD/MM/YYYY, HH:MM:SS] Sender: [invisible chars]Message
      const messageMatch = line.match(/^\[(\d{2}\/\d{2}\/\d{4}), (\d{2}:\d{2}:\d{2})\] ([^:]+):[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00AD\u061C\u180E\s‎]*(.*)$/);
      
      if (messageMatch) {
        console.log('✅ Found message match on line', i, ':', line.substring(0, 100));
        
        const [, date, time, sender, content] = messageMatch;
        const [day, month, year] = date.split('/');
        const timestamp = new Date(`${year}-${month}-${day}T${time}`);

        console.log('Sender:', sender, 'Content start:', content.substring(0, 50));

        // Skip system messages and deleted messages
        if (sender === 'Save' || content.includes('You deleted this message') || 
            content.includes('end-to-end encrypted') || content.includes('You created group') ||
            content.includes('You removed') || content.includes('You changed the group name')) {
          console.log('⏭️ Skipping system message from:', sender);
          continue;
        }

        // Collect all content for this message (including multi-line)
        let fullContent = content;
        let j = i + 1;
        
        // Look ahead for continuation lines (lines that don't start with timestamp pattern)
        while (j < lines.length) {
          let nextLine = lines[j];
          // Clean invisible characters from continuation lines too
          nextLine = nextLine.replace(/^[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00AD\u061C\u180E]*/, '');
          nextLine = nextLine.replace(/^‎+/, '');
          
          const isNextMessage = nextLine.match(/^\[(\d{2}\/\d{2}\/\d{4}), (\d{2}:\d{2}:\d{2})\] ([^:]+):[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00AD\u061C\u180E\s‎]*(.*)$/);
          
          if (isNextMessage) {
            // Next line is a new message, stop collecting
            break;
          } else if (nextLine.trim()) {
            // Non-empty line that's not a new message - part of current message
            fullContent += '\n' + nextLine;
          } else {
            // Empty line - might be part of message formatting
            fullContent += '\n';
          }
          j++;
        }
        
        // Update the loop counter to skip processed lines
        i = j - 1;

        // Check if message contains attachment - also handle invisible chars in content
        const cleanContent = fullContent.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00AD\u061C\u180E]/g, '');
        const attachmentMatch = cleanContent.match(/<attached: ([^>]+)>/);
        let messageType = 'text';
        let attachment = null;

        if (attachmentMatch) {
          const filename = attachmentMatch[1];
          const fileType = getFileType(filename);
          messageType = fileType === 'image' ? 'image' : 
                       fileType === 'video' ? 'video' :
                       fileType === 'audio' ? 'audio' : 
                       fileType === 'sticker' ? 'sticker' : 'document';
          attachment = {
            filename: filename,
            type: fileType
          };
          console.log('📎 Found attachment:', filename, 'type:', messageType);
        }

        // Clean up content - remove file size info for documents
        let finalContent = cleanContent;
        if (attachment && messageType === 'document') {
          // Remove patterns like "filename.pdf • ‎65 pages" before the attachment
          finalContent = finalContent.replace(/^([^•]+)•[^<]*(<attached:[^>]+>)/, '$2');
        }

        const message = {
          id: messageId++,
          content: finalContent,
          timestamp: timestamp,
          sender: sender.trim(),
          type: messageType,
          isForwarded: finalContent.includes('Forwarded'),
          attachment: attachment
        };
        
        messages.push(message);
        console.log('✅ Added message', messageId - 1, 'from', sender, 'type:', messageType);
      } else if (line.trim()) {
        console.log('❌ Line', i, 'did not match message pattern:', line.substring(0, 100));
        // Let's also show specific invisible characters
        const invisibleChars = line.match(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00AD\u061C\u180E‎]/g);
        if (invisibleChars) {
          console.log('Found invisible characters:', invisibleChars.map(c => c.charCodeAt(0)));
        }
      }
    }

    console.log('🎉 parseWhatsAppExport completed. Total messages:', messages.length);
    return messages;
  };

  const generatePlaceholderImage = (filename) => {
    const hash = filename.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    const color = colors[Math.abs(hash) % colors.length];
    
    return `data:image/svg+xml,${encodeURIComponent(`
      <svg width="200" height="150" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${color}"/>
        <text x="50%" y="50%" font-family="Arial" font-size="12" fill="white" text-anchor="middle" dominant-baseline="middle">
          📷 ${filename.length > 20 ? filename.substring(0, 20) + '...' : filename}
        </text>
      </svg>
    `)}`;
  };

  const getMediaUrl = (filename) => {
    const mediaFile = mediaFiles.get(filename);
    if (mediaFile) {
      return mediaFile.url;
    }
    return generatePlaceholderImage(filename);
  };

  const openMediaModal = (filename) => {
    const mediaFile = mediaFiles.get(filename);
    if (mediaFile) {
      const newWindow = window.open('', '_blank');
      if (mediaFile.type === 'image') {
        newWindow.document.write(`
          <html>
            <head><title>${filename}</title></head>
            <body style="margin:0; display:flex; justify-content:center; align-items:center; min-height:100vh; background:#000;">
              <img src="${mediaFile.url}" style="max-width:100%; max-height:100vh; object-fit:contain;" alt="${filename}">
            </body>
          </html>
        `);
      } else if (mediaFile.type === 'video') {
        newWindow.document.write(`
          <html>
            <head><title>${filename}</title></head>
            <body style="margin:0; display:flex; justify-content:center; align-items:center; min-height:100vh; background:#000;">
              <video controls style="max-width:100%; max-height:100vh;">
                <source src="${mediaFile.url}" type="${mediaFile.blob.type}">
                Your browser does not support the video tag.
              </video>
            </body>
          </html>
        `);
      } else {
        const a = document.createElement('a');
        a.href = mediaFile.url;
        a.download = filename;
        a.click();
      }
    } else {
      alert(`Media file not found: ${filename}`);
    }
  };

  const openFullMessage = (message) => {
    setSelectedMessage(message);
  };

  const exportMessages = () => {
    const dataStr = JSON.stringify(filteredMessages, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'whatsapp_saved_messages.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="bg-green-500 p-3 rounded-full">
                <MessageCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Saved Messages</h1>
                <p className="text-gray-600">{messages.length} messages saved</p>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <label className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg cursor-pointer transition-colors duration-200 flex items-center space-x-2">
                <Upload className="h-4 w-4" />
                <span>Import ZIP/TXT</span>
                <input
                  type="file"
                  accept=".zip,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              
              <button
                onClick={exportMessages}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">All Messages</option>
              <option value="text">Text Only</option>
              <option value="image">Images</option>
              <option value="sticker">Stickers</option>
              <option value="video">Videos</option>
              <option value="audio">Audio</option>
              <option value="document">Documents</option>
              <option value="forwarded">Forwarded</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
            <span className="ml-3 text-gray-600">Loading messages...</span>
          </div>
        )}

        {/* Messages Grid */}
        {!isLoading && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredMessages.map((message) => (
              <div
                key={message.id}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 p-5 border-l-4 border-green-500"
              >
                {/* Message Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">{message.sender}</span>
                    {message.isForwarded && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        Forwarded
                      </span>
                    )}
                  </div>
                </div>

                {/* Message Content */}
                <div className="mb-3">
                  {message.type === 'image' && message.attachment ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <img
                          src={getMediaUrl(message.attachment.filename)}
                          alt={message.attachment.filename}
                          className="w-full h-32 object-cover rounded-lg border-2 border-gray-200 hover:border-green-300 transition-colors cursor-pointer"
                          onClick={() => openMediaModal(message.attachment.filename)}
                        />
                        <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs flex items-center space-x-1">
                          <Image className="h-3 w-3" />
                          <span>PHOTO</span>
                        </div>
                      </div>
                      {message.content.replace(/‎?<attached: [^>]+>/, '').trim() && (
                        <p className="text-gray-800 text-sm leading-relaxed">
                          {message.content.replace(/‎?<attached: [^>]+>/, '').trim()}
                        </p>
                      )}
                    </div>
                  ) : message.type === 'sticker' && message.attachment ? (
                    <div className="space-y-2">
                      <div className="relative flex justify-center">
                        <img
                          src={getMediaUrl(message.attachment.filename)}
                          alt={message.attachment.filename}
                          className="h-24 w-24 object-contain rounded-lg cursor-pointer"
                          onClick={() => openMediaModal(message.attachment.filename)}
                        />
                        <div className="absolute top-1 right-1 bg-purple-500 text-white px-2 py-1 rounded text-xs flex items-center space-x-1">
                          <span>🎭</span>
                          <span>STICKER</span>
                        </div>
                      </div>
                      {message.content.replace(/‎?<attached: [^>]+>/, '').trim() && (
                        <p className="text-gray-800 text-sm leading-relaxed">
                          {message.content.replace(/‎?<attached: [^>]+>/, '').trim()}
                        </p>
                      )}
                    </div>
                  ) : message.type === 'video' && message.attachment ? (
                    <div className="space-y-2">
                      <div className="relative">
                        {mediaFiles.has(message.attachment.filename) ? (
                          <video
                            src={getMediaUrl(message.attachment.filename)}
                            className="w-full h-32 object-cover rounded-lg border-2 border-gray-200 hover:border-green-300 transition-colors cursor-pointer"
                            onClick={() => openMediaModal(message.attachment.filename)}
                            controls={false}
                          />
                        ) : (
                          <div className="w-full h-32 bg-gray-800 rounded-lg border-2 border-gray-200 hover:border-green-300 transition-colors cursor-pointer flex items-center justify-center">
                            <Video className="h-8 w-8 text-white" />
                          </div>
                        )}
                        <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs flex items-center space-x-1">
                          <Video className="h-3 w-3" />
                          <span>VIDEO</span>
                        </div>
                      </div>
                      {message.content.replace(/‎?<attached: [^>]+>/, '').trim() && (
                        <p className="text-gray-800 text-sm leading-relaxed">
                          {message.content.replace(/‎?<attached: [^>]+>/, '').trim()}
                        </p>
                      )}
                    </div>
                  ) : message.type === 'audio' && message.attachment ? (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg border-2 border-blue-200 hover:border-blue-300 transition-colors cursor-pointer"
                           onClick={() => openMediaModal(message.attachment.filename)}>
                        <div className="bg-blue-500 p-2 rounded-full">
                          <Music className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {message.attachment.filename}
                          </p>
                          <p className="text-xs text-gray-500">Audio</p>
                        </div>
                        <Paperclip className="h-4 w-4 text-gray-400" />
                      </div>
                      {message.content.replace(/‎?<attached: [^>]+>/, '').trim() && (
                        <p className="text-gray-800 text-sm leading-relaxed">
                          {message.content.replace(/‎?<attached: [^>]+>/, '').trim()}
                        </p>
                      )}
                    </div>
                  ) : message.type === 'document' && message.attachment ? (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border-2 border-gray-200 hover:border-green-300 transition-colors cursor-pointer"
                           onClick={() => openMediaModal(message.attachment.filename)}>
                        <div className="bg-red-500 p-2 rounded-full">
                          <FileText className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {message.attachment.filename}
                          </p>
                          <p className="text-xs text-gray-500">Document</p>
                        </div>
                        <Paperclip className="h-4 w-4 text-gray-400" />
                      </div>
                      {message.content.replace(/‎?<attached: [^>]+>/, '').trim() && (
                        <p className="text-gray-800 text-sm leading-relaxed">
                          {message.content.replace(/‎?<attached: [^>]+>/, '').trim()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-800 text-sm leading-relaxed line-clamp-4">
                      {message.content}
                    </p>
                  )}
                </div>

                {/* Message Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex items-center space-x-1 text-xs text-gray-500">
                    <Calendar className="h-3 w-3" />
                    <span>{formatTimestamp(message.timestamp)}</span>
                  </div>
                  
                  <button 
                    onClick={() => openFullMessage(message)}
                    className="text-green-600 hover:text-green-700 text-xs font-medium"
                  >
                    View Full
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No Results */}
        {!isLoading && filteredMessages.length === 0 && (
          <div className="text-center py-12">
            <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">No messages found</h3>
            <p className="text-gray-500">Try adjusting your search or filter criteria</p>
          </div>
        )}

        {/* Full Message Modal */}
        {selectedMessage && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-96 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  <User className="h-5 w-5 text-gray-500" />
                  <div>
                    <h3 className="font-medium text-gray-800">{selectedMessage.sender}</h3>
                    <p className="text-sm text-gray-500">{formatTimestamp(selectedMessage.timestamp)}</p>
                  </div>
                  {selectedMessage.isForwarded && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      Forwarded
                    </span>
                  )}
                </div>
                <button 
                  onClick={() => setSelectedMessage(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="p-4 overflow-y-auto max-h-80">
                {selectedMessage.type === 'image' && selectedMessage.attachment ? (
                  <div className="space-y-3">
                    <img
                      src={getMediaUrl(selectedMessage.attachment.filename)}
                      alt={selectedMessage.attachment.filename}
                      className="w-full max-h-64 object-contain rounded-lg border border-gray-200"
                      onClick={() => openMediaModal(selectedMessage.attachment.filename)}
                    />
                    {selectedMessage.content.replace(/‎<attached: [^>]+>/, '').trim() && (
                      <p className="text-gray-800 whitespace-pre-wrap">
                        {selectedMessage.content.replace(/‎<attached: [^>]+>/, '').trim()}
                      </p>
                    )}
                  </div>
                ) : selectedMessage.attachment ? (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="bg-blue-500 p-2 rounded-full">
                        <FileText className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">
                          {selectedMessage.attachment.filename}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">{selectedMessage.attachment.type}</p>
                      </div>
                      <button 
                        onClick={() => openMediaModal(selectedMessage.attachment.filename)}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        Open
                      </button>
                    </div>
                    {selectedMessage.content.replace(/‎<attached: [^>]+>/, '').trim() && (
                      <p className="text-gray-800 whitespace-pre-wrap">
                        {selectedMessage.content.replace(/‎<attached: [^>]+>/, '').trim()}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-800 whitespace-pre-wrap">
                    {selectedMessage.content}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Info Notice */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-800 mb-2">How to Use</h3>
          <div className="text-sm text-blue-700 space-y-2">
            <p><strong>ZIP Upload (Recommended):</strong> Export your WhatsApp chat "With Media" and upload the entire ZIP file. This will show real images, videos, and documents.</p>
            <p><strong>TXT Upload:</strong> Export "Without Media" for text-only messages with placeholder thumbnails.</p>
            <p><strong>Supported Media:</strong> Images (JPG, PNG, GIF), Videos (MP4, MOV), Audio (MP3, WAV), Documents (PDF, DOC, etc.)</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppMessageViewer;