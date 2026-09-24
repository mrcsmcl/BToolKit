import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { instalarApiAusente } from './api-ausente'
import './web.css'

// Antes de montar: qualquer toque em window.api falha com mensagem explicativa.
instalarApiAusente()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
