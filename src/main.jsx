import React from 'react'
import ReactDOM from 'react-dom/client'
import WhatsAppMessageViewer from '../whatsapp-message-viewer.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WhatsAppMessageViewer />
  </React.StrictMode>,
)